# SaaS Security & Abuse Hardening Design

Date: 2026-06-03

## Goal

Close the security and operational debt surfaced by code review of the SaaS auth/tenancy and member-management work. The product now has accounts, workspaces, invitations, and member management; the underlying scanner remains. These changes harden the authenticated SaaS surface without changing the product model.

Six items, one plan:

1. **Artifact evidence authorization** — replace a full-table scan with an indexed lookup (HIGH).
2. **Rate limiting** — protect auth, invite, and member endpoints from abuse (MED).
3. **`lastSeenAt` write throttle** — stop a per-request SQLite write (MED).
4. **CSRF cookie missing diagnostic** — surface a clear client error instead of a generic 403 (LOW).
5. **Members UI mutation tests** — cover the create/regenerate/revoke/role/remove flows (LOW-MED).
6. **Copy invite link button** — add a clipboard action to the one-time invite link (LOW).

## Context

- Fastify server, Drizzle ORM over better-sqlite3, single-process (in-process `LocalJobRunner`, synchronous DB). In-memory rate-limit state is therefore acceptable.
- Workspace-scoped authorization goes through `routes/workspace-access.ts` (`requireWorkspaceMembership` + `requireWorkspaceOwner`); every data lookup is scoped by the resolved `context.workspaceId`. This boundary is preserved.
- Evidence artifacts are currently stored only inside `findings.evidence` (a JSON blob). Report artifacts already have an indexed `reports.artifact_key` column; this design brings evidence to parity.
- The schema already assumes a **fresh database** for the SaaS transition (no backfill of pre-existing single-tenant data).

---

## 1. Artifact evidence authorization

### Problem
`getFindingEvidenceArtifactForWorkspace` (`repositories/artifacts.ts`) selects **every** `findings.evidence` row for the workspace and `JSON.parse`s each blob in application code to authorize a single artifact key. Authorization is correct (no cross-tenant leak), but a request with a bogus key forces an O(all-findings) scan + per-row parse on large tenants — an amplification/DoS surface. The report path is already a single indexed query; evidence should match.

### Design
Add an indexed mapping table populated when a scan's findings are persisted.

New table `evidence_artifacts`:

```text
id            text primary key            (e.g. evart-<nanoid>)
artifact_key  text not null               (indexed; the storage key)
finding_id    text not null references findings(id) on delete cascade
project_id    text not null references projects(id) on delete cascade
scan_run_id   text not null references scan_runs(id) on delete cascade
mime_type     text not null
size_bytes    integer not null
created_at    text not null
index (artifact_key)
```

- `artifact_key` is indexed for direct lookup. It is not declared globally unique because the same storage key could in principle recur across runs; lookups always also filter by workspace via the `projects` join, so uniqueness is not required for correctness.
- **Population:** in the scan-persist transaction (`apps/server/src/app.ts` job runner), after inserting `findings`, flatten each finding's `evidence` array into `evidence_artifacts` rows (chunked insert, same pattern as findings/issues). Only rows with a defined `artifactKey` are inserted.
- **Lookup rewrite:** `getFindingEvidenceArtifactForWorkspace` becomes a single query:

  ```sql
  select ea.artifact_key, ea.mime_type, ea.size_bytes
  from evidence_artifacts ea
  inner join projects p on p.id = ea.project_id
  where ea.artifact_key = ? and p.workspace_id = ?
  limit 1
  ```

  The full-scan + `findEvidenceArtifactMetadata` JSON parsing path is **removed**. `getAuthorizedArtifactForWorkspace` keeps its report-first, evidence-fallback shape — only the evidence branch changes.
- **Migration:** Drizzle `db:generate` produces the versioned migration; `initializeDb` also creates the table on boot.

### Breaking note (no backfill)
Existing scans' evidence artifacts are **not** backfilled into `evidence_artifacts`. After this change, evidence downloads for scans created before the migration return `404` until those projects are re-scanned. This matches the existing fresh-database assumption for the SaaS schema. Document this in `docs/deployment.md`. Report downloads are unaffected (they already use `reports.artifact_key`).

### Tests
- An evidence artifact created by a scan is downloadable by a workspace member; the lookup hits the indexed table (assert the row exists in `evidence_artifacts`).
- A bogus/unknown artifact key returns `404` without scanning findings.
- Cross-workspace: an owner of workspace A cannot download workspace B's evidence artifact key (404).
- Report-artifact downloads still work (regression).

---

## 2. Rate limiting

### Design
Add `@fastify/rate-limit` (in-memory store; Redis is optional and out of scope for the single-instance deployment).

- **Global backstop:** register the plugin with a generous default (`max: 1000`, `timeWindow: "1 minute"`) so every route has a ceiling. The backstop is deliberately loose — the security value is in the strict per-route limits below; a loose global ceiling also avoids tripping the suite's polling/scan tests that issue many requests against one in-memory limiter instance.
- **Per-route stricter limits** via each route's `config.rateLimit`:
  - `POST /api/auth/login` — 10 / minute
  - `POST /api/auth/signup` — 5 / minute
  - `POST /api/invitations/:token/accept` — 10 / minute
  - `POST /api/workspaces/:workspaceSlug/invitations` (create) — 20 / minute
  - `POST /api/workspaces/:workspaceSlug/invitations/:invitationId/regenerate` — 20 / minute
- **Key generator:** unauthenticated routes (login/signup/accept) key by client IP; authenticated routes key by `request.auth.user.id`, falling back to IP when absent. A shared `keyGenerator` reads `request.auth` (already populated by the `onRequest` hook).
- **Response:** the plugin returns `429` with a `Retry-After` header and a JSON body matching the app's `{ error }` shape (configure `errorResponseBuilder`).
- **Ordering:** rate limiting runs in the request lifecycle alongside the existing CSRF/auth `onRequest` hook; the limiter must not interfere with the CSRF-skip list. `/health` is exempt from the strict limits (global backstop is fine).

### Tests
- Exceeding the login limit returns `429` with `Retry-After`; a fresh key is unaffected.
- The authenticated invite-create limit keys per user (two different users are limited independently).
- Normal usage well under the limits is never throttled (existing tests still pass).

---

## 3. `lastSeenAt` write throttle

### Problem
`readAuthFromRequest` (`auth/session.ts`) issues `UPDATE sessions SET last_seen_at = now` on **every** authenticated request (including idempotent GETs and `/health` with a cookie), adding a synchronous write + WAL churn to each request on the single-writer SQLite DB.

### Design
- Add `lastSeenAt` to the session-row `select` in `readAuthFromRequest`.
- Only issue the `UPDATE` when the stored `lastSeenAt` is older than a threshold (`LAST_SEEN_THROTTLE_MS = 60_000`). Otherwise skip the write.
- `last_seen_at` does not need second-level precision; minute-level is sufficient.

### Tests
- A request with a recently-seen session does **not** write (assert `last_seen_at` unchanged within the window).
- A request with a stale `last_seen_at` (older than 60s) updates it.
- Auth still resolves correctly in both cases.

---

## 4. CSRF cookie missing diagnostic

### Problem
The double-submit CSRF cookie (`a11yaudit_csrf`) must be JS-readable for the web client to echo it in the `X-CSRF-Token` header. If it is absent (e.g. a split `app.`/`api.` subdomain or cookie-domain misconfiguration), `apiFetch` silently omits the header and every mutation fails with a generic `403`, giving no diagnostic.

### Design
- In `apiFetch` (`apps/web/src/api/client.ts`), on an unsafe method (POST/PUT/PATCH/DELETE) when the `a11yaudit_csrf` cookie is **absent**, do not send the request blindly. Surface a clear, distinguishable error/result (e.g. `{ error: "CSRF cookie missing — check cookie/domain configuration" }`) so callers and the UI can show a meaningful message instead of a generic failure.
- **Exempt the CSRF-free endpoints.** Login, signup, and invite-accept are CSRF-exempt on the server and run before a session (no CSRF cookie yet), so `apiFetch` must NOT raise the diagnostic for them. Thread a `skipCsrf` option through `apiFetch` and set it on those auth calls; the diagnostic fires only for genuinely CSRF-protected mutations.
- Client-only change; the server CSRF logic is unchanged.

### Tests
- `apiFetch`/a mutation client function with no CSRF cookie present returns the diagnostic error (not a silent generic failure). Use the existing client test harness.

---

## 5. Members UI mutation tests

### Problem
`apps/web/src/pages/members.test.tsx` covers only owner render and member-role nav hiding. The create/regenerate/revoke/role-change/remove flows and the error banner are untested at the UI level, so frontend workflow regressions can slip through.

### Design
Extend `members.test.tsx` (existing harness: mount `<App/>`, mock `../api/client`) with:
- Creating an invite calls `createInvite("acme", email)` and renders the returned invite link.
- Regenerate calls `regenerateInvitation` and surfaces the new link.
- Revoke calls `revokeInvitation`.
- Role change calls `updateMemberRole` with the selected role.
- Remove calls `removeMember`.
- An error result (`{ error }`) renders the error banner; a subsequent action start clears it (the `onMutate` clearing behavior).

### Tests
The above are the tests.

---

## 6. Copy invite link button

### Problem
`members.tsx` displays the one-time invite link as text but has no copy affordance; the product expectation was a "copy invite link" action.

### Design
- Add a "Copy" button next to the displayed invite link. On click, call `navigator.clipboard.writeText(latestLink)` with a guard for environments where `navigator.clipboard` is unavailable (fall back to selecting the text / a no-op with a brief "Copied" affordance).
- Keep it small and within `members.tsx`.

### Tests
- The copy button is present when a link is shown; clicking it invokes the clipboard write (mock `navigator.clipboard.writeText`).

---

## Out of scope

- Redis-backed distributed rate limiting (single-instance only).
- Backfilling pre-existing evidence artifacts.
- Server-side CSRF changes (the diagnostic is client-only).
- Any change to the workspace authorization model, which review confirmed correct.

## File touch map

- `apps/server/src/db/schema.ts` — `evidence_artifacts` table.
- `apps/server/src/db/` migration (generated).
- `apps/server/src/app.ts` — populate `evidence_artifacts` in the persist transaction.
- `apps/server/src/repositories/artifacts.ts` — indexed evidence lookup, remove full scan.
- `apps/server/src/auth/session.ts` — throttle `lastSeenAt`.
- `apps/server/src/app.ts` (or a small `rate-limit.ts`) — register `@fastify/rate-limit`; per-route `config.rateLimit` in `routes/auth.ts` and `routes/workspaces.ts`.
- `apps/server/package.json` — add `@fastify/rate-limit`.
- `apps/server/src/app.test.ts` — evidence-lookup, rate-limit, lastSeenAt tests.
- `apps/web/src/api/client.ts` — CSRF-missing diagnostic.
- `apps/web/src/api/client.test.ts` — diagnostic test.
- `apps/web/src/pages/members.tsx` — copy button.
- `apps/web/src/pages/members.test.tsx` — mutation-flow + copy tests.
- `docs/deployment.md` — no-backfill note.
