# Grouped Issue Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw finding-first reporting with grouped accessibility issues while preserving raw occurrence traceability.

**Architecture:** Add issue aggregation to `packages/core`, persist grouped issues beside raw occurrence rows in `apps/server`, expose issue-first API endpoints, and update reporter/UI surfaces to display Unique Issues, Affected Pages, and Total Occurrences. Keep existing raw findings as occurrence data during the first implementation to avoid a destructive migration.

**Tech Stack:** TypeScript monorepo, Vitest, Fastify, Drizzle ORM, SQLite, React, TanStack Query, Playwright-based audit/report generation.

---

## File Structure

Create:

- `packages/core/src/issues.ts` — grouped issue types, URL scope inference, component area inference, CMS hint inference, issue key generation, and aggregation.
- `packages/core/src/issues.test.ts` — unit coverage for grouping and inference behavior.
- `apps/server/src/routes/issues.ts` — issue-first API endpoints.
- `apps/web/src/pages/issues.test.ts` — UI presentation helper tests for issue sorting/labels if helpers are extracted.

Modify:

- `packages/core/src/index.ts` — export issue aggregation API.
- `packages/core/src/models.ts` — add grouped issue and confidence types if not kept entirely in `issues.ts`.
- `packages/audit/src/scan-engine.ts` — aggregate issues for reports and preserve report generation behavior.
- `packages/reporter/src/report-model.ts` — add grouped issue fields to the report model.
- `packages/reporter/src/html-template.ts` — render grouped issues as the primary report table.
- `packages/reporter/src/html-template.test.ts` — assert compact issue-first reports.
- `apps/server/src/db/schema.ts` — add `issues` table and optional `issue_id` on raw findings.
- `apps/server/src/db/client.ts` — create/migrate issue schema.
- `apps/server/src/app.ts` — persist issues before report completion; keep raw findings chunked.
- `apps/server/src/app.test.ts` — verify issue persistence, failed PDF behavior, and issue APIs.
- `apps/server/src/routes/findings.ts` — keep existing raw finding endpoint behavior stable.
- `apps/server/src/routes/projects.ts` — expose issue count and occurrence totals in project summaries.
- `apps/server/src/routes/scans.ts` — ensure scan response naming remains backward-compatible while adding issue totals.
- `apps/server/src/index.ts` or app bootstrap if route registration is centralized in `app.ts`.
- `apps/web/src/data.ts` — add `Issue` type and demo issue fixtures.
- `apps/web/src/api/client.ts` — fetch issue endpoints and map issue totals.
- `apps/web/src/api/client.test.ts` — assert issue API mapping.
- `apps/web/src/app.tsx` — load issues and route issue detail/list views.
- `apps/web/src/pages/findings.tsx` — convert default list to grouped issues or create a new issue-first page while preserving labels.
- `apps/web/src/pages/finding-detail.tsx` — convert detail to grouped issue detail with sample occurrences.
- `apps/web/src/pages/overview.tsx` — replace finding-first metrics with Unique Issues and Total Occurrences.
- `apps/web/src/pages/scan-runs.tsx` — show occurrence totals without calling them unique findings.
- `apps/web/src/pages/reports.tsx` — no major model change, but verify labels remain report-focused.
- `README.md` — update terminology after implementation.

---

### Task 1: Core Grouping Model and Inference

**Files:**
- Create: `packages/core/src/issues.ts`
- Create: `packages/core/src/issues.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests for URL scope, component area, CMS hints, and aggregation**

Create `packages/core/src/issues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  aggregateScanIssues,
  createIssueKey,
  inferCmsHint,
  inferComponentArea,
  inferUrlScope
} from "./issues.js";
import type { ScanFinding } from "./models.js";

function finding(overrides: Partial<ScanFinding>): ScanFinding {
  return {
    id: "finding-1",
    title: "Buttons must have discernible text",
    severity: "critical",
    status: "new",
    source: "axe",
    certainty: "automatic_violation",
    origin: "unknown",
    wcagCriteria: ["4.1.2"],
    ruleId: "button-name",
    description: "Ensures buttons have discernible text",
    recommendation: "Add an accessible name.",
    pageUrl: "https://example.com/haberler/a",
    viewport: "desktop",
    selector: "aside .elementor-widget-button a",
    htmlSnippet: "<aside><div class=\"elementor-widget-button\"><a></a></div></aside>",
    visibleText: null,
    helpUrl: "https://dequeuniversity.com/rules/axe/button-name",
    fingerprint: "raw-fingerprint",
    evidence: [],
    instances: 1,
    ...overrides
  };
}

describe("issue inference", () => {
  it("infers first-segment URL groups", () => {
    expect(inferUrlScope("https://example.com/haberler/a", 5)).toEqual({
      scope: "URL group /haberler/*",
      groupKey: "/haberler/*"
    });
    expect(inferUrlScope("https://example.com/", 5)).toEqual({
      scope: "global",
      groupKey: "/"
    });
    expect(inferUrlScope("https://example.com/iletisim", 1)).toEqual({
      scope: "single page",
      groupKey: "/iletisim"
    });
  });

  it("infers component area from selector and html snippet", () => {
    expect(inferComponentArea("header nav button", "<button></button>")).toBe("header");
    expect(inferComponentArea(".sidebar a", "<aside><a></a></aside>")).toBe("aside");
    expect(inferComponentArea(".cta a", "<a></a>")).toBe("unknown");
  });

  it("infers Elementor and WordPress hints without requiring them", () => {
    expect(inferCmsHint(".elementor-widget-button a", "<a></a>")).toBe("Elementor widget button");
    expect(inferCmsHint(".content", "<body class=\"single-post post-template-default\"></body>")).toBe("WordPress single post");
    expect(inferCmsHint(".content", "<main></main>")).toBe("none");
  });

  it("creates issue keys without full URL or viewport", () => {
    const desktop = createIssueKey({
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "aside .elementor-widget-button a",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button"
    });
    const mobile = createIssueKey({
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "aside .elementor-widget-button a",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button"
    });

    expect(desktop).toBe(mobile);
    expect(desktop).not.toContain("https://example.com/haberler/a");
    expect(desktop).not.toContain("desktop");
  });
});

describe("aggregateScanIssues", () => {
  it("groups repeated template occurrences into one issue", () => {
    const issues = aggregateScanIssues([
      finding({ id: "occurrence-1", pageUrl: "https://example.com/haberler/a", viewport: "desktop" }),
      finding({ id: "occurrence-2", pageUrl: "https://example.com/haberler/a", viewport: "mobile" }),
      finding({ id: "occurrence-3", pageUrl: "https://example.com/haberler/b", viewport: "desktop" }),
      finding({ id: "occurrence-4", pageUrl: "https://example.com/haberler/b", viewport: "mobile" })
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: "Buttons must have discernible text",
      likelyScope: "URL group /haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button",
      affectedPages: 2,
      occurrences: 4,
      viewportSummary: "desktop,mobile",
      confidence: "medium"
    });
    expect(issues[0]?.sampleUrls).toEqual([
      "https://example.com/haberler/a",
      "https://example.com/haberler/b"
    ]);
  });
});
```

- [ ] **Step 2: Run the core issue test and verify it fails**

Run:

```bash
rtk npm exec pnpm@9 -- test packages/core/src/issues.test.ts
```

Expected: FAIL because `packages/core/src/issues.ts` does not exist and `./issues.js` cannot be resolved.

- [ ] **Step 3: Implement the core issue model and aggregation**

Create `packages/core/src/issues.ts`:

```ts
import { createHash } from "node:crypto";
import type { FindingCertainty, FindingSource, ScanFinding, Severity, ViewportName } from "./models.js";

export type IssueConfidence = "high" | "medium" | "low";
export type ComponentArea = "header" | "footer" | "nav" | "aside" | "form" | "main" | "unknown";
export type CmsHint =
  | "Elementor widget button"
  | "Elementor nav menu"
  | "Elementor form"
  | "WordPress single post"
  | "WordPress archive/category"
  | "WordPress post template"
  | "none";
export type ViewportSummary = ViewportName | "desktop,mobile";

export interface UrlScopeInference {
  scope: string;
  groupKey: string;
}

export interface IssueKeyInput {
  ruleId: string;
  wcagCriteria: string[];
  elementSignature: string;
  urlScopeGroup: string;
  componentArea: ComponentArea;
  cmsHint: CmsHint;
}

export interface AggregatedIssue {
  id: string;
  issueKey: string;
  title: string;
  severity: Severity;
  source: FindingSource;
  certainty: FindingCertainty;
  wcagCriteria: string[];
  ruleId: string;
  description: string;
  recommendation: string;
  likelyScope: string;
  urlScopeGroup: string;
  componentArea: ComponentArea;
  cmsHint: CmsHint;
  confidence: IssueConfidence;
  affectedPages: number;
  occurrences: number;
  viewportSummary: ViewportSummary;
  representativeUrl: string;
  representativeSelector: string | null;
  representativeHtmlSnippet: string | null;
  sampleUrls: string[];
  occurrenceFingerprints: string[];
}

export function inferUrlScope(url: string, groupSize: number): UrlScopeInference {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { scope: "global", groupKey: "/" };
  if (groupSize <= 1) return { scope: "single page", groupKey: `/${segments.join("/")}` };

  const groupKey = `/${segments[0]}/*`;
  return { scope: `URL group ${groupKey}`, groupKey };
}

export function inferComponentArea(selector: string | null, htmlSnippet: string | null): ComponentArea {
  const haystack = `${selector ?? ""} ${htmlSnippet ?? ""}`.toLowerCase();
  if (haystack.includes("elementor-location-header") || haystack.includes("header")) return "header";
  if (haystack.includes("elementor-location-footer") || haystack.includes("footer")) return "footer";
  if (haystack.includes("nav")) return "nav";
  if (haystack.includes("aside")) return "aside";
  if (haystack.includes("form")) return "form";
  if (haystack.includes("main")) return "main";
  return "unknown";
}

export function inferCmsHint(selector: string | null, htmlSnippet: string | null): CmsHint {
  const haystack = `${selector ?? ""} ${htmlSnippet ?? ""}`.toLowerCase();
  if (haystack.includes("elementor-widget-button")) return "Elementor widget button";
  if (haystack.includes("elementor-widget-nav-menu")) return "Elementor nav menu";
  if (haystack.includes("elementor-widget-form")) return "Elementor form";
  if (haystack.includes("single-post")) return "WordPress single post";
  if (haystack.includes("archive") || haystack.includes("category")) return "WordPress archive/category";
  if (haystack.includes("post-template")) return "WordPress post template";
  return "none";
}

export function createIssueKey(input: IssueKeyInput): string {
  return [
    input.ruleId,
    [...input.wcagCriteria].sort().join(","),
    normalizeElementSignature(input.elementSignature),
    input.urlScopeGroup,
    input.componentArea,
    input.cmsHint
  ].join("|");
}

export function aggregateScanIssues(findings: ScanFinding[]): AggregatedIssue[] {
  const urlGroupSizes = countUrlGroups(findings.map((finding) => finding.pageUrl));
  const grouped = new Map<string, ScanFinding[]>();

  for (const finding of findings) {
    const scope = inferUrlScope(finding.pageUrl, urlGroupSizes.get(firstSegmentGroup(finding.pageUrl)) ?? 1);
    const componentArea = inferComponentArea(finding.selector, finding.htmlSnippet);
    const cmsHint = inferCmsHint(finding.selector, finding.htmlSnippet);
    const issueKey = createIssueKey({
      ruleId: finding.ruleId,
      wcagCriteria: finding.wcagCriteria,
      elementSignature: finding.selector ?? finding.htmlSnippet ?? finding.title,
      urlScopeGroup: scope.groupKey,
      componentArea,
      cmsHint
    });
    grouped.set(issueKey, [...(grouped.get(issueKey) ?? []), finding]);
  }

  return [...grouped.entries()].map(([issueKey, occurrences]) => buildAggregatedIssue(issueKey, occurrences, urlGroupSizes));
}

function buildAggregatedIssue(issueKey: string, occurrences: ScanFinding[], urlGroupSizes: Map<string, number>): AggregatedIssue {
  const representative = occurrences[0];
  if (!representative) {
    throw new Error("Cannot aggregate an empty issue group");
  }

  const groupSize = urlGroupSizes.get(firstSegmentGroup(representative.pageUrl)) ?? 1;
  const scope = inferUrlScope(representative.pageUrl, groupSize);
  const affectedPageSet = new Set(occurrences.map((finding) => normalizeUrlForCounting(finding.pageUrl)));
  const viewportSet = new Set(occurrences.map((finding) => finding.viewport));
  const componentArea = inferComponentArea(representative.selector, representative.htmlSnippet);
  const cmsHint = inferCmsHint(representative.selector, representative.htmlSnippet);
  const confidence = inferConfidence(affectedPageSet.size, groupSize);

  return {
    id: `issue-${createHash("sha256").update(issueKey).digest("base64url").slice(0, 24)}`,
    issueKey,
    title: representative.title,
    severity: representative.severity,
    source: representative.source,
    certainty: representative.certainty,
    wcagCriteria: representative.wcagCriteria,
    ruleId: representative.ruleId,
    description: representative.description,
    recommendation: representative.recommendation,
    likelyScope: scope.scope,
    urlScopeGroup: scope.groupKey,
    componentArea,
    cmsHint,
    confidence,
    affectedPages: affectedPageSet.size,
    occurrences: occurrences.reduce((sum, finding) => sum + finding.instances, 0),
    viewportSummary: summarizeViewports(viewportSet),
    representativeUrl: representative.pageUrl,
    representativeSelector: representative.selector,
    representativeHtmlSnippet: representative.htmlSnippet,
    sampleUrls: [...new Set(occurrences.map((finding) => finding.pageUrl))].slice(0, 5),
    occurrenceFingerprints: occurrences.map((finding) => finding.fingerprint)
  };
}

function countUrlGroups(urls: string[]): Map<string, number> {
  const groups = new Map<string, Set<string>>();
  for (const url of urls) {
    const group = firstSegmentGroup(url);
    groups.set(group, (groups.get(group) ?? new Set()).add(normalizeUrlForCounting(url)));
  }
  return new Map([...groups.entries()].map(([group, values]) => [group, values.size]));
}

function firstSegmentGroup(url: string): string {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments.length === 0 ? "/" : `/${segments[0]}/*`;
}

function normalizeUrlForCounting(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}

function normalizeElementSignature(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function summarizeViewports(viewports: Set<ViewportName>): ViewportSummary {
  if (viewports.has("desktop") && viewports.has("mobile")) return "desktop,mobile";
  return viewports.has("mobile") ? "mobile" : "desktop";
}

function inferConfidence(affectedPages: number, groupSize: number): IssueConfidence {
  if (groupSize >= 5 && affectedPages / groupSize >= 0.8) return "high";
  if (groupSize >= 3 && affectedPages / groupSize >= 0.4) return "medium";
  return "low";
}
```

- [ ] **Step 4: Export the issue API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./models.js";
export * from "./issues.js";
```

If `index.ts` already exports additional modules, keep those exports and add only `export * from "./issues.js";`.

- [ ] **Step 5: Run tests and typecheck for core**

Run:

```bash
rtk npm exec pnpm@9 -- test packages/core/src/issues.test.ts
rtk npm exec pnpm@9 -- --filter @a11yaudit/core typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
rtk git add packages/core/src/issues.ts packages/core/src/issues.test.ts packages/core/src/index.ts
rtk git commit -m "Add grouped issue aggregation core"
```

---

### Task 2: Server Schema and Persistence

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/db/client.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write failing server persistence test**

Add this test to `apps/server/src/app.test.ts` inside the main `describe("server", ...)` block:

```ts
it("persists grouped issues separately from raw occurrence findings", async () => {
  await withTempDb(async (dbPath) => {
    runScanMock.mockImplementation(async ({ request }) => ({
      runId: request.runId,
      projectId: request.projectId,
      targetUrl: request.targetUrl,
      mode: "same_domain_crawl",
      pages: [],
      findings: [
        {
          id: "finding-desktop",
          title: "Buttons must have discernible text",
          severity: "critical",
          status: "new",
          source: "axe",
          certainty: "automatic_violation",
          origin: "unknown",
          wcagCriteria: ["4.1.2"],
          ruleId: "button-name",
          description: "Ensures buttons have discernible text",
          recommendation: "Add an accessible name.",
          pageUrl: "https://example.com/haberler/a",
          viewport: "desktop",
          selector: "aside .elementor-widget-button a",
          htmlSnippet: "<aside><div class=\"elementor-widget-button\"><a></a></div></aside>",
          visibleText: null,
          helpUrl: null,
          fingerprint: "raw-1",
          evidence: [],
          instances: 1
        },
        {
          id: "finding-mobile",
          title: "Buttons must have discernible text",
          severity: "critical",
          status: "new",
          source: "axe",
          certainty: "automatic_violation",
          origin: "unknown",
          wcagCriteria: ["4.1.2"],
          ruleId: "button-name",
          description: "Ensures buttons have discernible text",
          recommendation: "Add an accessible name.",
          pageUrl: "https://example.com/haberler/a",
          viewport: "mobile",
          selector: "aside .elementor-widget-button a",
          htmlSnippet: "<aside><div class=\"elementor-widget-button\"><a></a></div></aside>",
          visibleText: null,
          helpUrl: null,
          fingerprint: "raw-2",
          evidence: [],
          instances: 1
        }
      ],
      reports: [],
      score: 0,
      startedAt: "2026-06-01T00:00:00.000Z",
      finishedAt: "2026-06-01T00:00:01.000Z"
    }));

    const app = await buildServer({ dbPath });
    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Example", url: "https://example.com" }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://example.com",
          mode: "same_domain_crawl",
          maxPages: 10,
          maxDepth: 1,
          viewports: ["desktop", "mobile"]
        }
      });

      await waitForCompletedScan(app, scan.json().id);

      const dbClient = createDb(dbPath);
      try {
        const issueRows = dbClient.sqlite.prepare("SELECT * FROM issues WHERE scan_run_id = ?").all(scan.json().id);
        const findingRows = dbClient.sqlite.prepare("SELECT * FROM findings WHERE scan_run_id = ?").all(scan.json().id);
        expect(issueRows).toHaveLength(1);
        expect(findingRows).toHaveLength(2);
        expect(issueRows[0]).toMatchObject({
          likely_scope: "single page",
          component_area: "aside",
          cms_hint: "Elementor widget button",
          affected_pages: 1,
          occurrences: 2,
          viewport_summary: "desktop,mobile"
        });
      } finally {
        dbClient.close();
      }
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run the server test and verify it fails**

Run:

```bash
rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts -t "persists grouped issues separately"
```

Expected: FAIL with `no such table: issues`.

- [ ] **Step 3: Add schema objects**

Modify `apps/server/src/db/schema.ts`:

```ts
export const issues = sqliteTable("issues", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id").notNull().references(() => scanRuns.id, { onDelete: "cascade" }),
  issueKey: text("issue_key").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  source: text("source").notNull(),
  certainty: text("certainty").notNull(),
  ruleId: text("rule_id").notNull(),
  wcagCriteria: text("wcag_criteria").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
  likelyScope: text("likely_scope").notNull(),
  urlScopeGroup: text("url_scope_group").notNull(),
  componentArea: text("component_area").notNull(),
  cmsHint: text("cms_hint").notNull(),
  confidence: text("confidence").notNull(),
  affectedPages: integer("affected_pages").notNull(),
  occurrences: integer("occurrences").notNull(),
  viewportSummary: text("viewport_summary").notNull(),
  representativeUrl: text("representative_url").notNull(),
  representativeSelector: text("representative_selector"),
  representativeHtmlSnippet: text("representative_html_snippet"),
  sampleUrls: text("sample_urls").notNull(),
  createdAt: text("created_at").notNull()
});
```

Add `issueId` to `findings`:

```ts
issueId: text("issue_id").references(() => issues.id, { onDelete: "set null" }),
```

- [ ] **Step 4: Add SQL migration**

Modify `apps/server/src/db/client.ts` inside `initializeDb` SQL:

```sql
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  certainty TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  wcag_criteria TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  likely_scope TEXT NOT NULL,
  url_scope_group TEXT NOT NULL,
  component_area TEXT NOT NULL,
  cms_hint TEXT NOT NULL,
  confidence TEXT NOT NULL,
  affected_pages INTEGER NOT NULL,
  occurrences INTEGER NOT NULL,
  viewport_summary TEXT NOT NULL,
  representative_url TEXT NOT NULL,
  representative_selector TEXT,
  representative_html_snippet TEXT,
  sample_urls TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issues_scan_severity ON issues(scan_run_id, severity);
CREATE INDEX IF NOT EXISTS idx_issues_project_created ON issues(project_id, created_at);
```

Add after existing `addColumnIfMissing` calls:

```ts
addColumnIfMissing(sqlite, "findings", "issue_id", "TEXT REFERENCES issues(id) ON DELETE SET NULL");
```

- [ ] **Step 5: Persist issues before findings**

Modify imports in `apps/server/src/app.ts`:

```ts
import { aggregateScanIssues } from "@a11yaudit/core";
import { findings, issues, reports, scanRuns } from "./db/schema.js";
```

Inside the completion transaction before inserting findings:

```ts
const aggregatedIssues = aggregateScanIssues(result.findings);
const issueIdByFingerprint = new Map<string, string>();

if (aggregatedIssues.length > 0) {
  tx.insert(issues).values(aggregatedIssues.map((issue) => {
    for (const fingerprint of issue.occurrenceFingerprints) {
      issueIdByFingerprint.set(fingerprint, issue.id);
    }

    return {
      id: `${result.runId}-${issue.id}`,
      projectId: result.projectId ?? job.payload.projectId,
      scanRunId: result.runId,
      issueKey: issue.issueKey,
      title: issue.title,
      severity: issue.severity,
      source: issue.source,
      certainty: issue.certainty,
      ruleId: issue.ruleId,
      wcagCriteria: issue.wcagCriteria.join(","),
      description: issue.description,
      recommendation: issue.recommendation,
      likelyScope: issue.likelyScope,
      urlScopeGroup: issue.urlScopeGroup,
      componentArea: issue.componentArea,
      cmsHint: issue.cmsHint,
      confidence: issue.confidence,
      affectedPages: issue.affectedPages,
      occurrences: issue.occurrences,
      viewportSummary: issue.viewportSummary,
      representativeUrl: issue.representativeUrl,
      representativeSelector: issue.representativeSelector,
      representativeHtmlSnippet: issue.representativeHtmlSnippet,
      sampleUrls: JSON.stringify(issue.sampleUrls),
      createdAt: completedAt
    };
  })).run();
}
```

When building `findingRows`, add:

```ts
issueId: issueIdByFingerprint.get(finding.fingerprint) ? `${result.runId}-${issueIdByFingerprint.get(finding.fingerprint)}` : null,
```

- [ ] **Step 6: Run persistence test**

Run:

```bash
rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts -t "persists grouped issues separately"
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
rtk git add apps/server/src/db/schema.ts apps/server/src/db/client.ts apps/server/src/app.ts apps/server/src/app.test.ts
rtk git commit -m "Persist grouped scan issues"
```

---

### Task 3: Issue API Endpoints

**Files:**
- Create: `apps/server/src/routes/issues.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write failing API test**

Add to `apps/server/src/app.test.ts`:

```ts
it("returns grouped issues with parsed sample URLs", async () => {
  await withTempDb(async (dbPath) => {
    mockCompletedScan();
    const app = await buildServer({ dbPath });
    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Example", url: "https://example.com" }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://example.com",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop"]
        }
      });
      await waitForCompletedScan(app, scan.json().id);

      const issuesResponse = await app.inject({
        method: "GET",
        url: `/api/issues?scanRunId=${scan.json().id}`
      });

      expect(issuesResponse.statusCode).toBe(200);
      expect(issuesResponse.json().data[0]).toMatchObject({
        scanRunId: scan.json().id,
        affectedPages: 1,
        occurrences: 1,
        sampleUrls: expect.any(Array)
      });
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts -t "returns grouped issues"
```

Expected: FAIL with 404 for `/api/issues`.

- [ ] **Step 3: Implement issue routes**

Create `apps/server/src/routes/issues.ts`:

```ts
import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SqliteDatabase } from "../db/client.js";
import { issues } from "../db/schema.js";

const issueQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

export async function registerIssueRoutes(app: FastifyInstance, context: { db: SqliteDatabase }): Promise<void> {
  const { db } = context;

  app.get("/api/issues", async (request, reply) => {
    const parsed = issueQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid issue query", issues: parsed.error.issues });
    }

    const rows = parsed.data.scanRunId
      ? db.select().from(issues).where(eq(issues.scanRunId, parsed.data.scanRunId)).orderBy(desc(issues.occurrences)).all()
      : parsed.data.projectId
        ? db.select().from(issues).where(eq(issues.projectId, parsed.data.projectId)).orderBy(desc(issues.occurrences)).all()
        : db.select().from(issues).orderBy(desc(issues.createdAt)).all();

    return { data: rows.map(mapIssueRow) };
  });

  app.get("/api/issues/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const row = db.select().from(issues).where(eq(issues.id, id)).get();
    if (row === undefined) {
      return reply.code(404).send({ error: "Issue not found" });
    }

    return mapIssueRow(row);
  });
}

function mapIssueRow(row: typeof issues.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    scanRunId: row.scanRunId,
    issueKey: row.issueKey,
    title: row.title,
    severity: row.severity,
    source: row.source,
    certainty: row.certainty,
    ruleId: row.ruleId,
    wcagCriteria: row.wcagCriteria,
    description: row.description,
    recommendation: row.recommendation,
    likelyScope: row.likelyScope,
    urlScopeGroup: row.urlScopeGroup,
    componentArea: row.componentArea,
    cmsHint: row.cmsHint,
    confidence: row.confidence,
    affectedPages: row.affectedPages,
    occurrences: row.occurrences,
    viewportSummary: row.viewportSummary,
    representativeUrl: row.representativeUrl,
    representativeSelector: row.representativeSelector,
    representativeHtmlSnippet: row.representativeHtmlSnippet,
    sampleUrls: JSON.parse(row.sampleUrls) as string[],
    createdAt: row.createdAt
  };
}
```

- [ ] **Step 4: Register issue routes**

Modify `apps/server/src/app.ts`:

```ts
import { registerIssueRoutes } from "./routes/issues.js";
```

After finding routes:

```ts
await registerIssueRoutes(app, { db: dbClient.db });
```

- [ ] **Step 5: Run API test**

```bash
rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts -t "returns grouped issues"
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
rtk git add apps/server/src/routes/issues.ts apps/server/src/app.ts apps/server/src/app.test.ts
rtk git commit -m "Add grouped issue API routes"
```

---

### Task 4: Issue-First Reporter

**Files:**
- Modify: `packages/reporter/src/report-model.ts`
- Modify: `packages/reporter/src/html-template.ts`
- Modify: `packages/reporter/src/html-template.test.ts`
- Modify: `packages/audit/src/scan-engine.ts`

- [ ] **Step 1: Write failing reporter test**

Add to `packages/reporter/src/html-template.test.ts`:

```ts
it("renders grouped issues before raw occurrence details", () => {
  const report = buildAuditReportModel({
    request: {
      runId: "run-issues",
      projectId: "project-issues",
      targetUrl: "https://example.com",
      mode: "same_domain_crawl",
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
      maxPages: 10,
      maxDepth: 1,
      respectRobotsTxt: true
    },
    pages: [],
    findings: [
      {
        id: "finding-1",
        title: "Buttons must have discernible text",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: ["4.1.2"],
        ruleId: "button-name",
        description: "Description",
        recommendation: "Recommendation",
        pageUrl: "https://example.com/haberler/a",
        viewport: "desktop",
        selector: "aside .elementor-widget-button a",
        htmlSnippet: "<aside><div class=\"elementor-widget-button\"><a></a></div></aside>",
        visibleText: null,
        helpUrl: null,
        fingerprint: "raw-1",
        evidence: [],
        instances: 1
      }
    ],
    score: 0,
    generatedAt: "2026-06-01T00:00:00.000Z"
  });

  const html = renderReportHtml(report);

  expect(html).toContain("Unique Issues");
  expect(html).toContain("Total Occurrences");
  expect(html).toContain("Likely Scope");
  expect(html).toContain("Component Area");
  expect(html).toContain("CMS Hint");
  expect(html).toContain("Elementor widget button");
});
```

- [ ] **Step 2: Run reporter test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/reporter/src/html-template.test.ts -t "renders grouped issues"
```

Expected: FAIL because current report does not render grouped issue labels.

- [ ] **Step 3: Add issues to report model**

Modify `packages/reporter/src/report-model.ts`:

```ts
import { aggregateScanIssues, type AggregatedIssue } from "@a11yaudit/core";
```

Add to `AuditReportModel`:

```ts
uniqueIssues: number;
totalOccurrences: number;
issues: AggregatedIssue[];
```

Inside `buildAuditReportModel`:

```ts
const issues = aggregateScanIssues(input.findings);

return {
  projectName: url.hostname,
  domain: url.hostname,
  targetUrl: input.request.targetUrl,
  mode: input.request.mode,
  score: input.score,
  pagesAudited: input.pages.length,
  findingsTotal: input.findings.length,
  uniqueIssues: issues.length,
  totalOccurrences: issues.reduce((sum, issue) => sum + issue.occurrences, 0),
  generatedAt: input.generatedAt,
  findings: input.findings,
  issues,
  pages: input.pages,
  severitySummary: summarizeSeverity(input.findings)
};
```

- [ ] **Step 4: Render grouped issue metrics and table**

Modify `packages/reporter/src/html-template.ts` summary cards:

```html
<div class="card"><div>Unique Issues</div><div class="value">${report.uniqueIssues}</div></div>
<div class="card"><div>Affected Pages</div><div class="value">${new Set(report.issues.flatMap((issue) => issue.sampleUrls)).size}</div></div>
<div class="card"><div>Total Occurrences</div><div class="value">${report.totalOccurrences}</div></div>
```

Add a grouped table before the raw findings section:

```ts
function renderIssuesTable(report: AuditReportModel, maxIssues?: number): string {
  if (report.issues.length === 0) {
    return "<p>No grouped issues were detected by the automated scan.</p>";
  }

  const visibleIssues = limitItems(report.issues, maxIssues);
  const hiddenCount = report.issues.length - visibleIssues.length;
  const limitNote = hiddenCount > 0
    ? `<div class="limit-note">Showing ${visibleIssues.length} of ${report.issues.length} unique issues. ${hiddenCount} additional issues remain available in the scan data.</div>`
    : "";
  const rows = visibleIssues.map((issue) => `<tr>
    <td>${escapeHtml(issue.title)}</td>
    <td>${escapeHtml(issue.severity)}</td>
    <td>${escapeHtml(issue.wcagCriteria.join(", "))}</td>
    <td>${escapeHtml(issue.likelyScope)} (${escapeHtml(issue.confidence)})</td>
    <td>${escapeHtml(issue.componentArea)}</td>
    <td>${escapeHtml(issue.cmsHint)}</td>
    <td>${issue.affectedPages}</td>
    <td>${issue.occurrences}</td>
    <td>${escapeHtml(issue.sampleUrls.join(", "))}</td>
    <td>${escapeHtml(issue.recommendation)}</td>
  </tr>`).join("");

  return `${limitNote}<table>
    <thead>
      <tr>
        <th>Issue</th>
        <th>Severity</th>
        <th>WCAG</th>
        <th>Likely Scope</th>
        <th>Component Area</th>
        <th>CMS Hint</th>
        <th>Affected Pages</th>
        <th>Occurrences</th>
        <th>Sample URLs</th>
        <th>Recommendation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}
```

Use it in the HTML:

```html
<h2>Grouped Issues</h2>
${renderIssuesTable(report, options.maxDetailedFindings)}

<h2>Raw Occurrence Appendix</h2>
${renderFindingsTable(report, options.maxDetailedFindings)}
```

- [ ] **Step 5: Run reporter tests**

```bash
rtk npm exec pnpm@9 -- test packages/reporter/src/html-template.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
rtk git add packages/reporter/src/report-model.ts packages/reporter/src/html-template.ts packages/reporter/src/html-template.test.ts packages/audit/src/scan-engine.ts
rtk git commit -m "Render grouped issues in reports"
```

---

### Task 5: Web API Client and UI Data Model

**Files:**
- Modify: `apps/web/src/data.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts`

- [ ] **Step 1: Write failing API client test**

Add to `apps/web/src/api/client.test.ts`:

```ts
it("maps grouped issues from configured API", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    data: [{
      id: "issue-1",
      projectId: "project-1",
      scanRunId: "run-1",
      issueKey: "button-name|4.1.2|aside button|/haberler/*|aside|Elementor widget button",
      title: "Buttons must have discernible text",
      severity: "critical",
      source: "axe",
      certainty: "automatic_violation",
      ruleId: "button-name",
      wcagCriteria: "4.1.2",
      description: "Description",
      recommendation: "Add an accessible name.",
      likelyScope: "URL group /haberler/*",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button",
      confidence: "medium",
      affectedPages: 183,
      occurrences: 366,
      viewportSummary: "desktop,mobile",
      representativeUrl: "https://example.com/haberler/a",
      representativeSelector: "aside .elementor-widget-button a",
      representativeHtmlSnippet: "<a></a>",
      sampleUrls: ["https://example.com/haberler/a"],
      createdAt: "2026-06-01T00:00:00.000Z"
    }]
  })));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("import.meta", { env: { VITE_A11YAUDIT_API_BASE_URL: "http://localhost:7842" } });

  const issues = await fetchIssues();

  expect(issues[0]).toMatchObject({
    id: "issue-1",
    affectedPages: 183,
    occurrences: 366,
    cmsHint: "Elementor widget button"
  });
});
```

- [ ] **Step 2: Run client test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test apps/web/src/api/client.test.ts -t "maps grouped issues"
```

Expected: FAIL because `fetchIssues` does not exist.

- [ ] **Step 3: Add Issue type**

Modify `apps/web/src/data.ts`:

```ts
export interface Issue {
  id: string;
  projectId: string;
  scanRunId: string;
  issueKey: string;
  title: string;
  severity: Severity;
  source: FindingSource;
  certainty: FindingCertainty;
  ruleId: string;
  wcagCriteria: string;
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
  createdAt: string;
}
```

- [ ] **Step 4: Add API mapper**

Modify `apps/web/src/api/client.ts`:

```ts
import type { Issue } from "../data";
```

Add server type:

```ts
interface ServerIssue {
  id?: string;
  projectId?: string;
  scanRunId?: string;
  issueKey?: string;
  title?: string;
  severity?: Issue["severity"];
  source?: Issue["source"];
  certainty?: Issue["certainty"];
  ruleId?: string;
  wcagCriteria?: string;
  description?: string;
  recommendation?: string;
  likelyScope?: string;
  urlScopeGroup?: string;
  componentArea?: string;
  cmsHint?: string;
  confidence?: Issue["confidence"];
  affectedPages?: number;
  occurrences?: number;
  viewportSummary?: string;
  representativeUrl?: string;
  representativeSelector?: string | null;
  representativeHtmlSnippet?: string | null;
  sampleUrls?: string[];
  createdAt?: string;
}
```

Add fetch function:

```ts
export async function fetchIssues(params: { projectId?: string; scanRunId?: string } = {}): Promise<Issue[]> {
  const query = new URLSearchParams();
  if (params.projectId) query.set("projectId", params.projectId);
  if (params.scanRunId) query.set("scanRunId", params.scanRunId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const result = await fetchList<ServerIssue>(`/api/issues${suffix}`);
  return result.map(mapIssue);
}

function mapIssue(row: ServerIssue): Issue {
  return {
    id: row.id ?? "",
    projectId: row.projectId ?? "",
    scanRunId: row.scanRunId ?? "",
    issueKey: row.issueKey ?? "",
    title: row.title ?? "Untitled issue",
    severity: row.severity ?? "minor",
    source: row.source ?? "axe",
    certainty: row.certainty ?? "automatic_violation",
    ruleId: row.ruleId ?? "",
    wcagCriteria: row.wcagCriteria ?? "",
    description: row.description ?? "",
    recommendation: row.recommendation ?? "",
    likelyScope: row.likelyScope ?? "single page",
    urlScopeGroup: row.urlScopeGroup ?? "",
    componentArea: row.componentArea ?? "unknown",
    cmsHint: row.cmsHint ?? "none",
    confidence: row.confidence ?? "low",
    affectedPages: row.affectedPages ?? 0,
    occurrences: row.occurrences ?? 0,
    viewportSummary: row.viewportSummary ?? "desktop",
    representativeUrl: row.representativeUrl ?? "",
    representativeSelector: row.representativeSelector ?? null,
    representativeHtmlSnippet: row.representativeHtmlSnippet ?? null,
    sampleUrls: row.sampleUrls ?? [],
    createdAt: row.createdAt ?? new Date(0).toISOString()
  };
}
```

- [ ] **Step 5: Run client test**

```bash
rtk npm exec pnpm@9 -- test apps/web/src/api/client.test.ts -t "maps grouped issues"
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
rtk git add apps/web/src/data.ts apps/web/src/api/client.ts apps/web/src/api/client.test.ts
rtk git commit -m "Map grouped issues in web client"
```

---

### Task 6: Issue-First UI

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/pages/page-props.ts`
- Modify: `apps/web/src/pages/overview.tsx`
- Modify: `apps/web/src/pages/findings.tsx`
- Modify: `apps/web/src/pages/finding-detail.tsx`
- Modify: `apps/web/src/pages/scan-runs.tsx`

- [ ] **Step 1: Add issue data to page props**

Modify `apps/web/src/pages/page-props.ts`:

```ts
import type { Finding, Issue, Project, Report, ScanRun } from "../data";

export interface PageProps {
  project: Project;
  projects: Project[];
  scans: ScanRun[];
  findings: Finding[];
  issues: Issue[];
  reports: Report[];
  navigate: (route: AppRoute) => void;
}
```

Keep the existing `AppRoute` import and other fields already present in the file.

- [ ] **Step 2: Load issues in app**

Modify `apps/web/src/app.tsx`:

```ts
import { fetchFindings, fetchIssues, fetchProjects, fetchReports, fetchScans } from "./api/client";
```

Add query:

```ts
const issuesQuery = useQuery({
  queryKey: ["issues"],
  queryFn: () => fetchIssues(),
  refetchInterval: hasActiveScan ? 3_000 : false
});
```

Pass `issues` to pages:

```ts
issues: issuesQuery.data ?? [],
```

Include `issuesQuery.isError` in the existing error banner condition.

- [ ] **Step 3: Update overview metrics**

Modify `apps/web/src/pages/overview.tsx`:

```ts
const projectIssues = issues.filter((issue) => issue.projectId === project.id);
const totalOccurrences = projectIssues.reduce((sum, issue) => sum + issue.occurrences, 0);
const affectedPages = new Set(projectIssues.flatMap((issue) => issue.sampleUrls)).size;
```

Replace the stat grid values:

```tsx
<Stat icon="list" label="Unique issues" sub="grouped problems" value={projectIssues.length} />
<Stat icon="file-text" label="Affected pages" sub="sampled from issues" value={affectedPages} />
<Stat icon="circle-dot" label="Occurrences" sub="raw detections" value={totalOccurrences} />
<Stat icon="check-circle" label="Critical issues" sub="highest severity" value={projectIssues.filter((issue) => issue.severity === "critical").length} />
```

- [ ] **Step 4: Convert findings page to issue-first rows**

Modify `apps/web/src/pages/findings.tsx` so the default rows come from `issues`, sorted by severity, affected pages, then occurrences:

```ts
const visibleIssues = [...issues]
  .filter((issue) => issue.projectId === project.id)
  .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || b.affectedPages - a.affectedPages || b.occurrences - a.occurrences);
```

Render columns:

```tsx
<thead>
  <tr>
    <th>Severity</th>
    <th>Issue</th>
    <th>WCAG</th>
    <th>Likely scope</th>
    <th>Component</th>
    <th>CMS hint</th>
    <th className="num">Pages</th>
    <th className="num">Occurrences</th>
  </tr>
</thead>
```

Each row:

```tsx
<tr key={issue.id} onClick={() => navigate({ page: "finding-detail", findingId: issue.id })}>
  <td><SeverityBadge level={issue.severity} /></td>
  <td>
    <strong>{issue.title}</strong>
    <div className="table-sub">{issue.ruleId} · {issue.viewportSummary}</div>
  </td>
  <td><span className="wcag">{issue.wcagCriteria}</span></td>
  <td>{issue.likelyScope}<div className="table-sub">{issue.confidence} confidence</div></td>
  <td>{issue.componentArea}</td>
  <td>{issue.cmsHint}</td>
  <td className="num tnum">{issue.affectedPages}</td>
  <td className="num tnum">{issue.occurrences}</td>
</tr>
```

- [ ] **Step 5: Update detail page to accept issue IDs**

Modify `apps/web/src/pages/finding-detail.tsx`:

```ts
const issue = issues.find((candidate) => candidate.id === findingId);
```

If no issue is found, keep existing fallback for raw findings:

```ts
const rawFinding = findings.find((candidate) => candidate.id === findingId);
```

Render issue detail first:

```tsx
{issue ? (
  <>
    <PageHeader
      breadcrumb={<><SeverityBadge level={issue.severity} /><span>{issue.wcagCriteria}</span></>}
      subtitle={`${issue.affectedPages} affected pages · ${issue.occurrences} occurrences`}
      title={issue.title}
    />
    <Panel title="Issue summary">
      <div className="kv"><span>Likely scope</span><strong>{issue.likelyScope}</strong></div>
      <div className="kv"><span>Component area</span><strong>{issue.componentArea}</strong></div>
      <div className="kv"><span>CMS hint</span><strong>{issue.cmsHint}</strong></div>
      <div className="kv"><span>Confidence</span><strong>{issue.confidence}</strong></div>
    </Panel>
    <Panel title="Sample URLs">
      <div className="stack-list">
        {issue.sampleUrls.map((url) => <div className="list-row" key={url}>{url}</div>)}
      </div>
    </Panel>
  </>
) : raw finding fallback}
```

- [ ] **Step 6: Rename scan-run table label**

Modify `apps/web/src/pages/scan-runs.tsx` table header from `Findings` to `Occurrences`:

```tsx
<th>Occurrences</th>
```

Keep value as `scan.findingsTotal` until the server response adds `occurrencesTotal`.

- [ ] **Step 7: Run web typecheck**

```bash
rtk npm exec pnpm@9 -- --filter @a11yaudit/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
rtk git add apps/web/src/app.tsx apps/web/src/pages/page-props.ts apps/web/src/pages/overview.tsx apps/web/src/pages/findings.tsx apps/web/src/pages/finding-detail.tsx apps/web/src/pages/scan-runs.tsx
rtk git commit -m "Show grouped issues in the web UI"
```

---

### Task 7: Pipeline Reliability for Report Failures

**Files:**
- Modify: `packages/core/src/models.ts`
- Modify: `packages/audit/src/scan-engine.ts`
- Modify: `packages/audit/src/scan-engine.test.ts`
- Modify: `apps/server/src/app.test.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add report warning field to the completed scan model**

Modify `packages/core/src/models.ts`:

```ts
export interface CompletedScanResult {
  runId: string;
  projectId: string | null;
  targetUrl: string;
  mode: ScanMode;
  pages: AuditedPage[];
  findings: ScanFinding[];
  reports: ScanReportArtifact[];
  reportWarnings?: string[];
  score: number;
  startedAt: string;
  finishedAt: string;
}
```

- [ ] **Step 2: Write failing audit test for PDF failure keeping HTML and audit data**

Add a reporter mock near the top of `packages/audit/src/scan-engine.test.ts`, before importing `runScan` if the file needs hoisted mocks:

```ts
const reporterMock = vi.hoisted(() => ({
  renderPdfFromHtml: vi.fn(async () => Buffer.from("%PDF-1.4\n")),
  renderReportHtml: vi.fn(() => "<html><body>report</body></html>")
}));

vi.mock("@a11yaudit/reporter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@a11yaudit/reporter")>();
  return {
    ...actual,
    renderPdfFromHtml: reporterMock.renderPdfFromHtml,
    renderReportHtml: reporterMock.renderReportHtml
  };
});
```

Add test:

```ts
it("returns completed audit data and an HTML report when PDF rendering fails", async () => {
  reporterMock.renderPdfFromHtml.mockRejectedValueOnce(new Error("page.pdf: Protocol error (Page.printToPDF): Printing failed"));

  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>PDF Failure Fixture</title></head>
        <body><main><h1>Fixture</h1><img src="/missing.png"></main></body>
      </html>`);
  });
  const url = await listen(server);
  tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
  const storage = new LocalStorageAdapter({ rootDir: tempDir });

  const result = await runScan({
    request: {
      runId: "run-pdf-failure",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    },
    storage
  });

  expect(result.findings.length).toBeGreaterThan(0);
  expect(result.reports.map((report) => report.kind)).toEqual(["html"]);
  expect(result.reportWarnings).toEqual([
    "PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"
  ]);
});
```

- [ ] **Step 3: Run audit test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/audit/src/scan-engine.test.ts -t "returns completed audit data"
```

Expected: FAIL because `renderPdfFromHtml` rejection currently rejects the whole scan.

- [ ] **Step 4: Make PDF generation non-fatal after HTML report storage**

Modify `packages/audit/src/scan-engine.ts` inside `storeReports`.

Replace:

```ts
const html = renderReportHtml(report);
const pdfHtml = renderReportHtml(report, {
  maxDetailedFindings: PDF_DETAILED_FINDING_LIMIT,
  maxEvidenceRows: PDF_EVIDENCE_ROW_LIMIT
});
const pdf = await renderPdfFromHtml(pdfHtml);
const htmlArtifact = await input.storage.put(...);
const pdfArtifact = await input.storage.put(...);
```

With this shape:

```ts
const html = renderReportHtml(report);
const htmlArtifact = await input.storage.put(
  createArtifactKey({
    runId: input.request.runId,
    kind: "report",
    name: "audit-report-html",
    extension: "html"
  }),
  Buffer.from(html),
  "text/html"
);

const reports: CompletedScanResult["reports"] = [{
  kind: "html",
  artifactKey: htmlArtifact.key,
  mimeType: htmlArtifact.mimeType,
  sizeBytes: htmlArtifact.sizeBytes
}];
const reportWarnings: string[] = [];

try {
  const pdfHtml = renderReportHtml(report, {
    maxDetailedFindings: PDF_DETAILED_FINDING_LIMIT,
    maxEvidenceRows: PDF_EVIDENCE_ROW_LIMIT
  });
  const pdf = await renderPdfFromHtml(pdfHtml);
  const pdfArtifact = await input.storage.put(
    createArtifactKey({
      runId: input.request.runId,
      kind: "report",
      name: "audit-report-pdf",
      extension: "pdf"
    }),
    pdf,
    "application/pdf"
  );
  reports.push({
    kind: "pdf",
    artifactKey: pdfArtifact.key,
    mimeType: pdfArtifact.mimeType,
    sizeBytes: pdfArtifact.sizeBytes
  });
} catch (error) {
  reportWarnings.push(`PDF report failed: ${error instanceof Error ? error.message : String(error)}`);
}

return { reports, reportWarnings };
```

Change `storeReports` return type from `Promise<CompletedScanResult["reports"]>` to:

```ts
Promise<{ reports: CompletedScanResult["reports"]; reportWarnings: string[] }>
```

Update `runScan`:

```ts
const reportResult = await storeReports(input, {
  score,
  pages,
  findings
});
```

Return:

```ts
reports: reportResult.reports,
reportWarnings: reportResult.reportWarnings,
```

- [ ] **Step 5: Run audit test**

```bash
rtk npm exec pnpm@9 -- test packages/audit/src/scan-engine.test.ts -t "returns completed audit data"
```

Expected: PASS.

- [ ] **Step 6: Write server test for completed scan with report warning**

Add to `apps/server/src/app.test.ts`:

```ts
it("marks scans completed when audit data persists but PDF report has warnings", async () => {
  await withTempDb(async (dbPath) => {
    runScanMock.mockImplementation(async ({ request, storage }: {
      request: { runId: string; projectId: string | null; targetUrl: string };
      storage: { put: (key: string, body: Buffer, mimeType: string) => Promise<{ key: string; mimeType: string; sizeBytes: number }> };
    }) => {
      const html = await storage.put(`runs/${request.runId}/report/audit-report.html`, Buffer.from("<html></html>"), "text/html");
      return {
        runId: request.runId,
        projectId: request.projectId,
        targetUrl: request.targetUrl,
        mode: "single_url",
        pages: [{ url: request.targetUrl, normalizedUrl: request.targetUrl, title: "Fixture", viewport: "desktop", statusCode: 200, finalUrl: request.targetUrl, durationMs: 1, errorMessage: null }],
        findings: [{
          id: "finding-image-alt",
          pageUrl: request.targetUrl,
          viewport: "desktop",
          selector: "img",
          htmlSnippet: "<img>",
          visibleText: null,
          helpUrl: null,
          fingerprint: "fingerprint-image-alt",
          evidence: [],
          title: "Images must have alternate text",
          severity: "critical",
          status: "new",
          source: "axe",
          certainty: "automatic_violation",
          origin: "content",
          wcagCriteria: ["1.1.1"],
          ruleId: "image-alt",
          description: "Images must have alternate text.",
          recommendation: "Add meaningful alternate text.",
          instances: 1
        }],
        reports: [{ kind: "html", artifactKey: html.key, mimeType: html.mimeType, sizeBytes: html.sizeBytes }],
        reportWarnings: ["PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"],
        score: 0,
        startedAt: "2026-06-01T00:00:00.000Z",
        finishedAt: "2026-06-01T00:00:01.000Z"
      };
    });

    const app = await buildServer({ dbPath });
    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Example", url: "https://example.com" }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://example.com",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop"]
        }
      });

      const completed = await waitForScan(app, scan.json().id, "completed");

      expect(completed.errorMessage).toBe("PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed");
      const reportsResponse = await app.inject({ method: "GET", url: `/api/reports?scanRunId=${scan.json().id}` });
      expect(reportsResponse.json().data.map((report: { kind: string }) => report.kind)).toEqual(["html"]);
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 7: Persist report warnings on completed scans**

Modify the completed update in `apps/server/src/app.ts`:

```ts
errorMessage: result.reportWarnings && result.reportWarnings.length > 0 ? result.reportWarnings.join("; ") : null
```

Keep `status: "completed"` because audit data and at least one report artifact were persisted.

- [ ] **Step 8: Run server tests**

```bash
rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 7**

```bash
rtk git add packages/core/src/models.ts packages/audit/src/scan-engine.ts packages/audit/src/scan-engine.test.ts apps/server/src/app.ts apps/server/src/app.test.ts
rtk git commit -m "Keep audit data when PDF report generation fails"
```

---

### Task 8: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-01-grouped-issue-reporting-design.md` only if implementation reveals a necessary clarification.

- [ ] **Step 1: Update README terminology**

Add a short section to `README.md`:

```md
### Issue Grouping

A11yAudit distinguishes grouped accessibility issues from raw occurrences. A repeated header, footer, sidebar, or CMS widget problem is shown as one unique issue with affected page and occurrence counts, instead of thousands of duplicate rows. Raw occurrences remain available for technical traceability.
```

- [ ] **Step 2: Run full test suite**

```bash
rtk npm exec pnpm@9 -- test
```

Expected: PASS.

- [ ] **Step 3: Run full typecheck**

```bash
rtk npm exec pnpm@9 -- typecheck
```

Expected: PASS.

- [ ] **Step 4: Run full build**

```bash
rtk npm exec pnpm@9 -- -r build
```

Expected: PASS. Existing Vite warnings about React Query `"use client"` directives are acceptable if the build exits 0.

- [ ] **Step 5: Browser smoke test**

Start or restart dev servers:

```bash
rtk npm exec pnpm@9 -- --filter @a11yaudit/server dev
VITE_A11YAUDIT_API_BASE_URL=http://localhost:7842 rtk npm exec pnpm@9 -- --filter @a11yaudit/web dev
```

Verify:

- `http://localhost:7842/health` returns `{ "ok": true }`.
- `http://localhost:5173` loads.
- dashboard shows Unique Issues and Occurrences.
- issue list rows are grouped, not URL-level raw findings.
- scan runs table labels raw count as Occurrences.

- [ ] **Step 6: Commit documentation**

```bash
rtk git add README.md docs/superpowers/specs/2026-06-01-grouped-issue-reporting-design.md
rtk git commit -m "Document grouped issue reporting behavior"
```

- [ ] **Step 7: Push branch**

```bash
rtk git push
```

Expected: `ok main` or normal Git push success output.

---

## Execution Notes

- Keep raw `findings` available during the first implementation. Treat it as occurrence data in product language.
- Do not delete existing report artifacts or old runs during migration work.
- Avoid renaming database tables in the first pass; additive schema changes are safer for the current local SQLite data.
- Use grouped issues for default UI and PDF. Use raw findings only for drill-down or compatibility.
- Commit after each task to keep the branch reviewable.

## Self-Review

Spec coverage:

- Issue/occurrence/affected page terminology is covered by Tasks 1, 4, 6, and 8.
- URL scope inference is covered by Task 1.
- Component area inference is covered by Task 1.
- Elementor/WordPress enrichment is covered by Task 1.
- DB persistence is covered by Task 2.
- API endpoints are covered by Task 3.
- Issue-first PDF is covered by Task 4.
- Issue-first UI is covered by Tasks 5 and 6.
- Report reliability is partially covered by Task 7. Full report generation decoupling from `runScan` remains intentionally deferred after the first persistence split.
- Documentation is covered by Task 8.

Completeness scan:

- No incomplete implementation notes are intentionally left for implementation workers.

Type consistency:

- Core type names are `AggregatedIssue`, `IssueConfidence`, `ComponentArea`, `CmsHint`, and `ViewportSummary`.
- Server database columns use snake_case and route responses map them to camelCase.
- Web type uses `Issue` for API/client/UI and keeps existing `Finding` for raw occurrences.
