# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A11yAudit — Apache-2.0, self-hosted **WCAG 2.2 technical accessibility audit platform**. Crawls public sites, runs axe-core + custom interaction checks in real Playwright Chromium, captures evidence, generates HTML/PDF reports. Three surfaces: CLI (offline, account-free), Fastify Server API (auth + workspace tenancy), React Web UI.

## Commands

pnpm monorepo (pnpm 9.15+, Node ≥20.11). Workspaces: `apps/*`, `packages/*`.

```bash
pnpm install
pnpm build          # recursive tsc across all packages/apps → dist/
pnpm typecheck      # recursive tsc --noEmit
pnpm test           # vitest run (all packages + apps)
pnpm dev:server     # Fastify on :7842 (tsx, watch src)
pnpm dev:web        # Vite on :5173
```

**Build before dev.** Cross-package imports resolve to each package's `main: dist/index.js` via `workspace:*`. A clean checkout must `pnpm build` (or build the depended-on packages) before `dev:server`/`dev:web`/CLI work.

Single test / filter:
```bash
pnpm vitest run packages/rules/src/audit-page.test.ts
pnpm vitest run -t "keyboard trap"
```

Server DB (Drizzle + better-sqlite3):
```bash
pnpm --filter @a11yaudit/server db:generate   # generate migration from schema
pnpm --filter @a11yaudit/server db:migrate
```
Schema is also applied on server boot via `initializeDb`.

Docker dev: `docker-compose.yml` runs server + web.

## Module conventions

ESM only (`"type": "module"`), `moduleResolution: bundler`, strict TS. **Relative imports use explicit `.js` extensions** (e.g. `./score.js`) even from `.ts` source — match this.

## Architecture

Strict dependency layering (`packages/`), apps consume `audit`:

```
core ─┬─> crawler ─┐
      ├─> rules ───┤
      ├─> reporter │
      └─> storage  │
                   └─> audit ──> cli, server
```

- **core** — shared types/models, WCAG tag→criteria mapping (`wcag.ts`), `DEFAULT_SCAN_LIMITS` / `DEFAULT_VIEWPORTS` (`config.ts`), finding fingerprinting, and **issue aggregation** (`aggregateScanIssues` groups raw findings into deduplicated Issues by scope/component).
- **crawler** — URL normalization, robots.txt, same-domain + static-seed crawl, and **SSRF/network safety** (`assertSafeUrl`, `assertSafeResolvedUrl`, `isBlockedHostnameOrIp` — blocks localhost, private/reserved IPs).
- **rules** — `auditPage()` runs axe-core (`axe-runner.ts`) **plus** custom Playwright interaction rules in `interaction/` (focus-visible, focus-obscured, keyboard-trap, keyboard-unreachable-clickable). Returns unified `ScanFinding[]`. `test-utils/fixture-server.ts` + interaction-lab tests drive these against real HTML fixtures.
- **reporter** — builds report model, renders HTML template, renders PDF via Playwright (`pdf-renderer.ts`).
- **storage** — `StorageAdapter` interface; `LocalStorageAdapter` writes artifacts to `.a11yaudit/artifacts`. Keys via `createArtifactKey`.
- **audit** — `runScan()` (`scan-engine.ts`) is the orchestration core: crawl URLs → launch Chromium → for each url×viewport navigate, `auditPage`, screenshot+snippet evidence → `calculateScore` → store HTML/PDF reports. PDF failure is non-fatal (`reportWarnings`).

### Scan-time safety (important)
`runScan` installs a Playwright route (`installNavigationSafetyRoute`) that validates **every** request URL and document redirect against the SSRF guards, aborts unsafe requests (`blockedbyclient`), and rejects cross-origin redirects. Safety is enforced both at crawl time and inside the browser — preserve both when editing the engine.

### Finding identity
A finding's `fingerprint` = `normalizedUrl + viewport + ruleId + wcagCriteria + elementSignature` (`createFindingFingerprint`). Stable IDs derive from it. Findings link to aggregated Issues via fingerprint→issueId map during persistence.

## Domain model & vocabulary

The product is **issue-first** (a deliberate design decision — see `docs/superpowers/specs/2026-06-01-grouped-issue-reporting-design.md`). On large sites the same header/footer/widget fails on thousands of URLs; reporting each as a separate finding is misleading. So:

- **Finding / Occurrence** — one detected instance on a specific URL+viewport+selector. Stored in the `findings` table. (Spec calls this an "occurrence"; the DB table is named `findings`. They are the same thing — there is no separate `issue_occurrences` table despite older spec wording.)
- **Issue** — a grouped problem remediable in one place. `aggregateScanIssues` (core) groups findings by `issueKey` = `ruleId + sorted WCAG + element signature + component area + URL scope group + CMS hint` (**not** the full URL — that's what enables template-level grouping). Stored in `issues`.
- **Affected pages** = unique normalized URLs; **occurrences** = raw instances across pages×viewports.

Inference attached to each issue (with `confidence` high/medium/low — never overclaim):
- **Likely scope** — `global`, URL group `/segment/*` (first-path-segment grouping), or `single page`.
- **Component area** — header/footer/nav/aside/form/main/unknown, inferred from selector + snippet landmarks.
- **CMS hint** — optional enrichment (e.g. Elementor widget/nav-menu, WordPress single-post). Grouping must work without it.

**Certainty** taxonomy (every finding): `automatic_violation` | `needs_manual_verification` | `not_automatically_testable`. Manual/not-testable items never reduce the score; they go to a manual-review checklist.

**Diff status** (`status` field, repeat-scan model): `new` | `ongoing` | `resolved` | `changed`. `changed` = same underlying issue, different selector/evidence.

**Scan defaults** (`core/config.ts`): max pages 250, max depth 3, robots.txt respected, page timeout 30s, nav timeout 45s, max HTML 5 MB. Viewports: desktop 1440×900, mobile 390×844 — every page audited in both. External domains / private IPs / localhost / metadata IPs blocked.

### Interaction rules (`rules/src/interaction/`)
Playwright-driven checks axe-core can't do, run **after** axe on the same page, appended to findings. Four MVP rules with WCAG criteria:
- `keyboard-unreachable-clickable` → 2.1.1 (`automatic_violation`)
- `focus-obscured` → 2.4.11 (`needs_manual_verification`)
- `focus-visible` → 2.4.7 (`needs_manual_verification`)
- `keyboard-trap` → 2.1.2 (`needs_manual_verification`)

All traversal is **bounded** (max 80 tab stops, ~5s/rule, trap cycle ≤6) — a rule timing out must never fail page scan. Tests serve file-based fixtures (`fixtures/interaction/*.{fail,pass}.html`) over real HTTP via `test-utils/fixture-server.ts` (not `file://`/`setContent` — closer to real focus/script behavior); each rule has fail (≥1 finding) + pass (0 findings) fixtures.

## Server (`apps/server`)

Fastify. `buildServer()` wires DB, `LocalStorageAdapter`, and a `LocalJobRunner` that executes scans in the background (`A11YAUDIT_MAX_CONCURRENT_SCANS`, default 1). On scan completion it writes issues, findings, and reports in a single transaction (chunked inserts). `markInterruptedScansFailed` cleans up scans left mid-flight on boot.

### Workspace-first tenancy
Model: `User → workspace_members → Workspace → Projects → scan_runs → issues/findings/reports/artifacts`. A user may belong to multiple workspaces. Project is unique per `(workspace_id, domain)`. Roles: **owner** (full: create/delete projects, invite/revoke, settings) vs **member** (view + start scans only).

- **Routes** (`routes/`): all data routes are **workspace-slug-scoped** — `/api/workspaces/:workspaceSlug/{projects,scans,issues,findings,reports,artifacts/download,invitations}`. Auth is global: `/api/auth/{signup,login,logout,session}`. Invite accept: `/api/invitations/:token/accept`.
- **Authorization** (`repositories/`): every data path goes through workspace-scoped repository functions — no ad-hoc unscoped DB access. This is the IDOR defense: artifact/report keys alone are **never** authorization; the server verifies workspace membership + that the resource belongs to that workspace before streaming. Preserve this boundary when adding routes.
- **Auth** (`auth/`): email+password, **scrypt** hashing in versioned `scrypt$v1$...` format with timing-safe compare (`password.ts`), emails normalized (trim+lowercase). Cookie sessions, 30-day fixed TTL, only token **hash** stored (`tokens.ts`, `session.ts`). CSRF = double-submit cookie + Origin/Referer check on unsafe methods (`validateCsrf`); skipped only for `/health`, login, signup, invite-accept. Trusted origin from `A11YAUDIT_WEB_ORIGIN`.
- **Invites** (`auth/slug.ts` for slugs): link/token based, no email provider; token hash only, 7-day expiry, accepted invite adds `member`. Invite links work even when public signup is disabled.
- **Signup policy**: first user (user_count===0) bootstraps first workspace as owner; afterward `/signup` is closed unless `A11YAUDIT_PUBLIC_SIGNUPS=true`; otherwise invite-only.
- **Schema** (`db/schema.ts`): users, workspaces, workspace_members, workspace_invitations, sessions, projects, scan_runs, issues, findings, reports.
- **Migrations**: Drizzle (`db:generate` / `db:migrate`), versioned files. Schema assumes a **fresh DB** for SaaS auth/tenancy — existing single-tenant DBs are a breaking transition, not backfilled.
- **Abuse control**: a project cannot start a scan while it has one active (`queued`/`crawling`/`auditing`/`reporting`); global concurrency via env. No per-workspace quota.

### Scan persistence reliability
Audit data is persisted before/independently of PDF success. A PDF render failure must **not** discard completed audit results — it records `reportWarnings` and keeps the scan + HTML report. Don't regress this into "fail whole scan on PDF error".

## Web (`apps/web`)

React 18 + Vite + TanStack Query. `api/client.ts` is the typed API client (credentials + CSRF header). Pages in `pages/`; shared UI in `design/`. API base from `A11YAUDIT_SERVER_URL` / `VITE_A11YAUDIT_API_BASE_URL`.

## CLI (`apps/cli`)

Commander-based, `a11y-audit` bin. Offline, no accounts — calls `runScan` directly against `LocalStorageAdapter` and an output dir. Validates target URL with `assertSafeUrl` and rejects non-http(s).

## Environment variables (server)

```text
A11YAUDIT_PUBLIC_SIGNUPS=false          # only "true" opens signup after first account
A11YAUDIT_MAX_CONCURRENT_SCANS=1        # invalid/0/negative → 1
A11YAUDIT_DB_PATH=.a11yaudit/a11yaudit.db
A11YAUDIT_SERVER_URL=...                # public API origin for web app
A11YAUDIT_WEB_ORIGIN=...                # trusted browser origin (CORS + CSRF)
A11YAUDIT_COOKIE_DOMAIN=.example.com    # optional; set for split app./api. subdomains
PORT=7842
```

First signup bootstraps the first workspace as owner; further public signup is closed unless `A11YAUDIT_PUBLIC_SIGNUPS=true`. Invite onboarding is the default path.

## Docs — design source of truth

`docs/superpowers/` holds the real project knowledge. `specs/` = design intent (read these first when extending a feature area), `plans/` = step-by-step implementation history. Dated, feature-scoped:
- `*-a11yaudit-design.md` — overall product/architecture, scan modes, scoring, security requirements.
- `*-grouped-issue-reporting-design.md` — issue-vs-occurrence model, inference rules, issue-first UI/PDF.
- `*-interaction-rules-fixtures-design.md` — the 4 interaction rules + fixture-lab strategy.
- `*-saas-auth-tenancy-design.md` — workspace tenancy, auth, CSRF, invites, authorization architecture, phasing.

Also `docs/deployment.md` (env + bootstrap), `docs/wcag-22-coverage-guide.md` (rule coverage).

**Note:** specs are intent and occasionally use names the code didn't adopt (e.g. spec's `issue_occurrences` table → implemented as `findings`). Trust the code for current shape; trust specs for *why*.

## Product principles (enforce in copy)

- **English-only** code surface (web UI, CLI, rule identifiers, comments). The **downloaded audit report is localized** (Turkish default, English available) because the customer base is Turkish — it is the one deliverable exempt from English-only. Report criterion copy (user impact / how-to-fix per WCAG criterion) lives in `packages/core/src/wcag-content.ts`, keyed by criterion + locale, sourced from W3C WCAG 2.2. Planning chat with the owner may be Turkish.
- **Technical verification only** — never certify legal/WCAG conformance or imply it. Does not replace manual screen-reader/keyboard testing. Interaction-rule copy describes a technical check ("Clickable control is not reachable by keyboard"), not a verdict ("Site is not WCAG compliant"). Custom rules stay conservative to avoid false positives.
