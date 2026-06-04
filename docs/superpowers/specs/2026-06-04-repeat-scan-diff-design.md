# Repeat-Scan Diff Design

Date: 2026-06-04

## Goal

Each scan currently persists every issue with `status = "new"` — there is no comparison to history. This feature makes a repeat scan **compare against the project's previous completed scan** and label each issue **new / ongoing / resolved**, so a returning customer can see "what changed since last audit." Diff is computed **at the issue level** (the product's primary unit), persisted, and surfaced in the web UI and the downloaded report.

This realizes the long-standing "repeat scan comparison" intent in the master design (`2026-05-31-a11yaudit-design.md` → "Finding Identity and Diff"). `changed` is deliberately deferred (see Out of scope).

## Decisions (locked during brainstorming)

1. **Diff unit = issue** (matched by `issueKey`), not per-finding. Findings inherit their issue's status. Issue-level avoids per-page noise (one template issue failing on thousands of URLs is one diff result, not thousands).
2. **Three statuses: `new`, `ongoing`, `resolved`.** `issueKey` exact match in baseline → `ongoing`; absent from baseline → `new`; present in baseline but absent now → `resolved`.
3. **Resolved issues are persisted** — carried into the new scan as `status = "resolved"` rows (with the baseline's last-seen data, zero current findings) so the UI/report can list and drill into them.
4. **Surfaces: web UI + report summary.** Backend diff engine + status badges + a "since last scan" summary in the UI, and a "Changes" summary section in the report.

## Identity & baseline

- **Issue identity** = the existing `issueKey` (`ruleId + sorted WCAG + element signature + component area + URL scope group + CMS hint` — **not** the full URL; this is what enables template-level grouping and a stable cross-scan key). No new identity model is introduced.
- **Baseline** = the single most recent **completed** scan run of the **same project**, excluding the run being persisted. Failed/interrupted runs are never a baseline. The very first scan of a project has no baseline → all issues `new`, no resolved.
- Diff is per project (a project is unique per `(workspace_id, domain)`), so baseline lookup is project-scoped and inherently workspace-scoped.

## Architecture

Three layers, each independently testable.

### 1. Schema (server, `db/schema.ts` + migration)

Add a `status` column to the **`issues`** table:

```ts
status: text("status").notNull().default("new"),
```

- `findings.status` already exists (currently always `"new"`); it will be filled from the issue's diff status.
- Generate a migration (`pnpm --filter @a11yaudit/server db:generate`) and rely on boot `initializeDb` to apply it. Per the project's SaaS posture, schema assumes a fresh DB; the `default("new")` keeps any existing rows valid.

### 2. Diff engine (core, `packages/core/src/diff.ts`)

A pure function — no DB, no IO — so it is trivially unit-testable:

```ts
export type DiffStatus = "new" | "ongoing" | "resolved";

// Minimal shape the diff needs from a prior-scan issue (what we persist & carry over).
export interface BaselineIssue {
  issueKey: string;
  title: string;
  severity: Severity;
  source: FindingSource;
  certainty: FindingCertainty;
  ruleId: string;
  wcagCriteria: string[];
  description: string;
  recommendation: string;
  likelyScope: string;
  urlScopeGroup: string;
  componentArea: string;
  cmsHint: string;
  confidence: "high" | "medium" | "low";
  affectedPages: number;
  occurrences: number;
  viewportSummary: string;
  representativeUrl: string;
  representativeSelector: string | null;
  representativeHtmlSnippet: string | null;
  sampleUrls: string[];
}

export interface DiffedIssue extends AggregatedIssue {
  status: DiffStatus; // "new" | "ongoing"
}

export interface DiffResult {
  issues: DiffedIssue[];        // current issues, each labeled new/ongoing
  resolved: BaselineIssue[];    // baseline issues absent from current (to be carried over as resolved rows)
  counts: { new: number; ongoing: number; resolved: number };
}

export function diffScanIssues(current: AggregatedIssue[], baseline: BaselineIssue[]): DiffResult;
```

Logic:
- Build `baselineKeys = new Set(baseline.map(b => b.issueKey))` and `currentKeys = new Set(current.map(c => c.issueKey))`.
- Each `current` issue → `status = baselineKeys.has(issueKey) ? "ongoing" : "new"`.
- Each `baseline` issue whose `issueKey` ∉ `currentKeys` → goes into `resolved`.
- `counts` derived from the above.
- Empty `baseline` → all `new`, `resolved = []`.
- Duplicate `issueKey`s within one scan are not expected (aggregation dedupes), but the function tolerates them via set membership (no throw).

### 3. Diff in the scan pipeline (audit) + server wiring

The report is rendered **inside `runScan`** (audit), before the server persists. So the diff must run **in the audit pipeline** (fed a baseline by the server) for the report to reflect it. The server loads the baseline, passes it in, and persists the diffed result.

**a) Baseline repository fn** (`repositories/issues.ts`): workspace-scoped, project-scoped read — preserves the IDOR boundary (no ad-hoc unscoped access):

```ts
getBaselineIssues(db, { projectId, excludeScanRunId }): BaselineIssue[]
```

- Find the most recent completed scan run for `projectId` with `id != excludeScanRunId` (`scanRuns` where `project_id = ? and status = 'completed' and id != ?` order by `finished_at` desc limit 1).
- If none, return `[]`.
- Else return its `issues` rows mapped to `BaselineIssue` (parse `wcagCriteria` CSV and `sampleUrls` JSON back to arrays).

**b) Thread baseline into `runScan`** (`apps/server/app.ts` execute handler): load the baseline just before the scan and pass it in:

```ts
const baselineIssues = getBaselineIssues(dbClient.db, { projectId: job.payload.projectId, excludeScanRunId: job.id });
const result = await runScan({ request: {…}, storage, baselineIssues, onProgress });
```

**c) Diff inside `runScan` / `storeReports`** (`packages/audit/scan-engine.ts`): `RunScanInput` gains `baselineIssues?: BaselineIssue[]` (default `[]`). After aggregating current issues:
1. `const diff = diffScanIssues(currentIssues, baselineIssues)`.
2. Set each finding's `status` from its owning issue's diff status (map `fingerprint → issueKey → status`). Because `aggregateScanIssues` sets `issue.status = first.status`, the server's later re-aggregation yields issues with the correct status — no separate status channel needed.
3. The report model receives `diffCounts = diff.counts` and the `resolved` issue titles for the "Changes" section.
4. `CompletedScanResult` gains `resolvedIssues: BaselineIssue[]` (= `diff.resolved`) so the server can persist resolved carry-over rows. Score is unchanged (computed from current findings only).

**d) Persist** (`app.ts` scan-completion transaction):
- `aggregateScanIssues(result.findings)` now yields issues whose `status` comes from `finding.status` (set in step c-2). Extend the existing `issueRows` mapping to include `status`.
- Insert **resolved carry-over** rows: for each `result.resolvedIssues` entry, a new `issues` row with a fresh id (`${runId}-resolved-${n}`), `scanRunId = result.runId`, `status = "resolved"`, fields copied from the baseline issue, `createdAt = completedAt`, and **no findings/evidence**.
- Finding rows already carry their `status` from `result.findings`.

Reliability: the diff is pure and in-memory; a baseline read failure degrades gracefully (empty baseline → all `new`) rather than failing the scan.

### 4. Web UI (`apps/web`)

- **API**: the issues endpoint already returns issue rows; include the new `status`. The web `Issue` type gains `status`. (Findings already carry `status`.)
- **Status badges**: `StatusBadge` already renders new/ongoing/resolved — show it on the findings list and scan-run detail issue rows.
- **"Since last scan" summary**: on **scan-run detail** (and optionally overview) show `X new · Y ongoing · Z resolved` derived from the run's issues' statuses. Resolved issues are listed (drill-down) in their own group/section.
- **Findings filter** (optional, low priority): a status filter alongside the severity filter.
- All new copy is localized (tr/en) per the established i18n catalog.

### 5. Report (`packages/reporter`)

- The report model gains diff counts (`new`/`ongoing`/`resolved`) for the scan, derived from the issues' statuses.
- Add a localized **"Changes since last scan"** summary near the top of the report (after the score band / at-a-glance): the three counts, and — when there are resolved issues — a short list of what was resolved. When there is no baseline (first scan), the section is omitted or shows "first audit — no prior scan to compare."
- The honest-verification framing is unchanged; diff counts make no conformance claim.

## Data flow

```
server: getBaselineIssues(project, excludeRun)   = prior completed scan's issues
  → runScan({ …, baselineIssues })               (audit)
      → aggregateScanIssues(findings)            = current issues
      → diffScanIssues(current, baseline)        = { issues(new/ongoing), resolved, counts }
      → set finding.status from its issue status
      → report model ← diff.counts + resolved titles → "Changes" section
      → result.resolvedIssues = diff.resolved
  → server persists: issues (status via re-aggregation), resolved carry-over rows, findings (status carried)
  → web UI reads issues.status → badges + "since last scan" summary
```

## Testing

- **core/diff.test.ts** — table-driven: empty baseline → all new; overlapping keys → ongoing; baseline-only key → resolved (and appears in `resolved`); current-only key → new; counts correct; first-scan case.
- **server** — two sequential scans of one project through the real persistence path: assert the second scan's issues have correct `new`/`ongoing`, that a removed issue is persisted as a `resolved` row on the second run with zero findings, and the score ignores resolved. Assert a failed run is not used as a baseline. Assert first scan → all new.
- **web** — issue/scan-run rendering shows the right status badge; the "since last scan" summary counts render; resolved group shows.
- **report** — the Changes section renders the three counts in tr and en; omitted/first-audit case; no conformance claim.

## Out of scope (future)

- **`changed` status** — "same underlying issue, different selector/evidence" needs a coarse second-pass key (issueKey minus volatile element signature). Deferred; the schema/status field already accommodates it.
- Diffing against an arbitrary chosen baseline (only the immediately-previous completed scan is used).
- Ignore / waiver workflows, "Mark Resolved" manual action.
- Per-finding diff status independent of its issue.
- Trend history across more than two scans (sparklines, etc.).
