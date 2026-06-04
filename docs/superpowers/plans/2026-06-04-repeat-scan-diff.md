# Repeat-Scan Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label each issue `new`/`ongoing`/`resolved` by comparing a scan to the project's previous completed scan, persist it, and surface it in the web UI and the report.

**Architecture:** A pure `diffScanIssues` in `@a11yaudit/core` compares aggregated issues by `issueKey`. The server loads the previous completed scan's issues and passes them into `runScan`; the audit pipeline runs the diff (so the in-pipeline report reflects it), stamps each finding's `status`, and returns the resolved carry-over list; the server persists issue statuses (via re-aggregation) plus resolved rows. A new `status` column on `issues` stores it.

**Tech Stack:** TypeScript (ESM, explicit `.js` import extensions), Vitest, Drizzle + better-sqlite3, React/Vite.

**Conventions:** Run tests with `./node_modules/.bin/vitest`. Typecheck a package: `./node_modules/.bin/tsc -p <pkg>/tsconfig.json --noEmit`. Build a package: `npx pnpm@9 --filter <pkg> build`. Cross-package imports resolve to built `dist/` — after changing `core`, rebuild it before dependents typecheck/run: `npx pnpm@9 --filter ./packages/core build`. All paths from repo root `/Users/zasetsu/Documents/GitHub/WCAG`.

---

## File Structure

- **Create** `packages/core/src/diff.ts` — `DiffStatus`, `BaselineIssue`, `DiffResult`, `diffScanIssues` (pure).
- **Create** `packages/core/src/diff.test.ts`.
- **Modify** `packages/core/src/index.ts` — export `./diff.js`.
- **Modify** `apps/server/src/db/schema.ts` — add `status` to `issues`. Generated migration under `apps/server/drizzle/`.
- **Modify** `apps/server/src/repositories/issues.ts` — `getBaselineIssues` + `toBaselineIssue` mapper. Test alongside.
- **Modify** `packages/audit/src/scan-engine.ts` — `RunScanInput.baselineIssues`, diff wiring, finding `status`, `CompletedScanResult.resolvedIssues`, pass diff counts to the report model.
- **Modify** `apps/server/src/app.ts` — load baseline, pass to `runScan`, persist issue `status` + resolved rows.
- **Modify** `packages/reporter/src/report-model.ts` — `AuditReportModel.diffSummary`; `buildAuditReportModel` accepts it.
- **Modify** `packages/reporter/src/html-template.ts` — "Changes since last scan" section.
- **Modify** `packages/reporter/src/i18n.ts` — localized change strings.
- **Modify** `apps/web/src/data.ts` — `Issue.status`.
- **Modify** `apps/web/src/pages/scan-run-detail.tsx` — "since last scan" summary + resolved group.
- **Modify** `apps/web/src/i18n/messages.ts` — localized diff summary keys.

---

## Task 1: Core diff engine

**Files:**
- Create: `packages/core/src/diff.ts`
- Create: `packages/core/src/diff.test.ts`
- Modify: `packages/core/src/index.ts`

Context: `AggregatedIssue` (in `packages/core/src/issues.ts`) already has `issueKey: string`, `status: ScanFinding["status"]`, `occurrenceFingerprints: string[]`, and the descriptive fields. `FindingStatus` (in `models.ts`) is `"new" | "ongoing" | "resolved" | "changed"`.

- [ ] **Step 1: Write the failing test** `packages/core/src/diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diffScanIssues, type BaselineIssue } from "./diff.js";
import type { AggregatedIssue } from "./issues.js";

function issue(partial: Partial<AggregatedIssue> & { issueKey: string }): AggregatedIssue {
  return {
    id: partial.id ?? partial.issueKey,
    issueKey: partial.issueKey,
    title: partial.title ?? "Title",
    severity: "critical",
    status: "new",
    source: "axe",
    certainty: "automatic_violation",
    origin: "unknown",
    wcagCriteria: ["4.1.2"],
    ruleId: "button-name",
    description: "desc",
    recommendation: "rec",
    helpUrl: null,
    likelyScope: "global",
    urlScopeGroup: "/*",
    componentArea: "header",
    cmsHint: "none",
    elementSignature: "sig",
    affectedPages: 1,
    occurrences: 1,
    viewportSummary: "desktop",
    confidence: "high",
    representativeUrl: "https://x/",
    representativeSelector: null,
    representativeHtmlSnippet: null,
    sampleUrls: ["https://x/"],
    occurrenceFingerprints: ["fp"],
    occurrenceIds: ["oid"],
    ...partial
  } as AggregatedIssue;
}

function baseline(issueKey: string): BaselineIssue {
  return {
    issueKey, title: "Old " + issueKey, severity: "serious", source: "axe",
    certainty: "automatic_violation", ruleId: "r", wcagCriteria: ["1.1.1"],
    description: "d", recommendation: "rec", likelyScope: "global", urlScopeGroup: "/*",
    componentArea: "header", cmsHint: "none", confidence: "medium",
    affectedPages: 3, occurrences: 9, viewportSummary: "both",
    representativeUrl: "https://x/old", representativeSelector: null,
    representativeHtmlSnippet: null, sampleUrls: ["https://x/old"]
  };
}

describe("diffScanIssues", () => {
  it("labels every issue new when there is no baseline", () => {
    const result = diffScanIssues([issue({ issueKey: "a" }), issue({ issueKey: "b" })], []);
    expect(result.issues.map((i) => i.status)).toEqual(["new", "new"]);
    expect(result.resolved).toEqual([]);
    expect(result.counts).toEqual({ new: 2, ongoing: 0, resolved: 0 });
  });

  it("labels matching issueKeys ongoing and missing-from-baseline new", () => {
    const result = diffScanIssues([issue({ issueKey: "a" }), issue({ issueKey: "c" })], [baseline("a"), baseline("b")]);
    const byKey = new Map(result.issues.map((i) => [i.issueKey, i.status]));
    expect(byKey.get("a")).toBe("ongoing");
    expect(byKey.get("c")).toBe("new");
    expect(result.counts.new).toBe(1);
    expect(result.counts.ongoing).toBe(1);
  });

  it("returns baseline issues absent from current as resolved", () => {
    const result = diffScanIssues([issue({ issueKey: "a" })], [baseline("a"), baseline("b")]);
    expect(result.resolved.map((r) => r.issueKey)).toEqual(["b"]);
    expect(result.counts.resolved).toBe(1);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `./node_modules/.bin/vitest run packages/core/src/diff.test.ts` → cannot resolve `./diff.js`.

- [ ] **Step 3: Implement** `packages/core/src/diff.ts`:

```ts
import type { AggregatedIssue } from "./issues.js";
import type { FindingCertainty, FindingSource, Severity } from "./models.js";

export type DiffStatus = "new" | "ongoing" | "resolved";

// The minimal shape the diff needs from a prior-scan issue — also what we carry
// over when an issue is resolved.
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
  status: "new" | "ongoing";
}

export interface DiffResult {
  issues: DiffedIssue[];
  resolved: BaselineIssue[];
  counts: { new: number; ongoing: number; resolved: number };
}

export function diffScanIssues(current: AggregatedIssue[], baseline: BaselineIssue[]): DiffResult {
  const baselineKeys = new Set(baseline.map((b) => b.issueKey));
  const currentKeys = new Set(current.map((c) => c.issueKey));

  let newCount = 0;
  let ongoingCount = 0;
  const issues: DiffedIssue[] = current.map((issue) => {
    const status: "new" | "ongoing" = baselineKeys.has(issue.issueKey) ? "ongoing" : "new";
    if (status === "new") newCount += 1; else ongoingCount += 1;
    return { ...issue, status };
  });

  const resolved = baseline.filter((b) => !currentKeys.has(b.issueKey));

  return {
    issues,
    resolved,
    counts: { new: newCount, ongoing: ongoingCount, resolved: resolved.length }
  };
}
```

- [ ] **Step 4: Export it** — in `packages/core/src/index.ts` add `export * from "./diff.js";` after the `./issues.js` line.

- [ ] **Step 5: Run + typecheck** — `./node_modules/.bin/vitest run packages/core/src/diff.test.ts` → PASS (3 tests). `./node_modules/.bin/tsc -p packages/core/tsconfig.json --noEmit` → 0 errors. Then rebuild core so dependents see the export: `npx pnpm@9 --filter ./packages/core build`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/diff.ts packages/core/src/diff.test.ts packages/core/src/index.ts
git commit -m "feat(core): diffScanIssues — issue-level new/ongoing/resolved diff"
```

---

## Task 2: Add `status` column to the `issues` table

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Generated: `apps/server/drizzle/*` (migration)

- [ ] **Step 1: Add the column.** In `apps/server/src/db/schema.ts`, in the `issues = sqliteTable("issues", { … })` definition, add a `status` field right after `issueKey`:

```ts
  issueKey: text("issue_key").notNull(),
  status: text("status").notNull().default("new"),
```

- [ ] **Step 2: Generate the migration**

Run: `npx pnpm@9 --filter @a11yaudit/server db:generate`
Expected: a new file under `apps/server/drizzle/` adding `status` to `issues`. Open it and confirm it is `ALTER TABLE \`issues\` ADD \`status\` text DEFAULT 'new' NOT NULL;` (or Drizzle's table-rebuild equivalent). If `db:generate` prompts interactively, accept the additive change.

- [ ] **Step 3: Verify boot applies it.** Confirm `initializeDb` (in `apps/server/src/db/`) applies migrations on boot (it already does for the existing schema). No code change expected; just verify by building the server: `npx pnpm@9 --filter @a11yaudit/server build` → Done.

- [ ] **Step 4: Run server tests to confirm schema still loads** — `./node_modules/.bin/vitest run apps/server` → PASS (existing tests; `mapIssueRow` now carries `status` automatically via `$inferSelect`).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/drizzle
git commit -m "feat(server): add status column to issues table (+ migration)"
```

---

## Task 3: Baseline repository function

**Files:**
- Modify: `apps/server/src/repositories/issues.ts`
- Create: `apps/server/src/repositories/issues.baseline.test.ts`

Context: `IssueRow = typeof issues.$inferSelect` (now includes `status`). The table stores `wcagCriteria` as CSV and `sampleUrls` as JSON.

- [ ] **Step 1: Write the failing test** `apps/server/src/repositories/issues.baseline.test.ts`. Use the project's existing in-memory/test DB helper — look at `apps/server/src/app.test.ts` or any `*.test.ts` in `repositories/` for how a test DB is created (`createDbClient`/`initializeDb` with `:memory:` or a temp path), and mirror it. The test seeds a project + two completed scan runs (older + newer) each with an issue, then asserts:

```ts
// pseudo-structure — adapt seeding to the repo's test-DB helper
import { describe, expect, it } from "vitest";
import { getBaselineIssues } from "./issues.js";
// + the test DB + schema inserts used elsewhere in apps/server tests

describe("getBaselineIssues", () => {
  it("returns issues of the most recent completed scan, excluding the given run", () => {
    // seed: project P; scanRun S1 (completed, finished earlier) with issue key 'k1';
    //       scanRun S2 (completed, finished later) with issue key 'k2'
    const baseline = getBaselineIssues(db, { projectId: "P", excludeScanRunId: "S3" });
    expect(baseline.map((b) => b.issueKey)).toEqual(["k2"]); // newest completed
  });

  it("excludes the current run and returns [] when it is the only completed scan", () => {
    const baseline = getBaselineIssues(db, { projectId: "P", excludeScanRunId: "S2" });
    // only S1 completed besides S2 -> returns S1's issues; if S2 is the only one -> []
    expect(Array.isArray(baseline)).toBe(true);
  });

  it("never returns a failed run as baseline", () => {
    // seed a failed scanRun newer than the completed one -> baseline still the completed one
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `getBaselineIssues` not exported.

- [ ] **Step 3: Implement.** In `apps/server/src/repositories/issues.ts`, add the import of `BaselineIssue` and the function. Note `db.select(...).get()`/`.all()` are synchronous (better-sqlite3), matching the existing `getIssueForWorkspace`. Add:

```ts
import type { BaselineIssue } from "@a11yaudit/core";

function toBaselineIssue(row: IssueRow): BaselineIssue {
  return {
    issueKey: row.issueKey,
    title: row.title,
    severity: row.severity as BaselineIssue["severity"],
    source: row.source as BaselineIssue["source"],
    certainty: row.certainty as BaselineIssue["certainty"],
    ruleId: row.ruleId,
    wcagCriteria: row.wcagCriteria.split(",").map((c) => c.trim()).filter(Boolean),
    description: row.description,
    recommendation: row.recommendation,
    likelyScope: row.likelyScope,
    urlScopeGroup: row.urlScopeGroup,
    componentArea: row.componentArea,
    cmsHint: row.cmsHint,
    confidence: row.confidence as BaselineIssue["confidence"],
    affectedPages: row.affectedPages,
    occurrences: row.occurrences,
    viewportSummary: row.viewportSummary,
    representativeUrl: row.representativeUrl,
    representativeSelector: row.representativeSelector,
    representativeHtmlSnippet: row.representativeHtmlSnippet,
    sampleUrls: parseSampleUrls(row.sampleUrls)
  };
}

export function getBaselineIssues(
  db: SqliteDatabase,
  params: { projectId: string; excludeScanRunId: string }
): BaselineIssue[] {
  const priorRun = db
    .select({ id: scanRuns.id })
    .from(scanRuns)
    .where(and(
      eq(scanRuns.projectId, params.projectId),
      eq(scanRuns.status, "completed"),
      ne(scanRuns.id, params.excludeScanRunId)
    ))
    .orderBy(desc(scanRuns.finishedAt))
    .limit(1)
    .get();

  if (priorRun === undefined) {
    return [];
  }

  return db
    .select({ issue: issues })
    .from(issues)
    .where(eq(issues.scanRunId, priorRun.id))
    .all()
    .map((row) => toBaselineIssue(row.issue));
}
```

Add `ne` to the existing `drizzle-orm` import (`import { and, desc, eq, ne, type SQL } from "drizzle-orm";`).

- [ ] **Step 4: Run + typecheck** — `./node_modules/.bin/vitest run apps/server/src/repositories/issues.baseline.test.ts` → PASS. `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/repositories/issues.ts apps/server/src/repositories/issues.baseline.test.ts
git commit -m "feat(server): getBaselineIssues — prior completed scan's issues, project-scoped"
```

---

## Task 4: Diff in the scan pipeline (audit)

**Files:**
- Modify: `packages/audit/src/scan-engine.ts`
- Test: `packages/audit/src/scan-engine.test.ts` (add a case)

Context: `runScan` runs the audit loop, then calls `storeReports(input, { score, pages, findings })`, then returns a `CompletedScanResult`. The report model is built inside `storeReports` via `buildAuditReportModel`. `aggregateScanIssues(findings, { auditedPages })` is in `@a11yaudit/core`.

- [ ] **Step 1: Read the current file.** Read `packages/audit/src/scan-engine.ts` — locate (a) the `RunScanInput` interface, (b) the `CompletedScanResult` import/type (it lives in `@a11yaudit/core` models — find its definition), (c) where `runScan` assembles its returned object (the `return { runId, …, reportWarnings, score, … }`), and (d) the `storeReports` function and its `buildAuditReportModel` call.

- [ ] **Step 2: Extend the input type.** In `RunScanInput` add:

```ts
  baselineIssues?: import("@a11yaudit/core").BaselineIssue[];
```

(or add `BaselineIssue` to the existing `@a11yaudit/core` import and use `baselineIssues?: BaselineIssue[];`).

- [ ] **Step 3: Compute the diff + stamp finding status in `runScan`.** After the audit loop produces `findings` and `pages` and before/around `storeReports`, add:

```ts
import { aggregateScanIssues, diffScanIssues, type BaselineIssue } from "@a11yaudit/core";

// … after findings are collected, before storeReports:
const currentIssues = aggregateScanIssues(findings, { auditedPages: pages });
const diff = diffScanIssues(currentIssues, input.baselineIssues ?? []);

// map every occurrence fingerprint to its issue's diff status
const statusByFingerprint = new Map<string, "new" | "ongoing">();
for (const issue of diff.issues) {
  for (const fp of issue.occurrenceFingerprints) {
    if (fp) statusByFingerprint.set(fp, issue.status);
  }
}
// stamp each finding's status (default "new" if somehow unmapped)
const diffedFindings = findings.map((f) => ({ ...f, status: statusByFingerprint.get(f.fingerprint) ?? "new" as const }));
```

Use `diffedFindings` from here on (pass to `storeReports`, include in the returned result) so persisted findings carry the diff status. (If `findings` is a `const` array built incrementally, introduce `diffedFindings` and thread it through the rest of `runScan`.)

- [ ] **Step 4: Pass diff summary to the report + return resolved issues.**
  - Change `storeReports`'s `reportInput` to also accept `diffSummary`: update its signature to `reportInput: { score: number; pages: AuditedPage[]; findings: ScanFinding[]; diffSummary: { counts: { new: number; ongoing: number; resolved: number }; resolvedTitles: string[]; hasBaseline: boolean } }`, and pass `diffSummary` into `buildAuditReportModel({ …, diffSummary: reportInput.diffSummary })`.
  - At the `storeReports(input, { … })` call in `runScan`, pass:

```ts
const { reports, reportWarnings } = await storeReports(input, {
  score,
  pages,
  findings: diffedFindings,
  diffSummary: {
    counts: diff.counts,
    resolvedTitles: diff.resolved.map((r) => r.title),
    hasBaseline: (input.baselineIssues ?? []).length > 0
  }
});
```

  - In `runScan`'s returned object, use `findings: diffedFindings` and add `resolvedIssues: diff.resolved`.

- [ ] **Step 5: Extend `CompletedScanResult`.** It is defined in `packages/core/src/models.ts:102`. Add `resolvedIssues: BaselineIssue[];` to that interface, with `import type { BaselineIssue } from "./diff.js";` at the top (type-only import — `diff.ts` imports types from `models.ts`, so a value import would create a runtime cycle; `import type` is erased and safe). Rebuild core afterward.

- [ ] **Step 6: Add an audit test** in `packages/audit/src/scan-engine.test.ts`. Find an existing test that runs a small scan against the fixture server and inspects the result. Add a case that passes `baselineIssues` containing one `issueKey` that will NOT appear in the new scan, and asserts: `result.resolvedIssues` contains that issue, and `result.findings.every(f => f.status === "new" || f.status === "ongoing")`. (Mirror the existing test's scan setup; keep it minimal.)

- [ ] **Step 7: Build + test** — `npx pnpm@9 --filter ./packages/core build` (for the `CompletedScanResult` change), then `./node_modules/.bin/tsc -p packages/audit/tsconfig.json --noEmit` → 0 errors, `./node_modules/.bin/vitest run packages/audit` → PASS, then `npx pnpm@9 --filter ./packages/audit build`.

- [ ] **Step 8: Commit**

```bash
git add packages/audit/src/scan-engine.ts packages/audit/src/scan-engine.test.ts packages/core/src/models.ts
git commit -m "feat(audit): diff scan issues against baseline, stamp finding status, return resolved"
```

---

## Task 5: Report model + "Changes" section

**Files:**
- Modify: `packages/reporter/src/report-model.ts`
- Modify: `packages/reporter/src/html-template.ts`
- Modify: `packages/reporter/src/i18n.ts`
- Modify: `packages/reporter/src/html-template.test.ts`

- [ ] **Step 1: Extend the report model.** In `report-model.ts` add to `AuditReportModel`:

```ts
  diffSummary?: { counts: { new: number; ongoing: number; resolved: number }; resolvedTitles: string[]; hasBaseline: boolean };
```

and in `buildAuditReportModel`'s input + returned object thread `diffSummary` through (the function takes an input object and returns the model; add `diffSummary?: …` to the input type and `diffSummary: input.diffSummary` to the returned object).

- [ ] **Step 2: Add localized strings.** In `packages/reporter/src/i18n.ts`, add to the `ReportStrings` interface and BOTH locales:

```ts
  changesTitle: string;        // tr: "Geçen taramadan beri değişiklikler" / en: "Changes since last scan"
  changesNew: string;          // tr: "yeni" / en: "new"
  changesOngoing: string;      // tr: "devam eden" / en: "ongoing"
  changesResolved: string;     // tr: "çözüldü" / en: "resolved"
  changesResolvedList: string; // tr: "Çözülen sorunlar" / en: "Resolved issues"
  changesFirstAudit: string;   // tr: "İlk denetim — karşılaştırılacak önceki tarama yok." / en: "First audit — no prior scan to compare."
```

- [ ] **Step 2b: Run the reporter i18n test** if one asserts key parity (`packages/reporter/src/i18n.test.ts`) — `./node_modules/.bin/vitest run packages/reporter/src/i18n.test.ts`. Keep both locales in sync.

- [ ] **Step 3: Render the section.** In `html-template.ts`, in `renderReportHtml`, after the "AT A GLANCE" block and before "FIX THESE FIRST", insert a Changes block. Add a helper and call it:

```ts
function renderChanges(report: AuditReportModel, strings: ReportStrings): string {
  const d = report.diffSummary;
  if (!d) return "";
  if (!d.hasBaseline) {
    return `<h2>${escapeHtml(strings.changesTitle)}</h2><p>${escapeHtml(strings.changesFirstAudit)}</p>`;
  }
  const resolvedList = d.resolvedTitles.length > 0
    ? `<div class="block"><b>${escapeHtml(strings.changesResolvedList)} (${d.counts.resolved})</b><ul>${
        d.resolvedTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join("")
      }</ul></div>`
    : "";
  return `<h2>${escapeHtml(strings.changesTitle)}</h2>
    <p>${d.counts.new} ${escapeHtml(strings.changesNew)} · ${d.counts.ongoing} ${escapeHtml(strings.changesOngoing)} · ${d.counts.resolved} ${escapeHtml(strings.changesResolved)}</p>
    ${resolvedList}`;
}
```

and insert `${renderChanges(report, strings)}` in the body between the at-a-glance `</table>` and the `<!-- FIX THESE FIRST -->` heading.

- [ ] **Step 4: Add a template test** in `html-template.test.ts`: render a model with `diffSummary: { counts: { new: 2, ongoing: 3, resolved: 1 }, resolvedTitles: ["Old issue"], hasBaseline: true }, locale: "tr"` and assert the html contains `"Geçen taramadan beri"`, `"2"`, `"çözüldü"`, and `"Old issue"`. Add a second asserting `hasBaseline: false` renders `"İlk denetim"`. Add an `en` assertion for `"Changes since last scan"`.

- [ ] **Step 5: Build + test** — `./node_modules/.bin/tsc -p packages/reporter/tsconfig.json --noEmit` → 0, `./node_modules/.bin/vitest run packages/reporter` → PASS, then `npx pnpm@9 --filter ./packages/reporter build`.

- [ ] **Step 6: Commit**

```bash
git add packages/reporter/src/report-model.ts packages/reporter/src/html-template.ts packages/reporter/src/i18n.ts packages/reporter/src/html-template.test.ts
git commit -m "feat(reporter): Changes-since-last-scan summary section (tr/en)"
```

---

## Task 6: Persist diff in the server

**Files:**
- Modify: `apps/server/src/app.ts`
- Test: `apps/server/src/app.test.ts` (add a two-scan case)

Context: the `execute` handler calls `runScan({ request, storage, onProgress })` then a transaction inserts issues/findings/reports. `aggregateScanIssues(result.findings, …)` builds `issueRows`. After Task 4, `result.findings` carry `status`, and `result.resolvedIssues` is the resolved carry-over list.

- [ ] **Step 1: Load baseline + pass into runScan.** In `app.ts`, before `const result = await runScan({…})`, add:

```ts
const baselineIssues = getBaselineIssues(dbClient.db, {
  projectId: job.payload.projectId,
  excludeScanRunId: job.id
});
```

and add `baselineIssues,` to the `runScan({ … })` argument object. Import `getBaselineIssues` from `./repositories/issues.js`.

- [ ] **Step 2: Persist issue status.** In the transaction's `issueRows` mapping, add `status: issue.status,` (the aggregated `issue` now has the diff status because it was derived from the diffed findings). The findings mapping already sets `status: finding.status` — leave it.

- [ ] **Step 3: Insert resolved carry-over rows.** Immediately after the current `issueRows` insert loop, add:

```ts
if (result.resolvedIssues.length > 0) {
  const resolvedRows = result.resolvedIssues.map((r, index) => ({
    id: `${result.runId}-resolved-${index}`,
    projectId,
    scanRunId: result.runId,
    issueKey: r.issueKey,
    status: "resolved" as const,
    title: r.title,
    severity: r.severity,
    source: r.source,
    certainty: r.certainty,
    ruleId: r.ruleId,
    wcagCriteria: r.wcagCriteria.join(","),
    description: r.description,
    recommendation: r.recommendation,
    likelyScope: r.likelyScope,
    urlScopeGroup: r.urlScopeGroup,
    componentArea: r.componentArea,
    cmsHint: r.cmsHint,
    confidence: r.confidence,
    affectedPages: r.affectedPages,
    occurrences: r.occurrences,
    viewportSummary: r.viewportSummary,
    representativeUrl: r.representativeUrl,
    representativeSelector: r.representativeSelector,
    representativeHtmlSnippet: r.representativeHtmlSnippet,
    sampleUrls: JSON.stringify(r.sampleUrls),
    createdAt: completedAt
  }));
  for (const chunk of chunkArray(resolvedRows, 200)) {
    tx.insert(issues).values(chunk).run();
  }
}
```

(Match the exact column set of the current `issueRows` objects — read them in the file; resolved rows must supply every NOT NULL column the table requires, with `status: "resolved"` and no findings.)

- [ ] **Step 4: Add a two-scan integration test** in `app.test.ts`. Mirror the existing scan-completion test setup. Drive two scans of the same project where the second scan's findings drop one issue and keep another and add a new one. Assert, by reading `issues` for the second run:
  - the kept issue has `status: "ongoing"`,
  - the added issue has `status: "new"`,
  - a row exists with `status: "resolved"` for the dropped issue's `issueKey` and the run has it,
  - the score reflects only current findings (resolved row did not change it).
  Also assert the first scan's issues are all `"new"`.

- [ ] **Step 5: Build + test** — `npx pnpm@9 --filter @a11yaudit/audit build` and `npx pnpm@9 --filter @a11yaudit/core build` are already done; `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → 0, `./node_modules/.bin/vitest run apps/server` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/app.ts apps/server/src/app.test.ts
git commit -m "feat(server): persist issue diff status + resolved carry-over rows"
```

---

## Task 7: Web UI — status surfacing

**Files:**
- Modify: `apps/web/src/data.ts`
- Modify: `apps/web/src/pages/scan-run-detail.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Test: `apps/web/src/pages/scan-run-detail` is exercised indirectly; add focused assertions if a test renders it.

Context: `Issue` (web `data.ts`) lacks `status`; the server now returns it. `StatusBadge` (in `design/ui.tsx`) already renders `new`/`ongoing`/`resolved`. The scan-run-detail page lists `scanIssues` (issues with `scanRunId === run.id`).

- [ ] **Step 1: Add `status` to the web `Issue` type.** In `apps/web/src/data.ts`, in `interface Issue`, add `status: FindingStatus;` (the file already imports/defines `FindingStatus = "new" | "ongoing" | "resolved"`). Confirm `apps/web/src/api/client.ts`'s `ServerIssue` mapping passes `status` through (it spreads server fields; if it explicitly lists fields, add `status`). If demo issues in `data.ts` need the field to typecheck, add `status: "new"` to each demo `Issue`.

- [ ] **Step 2: Add localized summary keys.** In `apps/web/src/i18n/messages.ts` add to the `Messages` interface and BOTH locales (keep parity — the `messages.test.ts` parity test enforces it):

```ts
  "run.sinceLastScan": string;   // tr "Geçen taramadan beri" / en "Since last scan"
  "run.statusNew": string;       // tr "yeni" / en "new"
  "run.statusOngoing": string;   // tr "devam eden" / en "ongoing"
  "run.statusResolved": string;  // tr "çözüldü" / en "resolved"
  "run.resolvedGroup": string;   // tr "Çözülen sorunlar" / en "Resolved issues"
```

- [ ] **Step 3: Render the summary + split resolved.** In `scan-run-detail.tsx`, after computing `scanIssues`, derive counts and split:

```tsx
const counts = { new: 0, ongoing: 0, resolved: 0 };
for (const i of scanIssues) {
  if (i.status === "new") counts.new += 1;
  else if (i.status === "ongoing") counts.ongoing += 1;
  else if (i.status === "resolved") counts.resolved += 1;
}
const resolvedIssues = scanIssues.filter((i) => i.status === "resolved");
const openIssues = scanIssues.filter((i) => i.status !== "resolved");
```

Add a summary line under the run summary panel:

```tsx
<div className="kv"><span>{t("run.sinceLastScan")}</span><strong>{counts.new} {t("run.statusNew")} · {counts.ongoing} {t("run.statusOngoing")} · {counts.resolved} {t("run.statusResolved")}</strong></div>
```

In the "related issues" panel, render `openIssues` instead of `scanIssues`, and add each issue's `<StatusBadge status={issue.status} />` to its row (import `StatusBadge` from `../design/ui`). Add a separate "Resolved issues" group rendering `resolvedIssues` (titles only — they have no findings to drill into) when non-empty, labeled `t("run.resolvedGroup")`.

- [ ] **Step 4: Verify** — `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` → 0 errors; `./node_modules/.bin/vitest run apps/web` → PASS (catalog parity holds with the new keys in both locales).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data.ts apps/web/src/pages/scan-run-detail.tsx apps/web/src/i18n/messages.ts
git commit -m "feat(web): show issue diff status + since-last-scan summary on scan-run detail"
```

---

## Task 8: Full suite + verification

- [ ] **Step 1: Rebuild everything** — `npx pnpm@9 -r build` → all Done, no errors.
- [ ] **Step 2: Full test suite** — `./node_modules/.bin/vitest run` → all PASS. Report counts.
- [ ] **Step 3: Manual smoke (optional, note for the user):** scan a site twice; the second run's scan-run detail shows "since last scan" counts and resolved group; the report shows the "Changes" section.

---

## Notes for the implementer

- **DRY:** `BaselineIssue` is defined once in `packages/core/src/diff.ts` and reused everywhere (server mapper, audit input, result). Never redefine it.
- **Status flows via findings:** the audit pipeline stamps `finding.status`; the server's `aggregateScanIssues(result.findings)` then yields issues with the right `status` automatically (`issue.status = first.status`). Do not add a parallel status channel for current issues — only resolved issues need explicit rows.
- **Resolved rows have no findings/evidence** — they exist purely to record "this was fixed." They must still satisfy every NOT NULL column on `issues`.
- **Score is untouched** — it derives from current findings; resolved issues (zero findings) never change it. Do not wire status into scoring.
- **Graceful baseline failure:** if `getBaselineIssues` throws, treat as `[]` (all new) rather than failing the scan — wrap the call in the server if needed.
- **First scan:** empty baseline → all `new`, no resolved, report shows the "first audit" line.
