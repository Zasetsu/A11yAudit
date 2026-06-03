# SaaS Security & Abuse Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the security/operational debt from review of the SaaS member-management work: index evidence-artifact authorization, add rate limiting, throttle the per-request `lastSeenAt` write, surface a CSRF-cookie diagnostic, cover the Members UI mutations, and add a copy-invite-link button.

**Architecture:** Server is Fastify + Drizzle over better-sqlite3, single-process. A new indexed `evidence_artifacts` table replaces a full-table scan for evidence-download authorization (no backfill — fresh-DB assumption). `@fastify/rate-limit` (in-memory) guards auth/invite/member endpoints. Small client + UI changes round out the diagnostic, tests, and copy button.

**Tech Stack:** Fastify 4, `@fastify/rate-limit`, Drizzle ORM (better-sqlite3), Zod, React 18 + Vite, TanStack Query, Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-03-saas-security-hardening-design.md`

---

## Conventions

- ESM: relative imports use explicit `.js` extensions even from `.ts`.
- `pnpm` is NOT on PATH. Use `./node_modules/.bin/vitest` and `./node_modules/.bin/tsc` from the repo root.
- Single server test file: `./node_modules/.bin/vitest run apps/server/src/app.test.ts`
- Single test by name: append `-t "name"`.
- Server typecheck: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
- Web typecheck: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
- `app.test.ts` harness (already present): `withTempDb(async (dbPath) => {...})`, `buildServer({ dbPath, executeScans: false })`, `signup(app, email, workspaceName)`, `signupWithPublicSignup`, `authCookies(response)`, `createWorkspaceInvite(app, cookies, slug, email)`, `addWorkspaceMember(app, ownerCookies, slug, email) -> { accepted, cookies, userId }`, `createDb(dbPath)` for DB inspection, `csrfCookieName`/`sessionCookieName`. Requests via `app.inject({...})`; authed mutations pass `headers: { "x-csrf-token": cookies[csrfCookieName] }` + `cookies`.

## File Structure

- `apps/server/src/db/schema.ts` — add `evidenceArtifacts` table.
- `apps/server/src/db/client.ts` — add `evidence_artifacts` CREATE + index to `initializeDb`.
- `apps/server/src/app.ts` — populate `evidence_artifacts` in the scan-persist transaction; register `@fastify/rate-limit`; add `rateLimit` build option.
- `apps/server/src/repositories/artifacts.ts` — indexed evidence lookup; remove the full scan.
- `apps/server/src/auth/session.ts` — throttle `lastSeenAt` write.
- `apps/server/src/routes/auth.ts`, `routes/workspaces.ts` — per-route `config.rateLimit`.
- `apps/server/package.json` — add `@fastify/rate-limit`.
- `apps/server/src/app.test.ts` — evidence-index, rate-limit, lastSeenAt tests.
- `apps/web/src/api/client.ts` (+ `client.test.ts`) — CSRF-missing diagnostic.
- `apps/web/src/pages/members.tsx` (+ `members.test.tsx`) — copy button + mutation tests.
- `docs/deployment.md` — no-backfill note.

---

## Task 1: `evidence_artifacts` table

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/db/client.ts`

- [ ] **Step 1: Add the Drizzle table**

In `apps/server/src/db/schema.ts`, ensure `index` is imported from drizzle (the file currently imports `integer, sqliteTable, text, uniqueIndex`):

```ts
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
```

Add this table at the end of the file (after `reports`):

```ts
export const evidenceArtifacts = sqliteTable("evidence_artifacts", {
  id: text("id").primaryKey(),
  artifactKey: text("artifact_key").notNull(),
  findingId: text("finding_id").notNull().references(() => findings.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id").notNull().references(() => scanRuns.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull()
}, (table) => ({
  artifactKeyIndex: index("idx_evidence_artifacts_key").on(table.artifactKey)
}));
```

- [ ] **Step 2: Add the table to `initializeDb`**

In `apps/server/src/db/client.ts`, inside the `sqlite.exec(\`...\`)` template in `initializeDb`, add this CREATE statement immediately after the `CREATE TABLE IF NOT EXISTS reports (...)` block and before the `CREATE INDEX` statements:

```sql
    CREATE TABLE IF NOT EXISTS evidence_artifacts (
      id TEXT PRIMARY KEY,
      artifact_key TEXT NOT NULL,
      finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
```

And add this index alongside the other `CREATE INDEX` lines:

```sql
    CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_key ON evidence_artifacts(artifact_key);
```

- [ ] **Step 3: Generate the Drizzle migration**

The project keeps versioned Drizzle migrations alongside the boot-time `initializeDb`. Generate the migration for the new table so the schema change is tracked (not only created at boot).

Run (drizzle-kit is in the repo `node_modules`; `pnpm` is not on PATH):
`./node_modules/.bin/drizzle-kit generate:sqlite --config apps/server/drizzle.config.ts`
Expected: a new file under the server's migrations directory (the path is set in `apps/server/drizzle.config.ts`) containing `CREATE TABLE \`evidence_artifacts\` ...` and the index. Stage it with the commit in Step 6. If `drizzle.config.ts` points at an output dir, confirm the new `.sql` file appeared there.

- [ ] **Step 4: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
Expected: exit 0.

- [ ] **Step 5: Verify the table is created**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "health"` (any existing test boots `buildServer` → `initializeDb`).
Expected: PASS (no SQL error).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/client.ts apps/server/migrations
git commit -m "feat(server): add evidence_artifacts index table"
```

(Adjust the migrations path to whatever `drizzle.config.ts` writes; if no migrations directory is tracked in this repo, omit it and rely on `initializeDb`.)

---

## Task 2: Populate + index-lookup evidence artifacts

**Files:**
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/repositories/artifacts.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this block to `apps/server/src/app.test.ts` (append near the artifact tests). It runs a mock scan, reads an evidence artifact key from the new table, and downloads it.

```ts
describe("evidence artifact authorization", () => {
  it("serves an indexed evidence artifact to a workspace member and 404s unknown keys", async () => {
    await withTempDb(async (dbPath) => {
      mockCompletedScan();
      const app = await buildServer({ dbPath, executeScans: true });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const project = await createProject(app, owner, "Site", "https://example.com");
        const projectId = project.json().id;

        const scan = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/scans",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { projectId, url: "https://example.com", mode: "single_url" }
        });
        const scanId = scan.json().id;
        await waitForCompletedScan(app, owner, scanId);

        const dbClient = createDb(dbPath);
        let evidenceKey: string;
        try {
          const rows = dbClient.db.select().from(evidenceArtifacts).all();
          expect(rows.length).toBeGreaterThan(0);
          evidenceKey = rows[0].artifactKey;
        } finally {
          dbClient.close();
        }

        const ok = await app.inject({
          method: "GET",
          url: `/api/workspaces/owner-workspace/artifacts/download?key=${encodeURIComponent(evidenceKey)}`,
          cookies: ownerCookies
        });
        expect(ok.statusCode).toBe(200);

        const bogus = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/artifacts/download?key=runs/does-not-exist/snippet/x.txt",
          cookies: ownerCookies
        });
        expect(bogus.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects cross-workspace evidence artifact downloads", async () => {
    await withTempDb(async (dbPath) => {
      mockCompletedScan();
      const app = await buildServer({ dbPath, executeScans: true });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const project = await createProject(app, owner, "Site", "https://example.com");
        const scan = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/scans",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { projectId: project.json().id, url: "https://example.com", mode: "single_url" }
        });
        await waitForCompletedScan(app, owner, scan.json().id);

        const dbClient = createDb(dbPath);
        let evidenceKey: string;
        try {
          evidenceKey = dbClient.db.select().from(evidenceArtifacts).all()[0].artifactKey;
        } finally {
          dbClient.close();
        }

        const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");
        const response = await app.inject({
          method: "GET",
          url: `/api/workspaces/other-workspace/artifacts/download?key=${encodeURIComponent(evidenceKey)}`,
          cookies: authCookies(outsider)
        });
        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
```

Ensure `evidenceArtifacts` is imported in the test file's schema import (top of `app.test.ts`):

```ts
import { evidenceArtifacts, findings, issues, projects, reports, scanRuns, sessions, users, workspaceInvitations, workspaceMembers } from "./db/schema.js";
```

(Adjust to match the existing import — just add `evidenceArtifacts`.)

- [ ] **Step 2: Run to verify the first test fails**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "evidence artifact authorization"`
Expected: FAIL — `evidence_artifacts` is empty (not populated yet), so `rows.length` assertion fails.

- [ ] **Step 3: Populate `evidence_artifacts` during scan persistence**

In `apps/server/src/app.ts`, add `evidenceArtifacts` to the schema import:

```ts
import { evidenceArtifacts, findings, issues, reports, scanRuns } from "./db/schema.js";
```

Inside `buildServer`, in the `LocalJobRunner` `execute` callback's `dbClient.db.transaction((tx) => { ... })`, find the findings-insert block:

```ts
            if (result.findings.length > 0) {
              const findingRows = result.findings.map((finding) => ({
```

…and immediately AFTER the `for (const chunk of chunkArray(findingRows, 200)) { tx.insert(findings).values(chunk).run(); }` loop (still inside the `if (result.findings.length > 0)` block), add:

```ts
              const evidenceRows = result.findings.flatMap((finding) =>
                (finding.evidence ?? [])
                  .filter((artifact) => typeof artifact.artifactKey === "string")
                  .map((artifact) => ({
                    id: `evart-${nanoid(12)}`,
                    artifactKey: artifact.artifactKey,
                    findingId: `${result.runId}-${finding.id}`,
                    projectId,
                    scanRunId: result.runId,
                    mimeType: artifact.mimeType,
                    sizeBytes: artifact.sizeBytes,
                    createdAt: completedAt
                  }))
              );

              for (const chunk of chunkArray(evidenceRows, 200)) {
                tx.insert(evidenceArtifacts).values(chunk).run();
              }
```

(`projectId`, `result`, `completedAt`, `nanoid`, and `chunkArray` are already in scope in that transaction.)

- [ ] **Step 4: Replace the full-scan lookup with an indexed query**

Rewrite `apps/server/src/repositories/artifacts.ts` to:

```ts
import { and, eq } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { evidenceArtifacts, projects, reports, scanRuns } from "../db/schema.js";

export interface AuthorizedArtifact {
  artifactKey: string;
  mimeType: string;
}

function getReportArtifactForWorkspace(db: SqliteDatabase, workspaceId: string, key: string): AuthorizedArtifact | null {
  const row = db
    .select({
      artifactKey: reports.artifactKey,
      mimeType: reports.mimeType
    })
    .from(reports)
    .innerJoin(scanRuns, eq(scanRuns.id, reports.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, reports.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(
      eq(reports.artifactKey, key),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  return row ?? null;
}

function getFindingEvidenceArtifactForWorkspace(db: SqliteDatabase, workspaceId: string, key: string): AuthorizedArtifact | null {
  const row = db
    .select({
      artifactKey: evidenceArtifacts.artifactKey,
      mimeType: evidenceArtifacts.mimeType
    })
    .from(evidenceArtifacts)
    .innerJoin(projects, eq(projects.id, evidenceArtifacts.projectId))
    .where(and(
      eq(evidenceArtifacts.artifactKey, key),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  return row ?? null;
}

export async function getAuthorizedArtifactForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  key: string
): Promise<AuthorizedArtifact | null> {
  return getReportArtifactForWorkspace(db, workspaceId, key)
    ?? getFindingEvidenceArtifactForWorkspace(db, workspaceId, key);
}
```

(The `findEvidenceArtifactMetadata` helper, the `EvidenceArtifactRow` interface, and the `findings` import are removed.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "evidence artifact authorization"`
Expected: PASS (2 tests).
Then run the existing artifact tests to confirm no regression:
Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "artifact"`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → exit 0.

```bash
git add apps/server/src/app.ts apps/server/src/repositories/artifacts.ts apps/server/src/app.test.ts
git commit -m "perf(server): index evidence artifacts for authorization lookup"
```

---

## Task 3: Throttle `lastSeenAt` write

**Files:**
- Modify: `apps/server/src/auth/session.ts`
- Test: `apps/server/src/auth/session.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/server/src/auth/session.test.ts`, add (the file already imports `createSession`, `readAuthFromRequest`, `createRequest`, `sessions`, `hashToken`, and a `setupDb`/`seedUser` helper — mirror the existing tests' style):

```ts
  it("does not rewrite last_seen_at within the throttle window", async () => {
    const client = setupDb();
    seedUser(client);
    const session = createSession(client.db, "user-1", new Date("2026-06-03T10:00:00.000Z"));

    // First read at +30s: within 60s window of createdAt/lastSeenAt -> no write.
    readAuthFromRequest(client.db, createRequest({
      cookie: `${sessionCookieName}=${session.sessionToken}`
    }), new Date("2026-06-03T10:00:30.000Z"));

    const row = client.db.select().from(sessions).all()[0];
    expect(row.lastSeenAt).toBe("2026-06-03T10:00:00.000Z");
  });

  it("rewrites last_seen_at after the throttle window", async () => {
    const client = setupDb();
    seedUser(client);
    const session = createSession(client.db, "user-1", new Date("2026-06-03T10:00:00.000Z"));

    readAuthFromRequest(client.db, createRequest({
      cookie: `${sessionCookieName}=${session.sessionToken}`
    }), new Date("2026-06-03T10:05:00.000Z"));

    const row = client.db.select().from(sessions).all()[0];
    expect(row.lastSeenAt).toBe("2026-06-03T10:05:00.000Z");
  });
```

(`sessionCookieName` is imported in this test file; if not, add it from `./cookies.js`.)

- [ ] **Step 2: Run to verify the first test fails**

Run: `./node_modules/.bin/vitest run apps/server/src/auth/session.test.ts -t "last_seen_at"`
Expected: FAIL — the within-window test fails because the current code always writes `lastSeenAt`.

- [ ] **Step 3: Implement the throttle**

In `apps/server/src/auth/session.ts`:

Add a constant near `SESSION_TTL_MS`:

```ts
const LAST_SEEN_THROTTLE_MS = 60_000;
```

In `readAuthFromRequest`, add `lastSeenAt` to the session-row `select`:

```ts
  const row = db
    .select({
      sessionId: sessions.id,
      csrfTokenHash: sessions.csrfTokenHash,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      fullName: users.fullName,
      email: users.email
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.tokenHash, hashToken(sessionToken)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now.toISOString())
    ))
    .get();
```

Replace the unconditional update:

```ts
  db.update(sessions)
    .set({ lastSeenAt: now.toISOString() })
    .where(eq(sessions.id, row.sessionId))
    .run();
```

with a throttled one:

```ts
  const lastSeenMs = Date.parse(row.lastSeenAt);
  if (Number.isNaN(lastSeenMs) || now.getTime() - lastSeenMs >= LAST_SEEN_THROTTLE_MS) {
    db.update(sessions)
      .set({ lastSeenAt: now.toISOString() })
      .where(eq(sessions.id, row.sessionId))
      .run();
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/auth/session.test.ts`
Expected: PASS (all, including the 2 new). The pre-existing read test (`session.test.ts` ~line 112) creates the session at `2026-06-02T10:00:00Z` and reads at `2026-06-03T10:00:00Z` (24h later) and asserts `lastSeenAt` becomes the read time — 24h is far outside the 60s throttle window, so the write still happens and the assertion holds. No change needed to existing tests.

- [ ] **Step 5: Typecheck + commit**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → exit 0.

```bash
git add apps/server/src/auth/session.ts apps/server/src/auth/session.test.ts
git commit -m "perf(server): throttle session last_seen_at writes"
```

---

## Task 4: Rate limiting

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/routes/auth.ts`, `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Add the dependency**

In `apps/server/package.json`, add to `dependencies`:

```json
    "@fastify/rate-limit": "^9.1.0",
```

Install it. Since `pnpm` is not on PATH, run from the repo root using the local pnpm if available, otherwise npm:

Run: `node_modules/.bin/pnpm add @fastify/rate-limit@^9 --filter @a11yaudit/server` if a local pnpm exists; otherwise add the line manually and run `npm install --no-save @fastify/rate-limit@^9` at the repo root so the module resolves. Verify resolution:
Run: `node -e "require.resolve('@fastify/rate-limit')"` → prints a path, no error.

- [ ] **Step 2: Write the failing tests**

Add to `apps/server/src/app.test.ts`:

```ts
describe("rate limiting", () => {
  it("returns 429 after exceeding the login attempt limit", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "owner@example.com", "Owner Workspace");

        let limited = false;
        let retryAfter: string | undefined;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { email: "owner@example.com", password: "wrong-password" }
          });
          if (response.statusCode === 429) {
            limited = true;
            retryAfter = response.headers["retry-after"] as string | undefined;
            break;
          }
        }

        expect(limited).toBe(true);
        expect(retryAfter).toBeDefined();
      } finally {
        await app.close();
      }
    });
  });

  it("does not rate limit when the build option is disabled", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false, rateLimit: false });
      try {
        await signup(app, "owner@example.com", "Owner Workspace");
        for (let attempt = 0; attempt < 15; attempt += 1) {
          const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { email: "owner@example.com", password: "wrong-password" }
          });
          expect(response.statusCode).toBe(401);
        }
      } finally {
        await app.close();
      }
    });
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "rate limiting"`
Expected: FAIL — without the plugin every login returns 401, never 429 (first test fails).

- [ ] **Step 4: Add the `rateLimit` build option and register the plugin**

In `apps/server/src/app.ts`:

Add to the imports:

```ts
import rateLimit from "@fastify/rate-limit";
```

Add `rateLimit` to `BuildServerOptions`:

```ts
export interface BuildServerOptions {
  dbPath?: string;
  dbClient?: DbClient;
  logger?: boolean;
  storageRoot?: string;
  executeScans?: boolean;
  rateLimit?: boolean;
}
```

In `buildServer`, AFTER the `app.addHook("onRequest", ...)` block that sets `request.auth` and validates CSRF, register the plugin (so the limiter's key generator can read `request.auth`). Add:

```ts
  if (options.rateLimit !== false) {
    await app.register(rateLimit, {
      global: true,
      max: 1000,
      timeWindow: "1 minute",
      keyGenerator: (request) => request.auth?.user?.id ?? request.ip,
      errorResponseBuilder: (_request, context) => ({ statusCode: 429, error: "Too many requests", retryAfter: context.after })
    });
  }
```

(Note: `errorResponseBuilder` MUST return `{ statusCode: 429, ... }` — returning only `{ error }` makes `@fastify/rate-limit` respond `500` instead of `429`. The `Retry-After` header is set by the plugin regardless.)

- [ ] **Step 5: Add per-route limits**

In `apps/server/src/routes/auth.ts`, change the login and signup route registrations to pass route options. For login:

```ts
  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
```

For signup:

```ts
  app.post("/api/auth/signup", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
```

In `apps/server/src/routes/workspaces.ts`, add limits to the invite-accept, invite-create, and regenerate routes:

```ts
  app.post("/api/invitations/:token/accept", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
```

```ts
  app.post("/api/workspaces/:workspaceSlug/invitations", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
```

```ts
  app.post("/api/workspaces/:workspaceSlug/invitations/:invitationId/regenerate", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
```

(When the plugin is not registered — `rateLimit: false` in tests — Fastify ignores the unknown `config.rateLimit` key, so these route options are harmless.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "rate limiting"`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the FULL server suite (regression — limits must not break existing flows)**

Run: `./node_modules/.bin/vitest run apps/server`
Expected: PASS. If any pre-existing test that performs many auth/invite calls against ONE `buildServer` instance now returns 429, pass `rateLimit: false` to that test's `buildServer({ ... })` call (only the auth/invite-heavy ones; the global backstop is 1000/min so most are unaffected).

- [ ] **Step 8: Typecheck + commit**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → exit 0.

```bash
git add apps/server/package.json apps/server/src/app.ts apps/server/src/routes/auth.ts apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts pnpm-lock.yaml
git commit -m "feat(server): rate limit auth, invite, and member endpoints"
```

---

## Task 5: CSRF cookie missing diagnostic (web)

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/api/client.test.ts`

- [ ] **Step 1: Read the existing `apiFetch`**

Read `apps/web/src/api/client.ts`. `apiFetch(path, options)` currently reads the `a11yaudit_csrf` cookie via `readCookie("a11yaudit_csrf")` and only sets the `X-CSRF-Token` header when present, on unsafe methods. Note the existing test harness in `client.test.ts` (how it stubs `fetch`, sets cookies via `document.cookie`, and the base URL) — mirror it.

- [ ] **Step 2: Write the failing test**

In `apps/web/src/api/client.test.ts`, add a test that calls a mutation client function (e.g. `createInvite`) with the session configured but NO `a11yaudit_csrf` cookie present, and asserts it returns the diagnostic error instead of issuing a fetch. Mirror the existing harness's helpers (`fetchMock`/`jsonResponse`/base URL). Example shape:

```ts
it("returns a clear error when the CSRF cookie is missing on an unsafe request", async () => {
  // No a11yaudit_csrf cookie set on document.cookie.
  const result = await createInvite("acme", "x@example.com");
  expect(result).toEqual({ error: "CSRF cookie missing — check cookie/domain configuration" });
  expect(fetchMock).not.toHaveBeenCalled();
});
```

Ensure no `a11yaudit_csrf` cookie is present for this test (clear `document.cookie` in setup if the harness sets one elsewhere).

Also add a regression test proving the CSRF-exempt auth path still works with no cookie (this guards the `skipCsrf` exemption):

```ts
it("still issues login without a CSRF cookie (exempt path)", async () => {
  // No a11yaudit_csrf cookie present; login is CSRF-exempt.
  fetchMock.mockResolvedValueOnce(jsonResponse({
    data: { user: { id: "u1", fullName: "Ada", email: "a@b.test" }, workspaces: [] }
  }));
  await expect(login({ email: "a@b.test", password: "secret" })).resolves.toBeDefined();
  expect(fetchMock).toHaveBeenCalled();
});
```

(Adjust `jsonResponse`/`fetchMock` to the real harness names; the point is: login must NOT throw `CsrfCookieMissingError`.)

- [ ] **Step 3: Run to verify it fails**

Run: `./node_modules/.bin/vitest run apps/web/src/api/client.test.ts -t "CSRF cookie is missing"`
Expected: FAIL — `apiFetch` currently issues the request and returns a generic result.

- [ ] **Step 4: Implement the diagnostic in `apiFetch`**

In `apps/web/src/api/client.ts`, define a shared sentinel + error class near the top:

```ts
export const CSRF_COOKIE_MISSING_ERROR = "CSRF cookie missing — check cookie/domain configuration";

class CsrfCookieMissingError extends Error {
  constructor() {
    super(CSRF_COOKIE_MISSING_ERROR);
  }
}
```

**Critical:** `apiFetch` issues unsafe (POST/PATCH/DELETE) requests for BOTH CSRF-protected mutations AND the CSRF-EXEMPT auth endpoints (login, signup, invite-accept). Those auth calls run *before* a session exists, so they legitimately have no `a11yaudit_csrf` cookie — the diagnostic must NOT fire for them or login/signup would break. Add a `skipCsrf` option to `apiFetch` and set it on those calls.

Change the `apiFetch` signature to accept and strip the option, and add the guard (keep the rest of the existing body — only the destructure, the guard, and using `requestInit` instead of `options` change):

```ts
async function apiFetch(path: string, options: RequestInit & { skipCsrf?: boolean } = {}): Promise<Response | null> {
  const { skipCsrf, ...requestInit } = options;
  const url = apiUrl(path);
  if (url === null) {
    return null;
  }

  const headers = new Headers(requestInit.headers);
  headers.set("Accept", "application/json");
  if (requestInit.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const csrfToken = readCookie("a11yaudit_csrf");
  const method = (requestInit.method ?? "GET").toUpperCase();
  const isUnsafeMethod = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  if (isUnsafeMethod && !skipCsrf && (csrfToken === null || csrfToken === "")) {
    throw new CsrfCookieMissingError();
  }
  if (isUnsafeMethod && csrfToken !== null && csrfToken !== "") {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return fetch(url, { ...requestInit, credentials: "include", headers });
}
```

Mark the CSRF-exempt auth calls with `skipCsrf: true` in `postAuth` (used by `login`, `signup`, `acceptInvite`):

```ts
async function postAuth(path: string, input: SignupInput | LoginInput | InviteAcceptInput): Promise<AuthSession> {
  const response = await apiFetch(path, {
    body: JSON.stringify(input),
    method: "POST",
    skipCsrf: true
  });
  // ...rest of postAuth unchanged
}
```

(`logout` is CSRF-protected and only runs while authenticated, so it must NOT set `skipCsrf` — a logged-in user has the CSRF cookie. Leave `logout` as-is.)

Then make the CSRF-protected mutation helpers translate the thrown `CsrfCookieMissingError` into their existing `{ error }` shape. For `updateMemberRole`:

```ts
export async function updateMemberRole(
  workspaceSlug: string,
  userId: string,
  role: "owner" | "member"
): Promise<{ ok: true } | { error: string }> {
  try {
    const response = await apiFetch(`${workspaceMembersPath(workspaceSlug)}/${encodeURIComponent(userId)}`, {
      body: JSON.stringify({ role }),
      method: "PATCH"
    });
    return readMutationResult(response);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Request failed" };
  }
}
```

Apply the same `try/catch` wrapper to `removeMember`, `revokeInvitation`, `createInvite`, `regenerateInvitation`, `createProject`, and `createScan` so a missing-cookie throw becomes `{ error: CSRF_COOKIE_MISSING_ERROR }` (each keeps its own existing success/return shape).

- [ ] **Step 5: Run the test + the full client suite**

Run: `./node_modules/.bin/vitest run apps/web/src/api/client.test.ts`
Expected: PASS (existing + new). If an existing test exercised an unsafe method without setting the CSRF cookie and expected a fetch, set the cookie in that test's setup (`document.cookie = "a11yaudit_csrf=test-token"`).

- [ ] **Step 6: Typecheck + commit**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` → exit 0.

```bash
git add apps/web/src/api/client.ts apps/web/src/api/client.test.ts
git commit -m "feat(web): surface a clear error when the CSRF cookie is missing"
```

---

## Task 6: Members UI mutation tests

**Files:**
- Test: `apps/web/src/pages/members.test.tsx`

- [ ] **Step 1: Add mutation-flow tests**

In `apps/web/src/pages/members.test.tsx` (existing harness: mounts `<App/>`, mocks `../api/client`, owner session at `/w/acme/members`), add tests. The mock object already includes `createInvite`, `updateMemberRole`, `removeMember`, `revokeInvitation`, `regenerateInvitation`, `listMembers`, `listInvitations`. Add a helper to click a button by its text and to set input values, mirroring `auth.test.tsx`'s `clickButton`/`fillInput`. Then:

```ts
it("creates an invite and shows the returned link", async () => {
  api.getSession.mockResolvedValue(ownerSession);
  api.createInvite.mockResolvedValue({
    invitation: { id: "winv-1", email: "new@example.test", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" },
    inviteUrl: "/invite/tok-123"
  });
  const rendered = await renderApp();
  roots.push(rendered.root);

  await waitFor(() => expect(rendered.container.textContent).toContain("Invite a member"));
  await fillInput(rendered.container, "Email", "new@example.test");
  await clickButton(rendered.container, "Send invite");

  await waitFor(() => expect(api.createInvite).toHaveBeenCalledWith("acme", "new@example.test"));
  await waitFor(() => expect(rendered.container.textContent).toContain("/invite/tok-123"));
});

it("changes a member role", async () => {
  api.getSession.mockResolvedValue(ownerSession);
  api.listMembers.mockResolvedValue([
    { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" },
    { userId: "user-2", fullName: "Bob", email: "bob@example.test", role: "member", joinedAt: "2026-06-02T00:00:00.000Z" }
  ]);
  api.updateMemberRole.mockResolvedValue({ ok: true });
  const rendered = await renderApp();
  roots.push(rendered.root);

  let select: HTMLSelectElement | null = null;
  await waitFor(() => {
    select = rendered.container.querySelector<HTMLSelectElement>("select[aria-label='Role for bob@example.test']");
    expect(select).toBeTruthy();
  });
  await act(async () => {
    select!.value = "owner";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await waitFor(() => expect(api.updateMemberRole).toHaveBeenCalledWith("acme", "user-2", "owner"));
});

it("removes a member", async () => {
  api.getSession.mockResolvedValue(ownerSession);
  api.listMembers.mockResolvedValue([
    { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" },
    { userId: "user-2", fullName: "Bob", email: "bob@example.test", role: "member", joinedAt: "2026-06-02T00:00:00.000Z" }
  ]);
  api.removeMember.mockResolvedValue({ ok: true });
  const rendered = await renderApp();
  roots.push(rendered.root);

  await waitFor(() => expect(rendered.container.textContent).toContain("bob@example.test"));
  await clickButton(rendered.container, "Remove");

  await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith("acme", "user-2"));
});

it("revokes and regenerates a pending invitation", async () => {
  api.getSession.mockResolvedValue(ownerSession);
  api.listInvitations.mockResolvedValue([
    { id: "winv-1", email: "pending@example.test", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" }
  ]);
  api.regenerateInvitation.mockResolvedValue({ inviteUrl: "/invite/fresh-456" });
  api.revokeInvitation.mockResolvedValue({ ok: true });
  const rendered = await renderApp();
  roots.push(rendered.root);

  await waitFor(() => expect(rendered.container.textContent).toContain("pending@example.test"));
  await clickButton(rendered.container, "Regenerate link");
  await waitFor(() => expect(api.regenerateInvitation).toHaveBeenCalledWith("acme", "winv-1"));
  await waitFor(() => expect(rendered.container.textContent).toContain("/invite/fresh-456"));

  await clickButton(rendered.container, "Revoke");
  await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith("acme", "winv-1"));
});

it("shows the error banner when a mutation fails", async () => {
  api.getSession.mockResolvedValue(ownerSession);
  api.listMembers.mockResolvedValue([
    { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" },
    { userId: "user-2", fullName: "Bob", email: "bob@example.test", role: "member", joinedAt: "2026-06-02T00:00:00.000Z" }
  ]);
  api.removeMember.mockResolvedValue({ error: "Workspace must keep at least one owner" });
  const rendered = await renderApp();
  roots.push(rendered.root);

  await waitFor(() => expect(rendered.container.textContent).toContain("bob@example.test"));
  await clickButton(rendered.container, "Remove");

  await waitFor(() => expect(rendered.container.textContent).toContain("Workspace must keep at least one owner"));
});
```

Add the `fillInput`/`clickButton` helpers (copy them from `apps/web/src/pages/auth.test.tsx` — they find a `<label>` containing the text and its `<input>`, or a `<button>` whose `textContent` matches). Reuse the file's existing `renderApp`, `waitFor`, `ownerSession`, `roots`, and `beforeEach` mocks (which already set `listMembers`/`listInvitations` defaults — override per test as above).

- [ ] **Step 2: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/members.test.tsx`
Expected: PASS (existing 2 + 5 new). Fix selectors to match the real DOM if any assertion misses (the role `<select>` uses `aria-label={`Role for ${email}`}`; buttons render their label text).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/members.test.tsx
git commit -m "test(web): cover members page mutation flows"
```

---

## Task 7: Copy invite link button

**Files:**
- Modify: `apps/web/src/pages/members.tsx`
- Test: `apps/web/src/pages/members.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/pages/members.test.tsx`:

```ts
it("copies the invite link to the clipboard", async () => {
  api.getSession.mockResolvedValue(ownerSession);
  api.createInvite.mockResolvedValue({
    invitation: { id: "winv-1", email: "new@example.test", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" },
    inviteUrl: "/invite/tok-123"
  });
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  const rendered = await renderApp();
  roots.push(rendered.root);

  await fillInput(rendered.container, "Email", "new@example.test");
  await clickButton(rendered.container, "Send invite");
  await waitFor(() => expect(rendered.container.textContent).toContain("/invite/tok-123"));

  await clickButton(rendered.container, "Copy");
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/tok-123`));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/members.test.tsx -t "copies the invite link"`
Expected: FAIL — no "Copy" button exists.

- [ ] **Step 3: Add the Copy button**

In `apps/web/src/pages/members.tsx`, find the block that renders `latestLink`:

```tsx
        {latestLink !== null ? (
          <div className="note">
            <Icon name="info" size={14} /> Invite link (copy now, it is shown once):
            <code className="mono"> {latestLink}</code>
          </div>
        ) : null}
```

Replace it with a version that adds a Copy button:

```tsx
        {latestLink !== null ? (
          <div className="note">
            <Icon name="info" size={14} /> Invite link (copy now, it is shown once):
            <code className="mono"> {latestLink}</code>
            <Button
              icon="arrow-right"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                  void navigator.clipboard.writeText(latestLink);
                }
              }}
              variant="ghost"
            >
              Copy
            </Button>
          </div>
        ) : null}
```

(`Button` and `Icon` are already imported in this file. The optional-chaining guard covers environments without `navigator.clipboard`.)

- [ ] **Step 4: Run the test + full web suite**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/members.test.tsx`
Expected: PASS.
Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/members.tsx apps/web/src/pages/members.test.tsx
git commit -m "feat(web): copy invite link button on members page"
```

---

## Task 8: Document the no-backfill behavior

**Files:**
- Modify: `docs/deployment.md`

- [ ] **Step 1: Add a note**

In `docs/deployment.md`, under the existing "Fresh Database Assumption" section (or a new "Evidence Artifacts" subsection), add:

```markdown
### Evidence Artifact Index

Evidence-artifact downloads are authorized through an indexed `evidence_artifacts`
table populated when a scan's findings are persisted. Scans created before this
table existed are not backfilled: their evidence-artifact downloads return 404
until the project is re-scanned. Report (HTML/PDF) downloads are unaffected.
```

- [ ] **Step 2: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: note evidence artifact no-backfill behavior"
```

---

## Final verification

- [ ] Full suite: `./node_modules/.bin/vitest run` → all pass.
- [ ] Server typecheck: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → exit 0.
- [ ] Web typecheck: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` → exit 0.
- [ ] Open a PR from `feature/saas-security-hardening` to `main`.
