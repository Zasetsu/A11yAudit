# Scan Execution MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current smoke-only scan path with a real WCAG 2.2 technical audit pipeline that crawls public pages, runs desktop and mobile Playwright audits, stores evidence, persists findings, and generates PDF reports from both CLI and Web UI scans.

**Architecture:** Add a shared `packages/audit` orchestration package so CLI and server use the same scan execution code. Keep crawling, rule execution, reporting, and storage in their existing packages, and let the server worker persist lifecycle state around the shared engine. The MVP remains local-first: SQLite for metadata, local filesystem artifacts by default, object-storage-compatible interfaces without requiring object storage.

**Tech Stack:** TypeScript, pnpm workspaces, Playwright Chromium, axe-core, Fastify, Drizzle ORM, SQLite, Vitest, local filesystem storage, existing React/Vite Web UI.

---

## Scope Boundary

This plan implements the missing execution path we identified after testing:

- Real crawler instead of single static seed URL.
- Real audit runner instead of zero-finding report generation.
- Desktop and mobile viewport execution.
- axe-core and current custom rules wired into the scan flow.
- Evidence capture for technical validation.
- Server worker that moves queued scans to running/completed/failed.
- CLI using the same engine as the server.
- PDF report generated from real findings.
- Web UI polling real scan state and downloading report artifacts.

This plan does not implement authenticated scans, schedules, billing, hosted SaaS tenancy, Jira/GitHub integrations, manual remediation workflows, legal certification claims, or S3 as a required runtime dependency.

## Files Created Or Modified

```text
packages/core/src/models.ts
packages/core/src/config.ts
packages/core/src/index.ts
packages/core/src/scan-results.test.ts

packages/crawler/package.json
packages/crawler/src/crawler.ts
packages/crawler/src/crawler.test.ts
packages/crawler/src/robots.ts
packages/crawler/src/robots.test.ts
packages/crawler/src/index.ts

packages/rules/src/audit-page.ts
packages/rules/src/audit-page.test.ts
packages/rules/src/axe-runner.ts
packages/rules/src/custom-rules.ts
packages/rules/src/index.ts

packages/storage/src/storage.ts
packages/storage/src/artifact-keys.ts
packages/storage/src/artifact-keys.test.ts
packages/storage/src/index.ts

packages/reporter/src/report-model.ts
packages/reporter/src/html-template.ts
packages/reporter/src/html-template.test.ts
packages/reporter/src/index.ts

packages/audit/package.json
packages/audit/tsconfig.json
packages/audit/src/index.ts
packages/audit/src/scan-engine.ts
packages/audit/src/scan-engine.test.ts
packages/audit/src/evidence.ts
packages/audit/src/evidence.test.ts
packages/audit/src/score.ts
packages/audit/src/score.test.ts
packages/audit/src/fixtures/site.ts

apps/server/package.json
apps/server/src/db/schema.ts
apps/server/src/jobs/local-job-runner.ts
apps/server/src/routes/scans.ts
apps/server/src/routes/reports.ts
apps/server/src/app.test.ts

apps/cli/package.json
apps/cli/src/index.ts
apps/cli/src/index.test.ts

apps/web/src/api/client.ts
apps/web/src/pages/scan-runs.tsx
apps/web/src/pages/reports.tsx
```

## Data Contracts

The shared scan engine returns this shape to both CLI and server:

```ts
export interface CompletedScanResult {
  runId: string;
  projectId: string | null;
  targetUrl: string;
  mode: ScanMode;
  pages: AuditedPage[];
  findings: ScanFinding[];
  reports: ScanReportArtifact[];
  score: number;
  startedAt: string;
  finishedAt: string;
}
```

The server persists grouped findings in the existing `findings` table for the Web UI and report summaries. Evidence artifacts are stored through `StorageAdapter`, referenced by stable artifact keys, and included in the report model.

## Task 1: Core Scan Contracts

**Files:**
- Modify: `packages/core/src/models.ts`
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/scan-results.test.ts`

- [ ] **Step 1: Add failing tests for scan configuration and result contracts**

Create `packages/core/src/scan-results.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_LIMITS, DEFAULT_VIEWPORTS, createFindingFingerprint } from "./index.js";

describe("scan contracts", () => {
  it("ships desktop and mobile viewports by default", () => {
    expect(DEFAULT_VIEWPORTS.map((viewport) => viewport.name)).toEqual(["desktop", "mobile"]);
  });

  it("creates stable fingerprints for the same technical finding", () => {
    const first = createFindingFingerprint({
      normalizedUrl: "https://example.com/about",
      viewport: "desktop",
      ruleId: "image-alt",
      wcagCriteria: ["1.1.1"],
      elementSignature: "img[src=/logo.png]"
    });
    const second = createFindingFingerprint({
      normalizedUrl: "https://example.com/about",
      viewport: "desktop",
      ruleId: "image-alt",
      wcagCriteria: ["1.1.1"],
      elementSignature: "img[src=/logo.png]"
    });

    expect(first).toBe(second);
  });

  it("keeps crawler limits bounded for local execution", () => {
    expect(DEFAULT_SCAN_LIMITS.maxPages).toBeGreaterThan(0);
    expect(DEFAULT_SCAN_LIMITS.maxDepth).toBeGreaterThan(0);
    expect(DEFAULT_SCAN_LIMITS.pageTimeoutMs).toBeLessThanOrEqual(30_000);
  });
});
```

- [ ] **Step 2: Run the failing contract tests**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/core/src/scan-results.test.ts
```

Expected: FAIL until the new exported types and defaults are present.

- [ ] **Step 3: Extend `packages/core/src/models.ts` with scan execution types**

Add these exports below the existing finding types:

```ts
export type ScanMode = "single_url" | "url_list" | "same_domain_crawl";
export type ScanRunStatus = "queued" | "crawling" | "auditing" | "reporting" | "completed" | "failed";

export interface ScanRequest {
  runId: string;
  projectId: string | null;
  targetUrl: string;
  mode: ScanMode;
  urls?: string[];
  viewports: Viewport[];
  maxPages: number;
  maxDepth: number;
  respectRobotsTxt: boolean;
}

export interface AuditedPage {
  url: string;
  normalizedUrl: string;
  title: string | null;
  viewport: ViewportName;
  statusCode: number | null;
  finalUrl: string;
  durationMs: number;
  errorMessage: string | null;
}

export interface EvidenceArtifact {
  kind: "page_screenshot" | "element_screenshot" | "html_snippet";
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ScanFinding extends Finding {
  pageUrl: string;
  viewport: ViewportName;
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  helpUrl: string | null;
  fingerprint: string;
  evidence: EvidenceArtifact[];
  instances: number;
}

export interface ScanReportArtifact {
  kind: "html" | "pdf";
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CompletedScanResult {
  runId: string;
  projectId: string | null;
  targetUrl: string;
  mode: ScanMode;
  pages: AuditedPage[];
  findings: ScanFinding[];
  reports: ScanReportArtifact[];
  score: number;
  startedAt: string;
  finishedAt: string;
}
```

- [ ] **Step 4: Export the new contracts**

Ensure `packages/core/src/index.ts` exports all model/config modules:

```ts
export * from "./config.js";
export * from "./models.js";
export * from "./wcag.js";
```

- [ ] **Step 5: Verify core tests**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/core/src
```

Expected: PASS.

## Task 2: Real Same-Domain Crawler

**Files:**
- Modify: `packages/crawler/package.json`
- Modify: `packages/crawler/src/crawler.ts`
- Create: `packages/crawler/src/robots.ts`
- Create: `packages/crawler/src/robots.test.ts`
- Create: `packages/crawler/src/crawler.test.ts`
- Modify: `packages/crawler/src/index.ts`

- [ ] **Step 1: Add crawler tests for scope, depth, and private URL safety**

Create `packages/crawler/src/crawler.test.ts` with a local fixture server that serves `/`, `/about`, `/contact`, external links, asset links, and duplicate query variants:

```ts
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crawlSameDomain } from "./crawler.js";

let server: ReturnType<typeof createServer>;
let origin = "";

beforeEach(async () => {
  server = createServer((request, response) => {
    response.setHeader("content-type", "text/html");
    if (request.url === "/robots.txt") {
      response.end("User-agent: *\nDisallow: /blocked");
      return;
    }
    if (request.url === "/") {
      response.end('<a href="/about">About</a><a href="/blocked">Blocked</a><a href="https://example.org/offsite">Offsite</a><a href="/image.png">Asset</a>');
      return;
    }
    if (request.url === "/about") {
      response.end('<a href="/contact#team">Contact</a>');
      return;
    }
    response.end("<main>Leaf</main>");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "object" && address) origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe("crawlSameDomain", () => {
  it("discovers normalized same-origin HTML pages within depth and robots constraints", async () => {
    const result = await crawlSameDomain({
      startUrl: `${origin}/`,
      maxPages: 10,
      maxDepth: 2,
      respectRobotsTxt: true,
      allowLocalhost: true
    });

    expect(result.urls).toEqual([`${origin}/`, `${origin}/about`, `${origin}/contact`]);
    expect(result.skipped.some((skip) => skip.reason === "robots")).toBe(true);
    expect(result.skipped.some((skip) => skip.reason === "external_origin")).toBe(true);
  });
});
```

- [ ] **Step 2: Run crawler tests and confirm failure**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/crawler/src/crawler.test.ts
```

Expected: FAIL with `crawlSameDomain` not exported.

- [ ] **Step 3: Implement robots parsing**

Create `packages/crawler/src/robots.ts`:

```ts
export interface RobotsRules {
  disallow: string[];
}

export function parseRobotsTxt(body: string): RobotsRules {
  const disallow: string[] = [];
  let applies = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (line.length === 0) continue;
    const [keyRaw, ...valueParts] = line.split(":");
    const key = keyRaw?.trim().toLowerCase();
    const value = valueParts.join(":").trim();

    if (key === "user-agent") applies = value === "*";
    if (applies && key === "disallow" && value.length > 0) disallow.push(value);
  }

  return { disallow };
}

export function isAllowedByRobots(url: URL, rules: RobotsRules): boolean {
  return !rules.disallow.some((path) => url.pathname.startsWith(path));
}
```

- [ ] **Step 4: Implement `crawlSameDomain`**

Replace `packages/crawler/src/crawler.ts` with an implementation that:

```ts
import { DEFAULT_SCAN_LIMITS } from "@a11yaudit/core";
import { assertSafeUrl } from "./network-safety.js";
import { normalizeAuditUrl, shouldSkipUrl } from "./url-normalizer.js";
import { isAllowedByRobots, parseRobotsTxt, type RobotsRules } from "./robots.js";

export interface CrawlInput {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  respectRobotsTxt?: boolean;
  allowLocalhost?: boolean;
}

export interface SkippedUrl {
  url: string;
  reason: "asset" | "duplicate" | "external_origin" | "robots" | "unsafe" | "depth";
}

export interface CrawlResult {
  urls: string[];
  skipped: SkippedUrl[];
}
```

The function should:

- Validate the seed with `assertSafeUrl` unless `allowLocalhost` is true for tests.
- Fetch HTML with `fetch`.
- Extract anchors using `new URL(href, currentUrl)`.
- Normalize with `normalizeAuditUrl`.
- Reject static assets through `shouldSkipUrl`.
- Keep only the seed origin.
- Respect `maxPages` and `maxDepth`.
- Respect parsed `robots.txt` when enabled.
- Return deterministic discovery order.

- [ ] **Step 5: Keep smoke compatibility**

Retain `crawlStaticSeed(input)` as a wrapper:

```ts
export async function crawlStaticSeed(input: CrawlInput): Promise<CrawlResult> {
  const normalized = normalizeAuditUrl(input.startUrl);
  return { urls: shouldSkipUrl(normalized) ? [] : [normalized], skipped: [] };
}
```

- [ ] **Step 6: Export crawler APIs**

Update `packages/crawler/src/index.ts`:

```ts
export * from "./crawler.js";
export * from "./network-safety.js";
export * from "./robots.js";
export * from "./url-normalizer.js";
```

- [ ] **Step 7: Verify crawler package**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/crawler/src
rtk npm exec pnpm@9 -- --filter @a11yaudit/crawler typecheck
```

Expected: PASS.

## Task 3: Page Audit Runner

**Files:**
- Modify: `packages/rules/src/axe-runner.ts`
- Create: `packages/rules/src/audit-page.ts`
- Create: `packages/rules/src/audit-page.test.ts`
- Modify: `packages/rules/src/index.ts`

- [ ] **Step 1: Add tests for normalized axe findings**

Create `packages/rules/src/audit-page.test.ts`:

```ts
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { auditPage } from "./audit-page.js";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("auditPage", () => {
  it("returns axe violations as normalized technical findings", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent('<main><img src="/missing-alt.png"><button></button></main>', { waitUntil: "domcontentloaded" });

    const result = await auditPage({
      page,
      url: "https://example.com/",
      normalizedUrl: "https://example.com/",
      viewport: { name: "desktop", width: 1440, height: 900 }
    });

    await page.close();
    expect(result.findings.some((finding) => finding.ruleId === "image-alt" || finding.ruleId === "button-name")).toBe(true);
    expect(result.findings.every((finding) => finding.certainty === "automatic_violation")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing audit-page test**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/rules/src/audit-page.test.ts
```

Expected: FAIL with missing `auditPage`.

- [ ] **Step 3: Implement `auditPage`**

Create `packages/rules/src/audit-page.ts`:

```ts
import type { AuditedPage, ScanFinding, Viewport } from "@a11yaudit/core";
import { createFindingFingerprint } from "@a11yaudit/core";
import type { Page } from "playwright";
import { runAxeOnPage } from "./axe-runner.js";
import { normalizeAxeImpact, wcagTagsToCriteria } from "./normalize.js";

export interface AuditPageInput {
  page: Page;
  url: string;
  normalizedUrl: string;
  viewport: Viewport;
}

export interface AuditPageResult {
  page: AuditedPage;
  findings: ScanFinding[];
}

export async function auditPage(input: AuditPageInput): Promise<AuditPageResult> {
  const started = Date.now();
  const title = await input.page.title().catch(() => null);
  const axeResults = await runAxeOnPage(input.page);

  const findings: ScanFinding[] = axeResults.violations.flatMap((violation) => {
    const criteria = wcagTagsToCriteria(violation.tags);
    return violation.nodes.map((node, index) => {
      const selector = node.target[0] ?? null;
      const elementSignature = selector ?? node.html.slice(0, 160);
      const fingerprint = createFindingFingerprint({
        normalizedUrl: input.normalizedUrl,
        viewport: input.viewport.name,
        ruleId: violation.id,
        wcagCriteria: criteria,
        elementSignature
      });

      return {
        id: `${violation.id}-${index}-${Buffer.from(fingerprint).toString("base64url").slice(0, 12)}`,
        title: violation.help,
        severity: normalizeAxeImpact(violation.impact),
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: criteria,
        ruleId: violation.id,
        description: violation.description,
        recommendation: violation.help,
        pageUrl: input.url,
        viewport: input.viewport.name,
        selector,
        htmlSnippet: node.html,
        visibleText: null,
        helpUrl: violation.helpUrl,
        fingerprint,
        evidence: [],
        instances: 1
      };
    });
  });

  return {
    page: {
      url: input.url,
      normalizedUrl: input.normalizedUrl,
      title,
      viewport: input.viewport.name,
      statusCode: null,
      finalUrl: input.page.url(),
      durationMs: Date.now() - started,
      errorMessage: null
    },
    findings
  };
}
```

- [ ] **Step 4: Export page audit APIs**

Update `packages/rules/src/index.ts`:

```ts
export * from "./audit-page.js";
export * from "./axe-runner.js";
export * from "./custom-rules.js";
export * from "./normalize.js";
```

- [ ] **Step 5: Verify rules package**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/rules/src
rtk npm exec pnpm@9 -- --filter @a11yaudit/rules typecheck
```

Expected: PASS.

## Task 4: Artifact Keys And Evidence Capture

**Files:**
- Modify: `packages/storage/src/storage.ts`
- Create: `packages/storage/src/artifact-keys.ts`
- Create: `packages/storage/src/artifact-keys.test.ts`
- Modify: `packages/storage/src/index.ts`
- Create: `packages/audit/src/evidence.ts`
- Create: `packages/audit/src/evidence.test.ts`

- [ ] **Step 1: Add artifact key tests**

Create `packages/storage/src/artifact-keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createArtifactKey } from "./artifact-keys.js";

describe("createArtifactKey", () => {
  it("creates path-safe stable artifact keys", () => {
    expect(createArtifactKey({ runId: "run-1", kind: "screenshot", name: "https://example.com/a?b=c", extension: "png" }))
      .toMatch(/^runs\/run-1\/screenshot\/[a-z0-9_-]+\.png$/);
  });
});
```

- [ ] **Step 2: Implement artifact key generation**

Create `packages/storage/src/artifact-keys.ts`:

```ts
import { createHash } from "node:crypto";

export interface ArtifactKeyInput {
  runId: string;
  kind: "report" | "screenshot" | "snippet";
  name: string;
  extension: "html" | "pdf" | "png" | "txt";
}

export function createArtifactKey(input: ArtifactKeyInput): string {
  const digest = createHash("sha256").update(input.name).digest("base64url").slice(0, 24).toLowerCase();
  return `runs/${input.runId}/${input.kind}/${digest}.${input.extension}`;
}
```

- [ ] **Step 3: Export artifact key helpers**

Update `packages/storage/src/index.ts`:

```ts
export * from "./artifact-keys.js";
export * from "./local-storage.js";
export * from "./storage.js";
```

- [ ] **Step 4: Implement evidence capture in `packages/audit`**

Create `packages/audit/src/evidence.ts`:

```ts
import type { EvidenceArtifact, ScanFinding } from "@a11yaudit/core";
import { createArtifactKey, type StorageAdapter } from "@a11yaudit/storage";
import type { Page } from "playwright";

export interface CaptureEvidenceInput {
  runId: string;
  page: Page;
  finding: ScanFinding;
  storage: StorageAdapter;
}

export async function captureEvidence(input: CaptureEvidenceInput): Promise<EvidenceArtifact[]> {
  const artifacts: EvidenceArtifact[] = [];
  const pageScreenshot = await input.page.screenshot({ fullPage: true, type: "png" });
  const pageKey = createArtifactKey({
    runId: input.runId,
    kind: "screenshot",
    name: `${input.finding.fingerprint}:page`,
    extension: "png"
  });
  const storedPage = await input.storage.put(pageKey, pageScreenshot, "image/png");
  artifacts.push({ kind: "page_screenshot", ...storedPage });

  if (input.finding.htmlSnippet) {
    const snippetKey = createArtifactKey({
      runId: input.runId,
      kind: "snippet",
      name: `${input.finding.fingerprint}:html`,
      extension: "txt"
    });
    const storedSnippet = await input.storage.put(snippetKey, Buffer.from(input.finding.htmlSnippet), "text/plain");
    artifacts.push({ kind: "html_snippet", ...storedSnippet });
  }

  return artifacts;
}
```

- [ ] **Step 5: Verify storage and evidence tests**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/storage/src packages/audit/src/evidence.test.ts
```

Expected: PASS after `packages/audit` exists in Task 5.

## Task 5: Shared Audit Engine Package

**Files:**
- Create: `packages/audit/package.json`
- Create: `packages/audit/tsconfig.json`
- Create: `packages/audit/src/index.ts`
- Create: `packages/audit/src/scan-engine.ts`
- Create: `packages/audit/src/scan-engine.test.ts`
- Create: `packages/audit/src/score.ts`
- Create: `packages/audit/src/score.test.ts`

- [ ] **Step 1: Scaffold `@a11yaudit/audit`**

Create `packages/audit/package.json`:

```json
{
  "name": "@a11yaudit/audit",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@a11yaudit/core": "workspace:*",
    "@a11yaudit/crawler": "workspace:*",
    "@a11yaudit/reporter": "workspace:*",
    "@a11yaudit/rules": "workspace:*",
    "@a11yaudit/storage": "workspace:*",
    "playwright": "^1.44.0"
  }
}
```

Create `packages/audit/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Add score tests**

Create `packages/audit/src/score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateScore } from "./score.js";

describe("calculateScore", () => {
  it("returns 100 with no findings", () => {
    expect(calculateScore([])).toBe(100);
  });

  it("penalizes higher severity findings more heavily", () => {
    expect(calculateScore([{ severity: "critical" }, { severity: "minor" }])).toBeLessThan(calculateScore([{ severity: "minor" }]));
  });
});
```

- [ ] **Step 3: Implement score calculation**

Create `packages/audit/src/score.ts`:

```ts
import type { Severity } from "@a11yaudit/core";

const weights: Record<Severity, number> = {
  critical: 25,
  serious: 15,
  moderate: 8,
  minor: 3
};

export function calculateScore(findings: Array<{ severity: Severity }>): number {
  const penalty = findings.reduce((total, finding) => total + weights[finding.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
```

- [ ] **Step 4: Add scan engine integration test**

Create `packages/audit/src/scan-engine.test.ts` using a local fixture page with a missing `alt` image:

```ts
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_VIEWPORTS } from "@a11yaudit/core";
import { LocalStorageAdapter } from "@a11yaudit/storage";
import { runScan } from "./scan-engine.js";

let server: ReturnType<typeof createServer>;
let origin = "";
let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
  server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end('<main><h1>Fixture</h1><img src="/logo.png"></main>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "object" && address) origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await rm(tempDir, { recursive: true, force: true });
});

describe("runScan", () => {
  it("audits a page in desktop and mobile and creates report artifacts", async () => {
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const result = await runScan({
      request: {
        runId: "run-fixture",
        projectId: null,
        targetUrl: origin,
        mode: "single_url",
        viewports: DEFAULT_VIEWPORTS,
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: false
      },
      storage,
      allowLocalhost: true
    });

    expect(result.pages).toHaveLength(2);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.reports.map((report) => report.kind).sort()).toEqual(["html", "pdf"]);
    expect(result.score).toBeLessThan(100);
  });
});
```

- [ ] **Step 5: Implement `runScan`**

Create `packages/audit/src/scan-engine.ts`:

```ts
import { chromium } from "playwright";
import type { CompletedScanResult, ScanRequest } from "@a11yaudit/core";
import { crawlSameDomain, crawlStaticSeed, normalizeAuditUrl } from "@a11yaudit/crawler";
import { auditPage } from "@a11yaudit/rules";
import { buildAuditReportModel, renderPdfFromHtml, renderReportHtml } from "@a11yaudit/reporter";
import { createArtifactKey, type StorageAdapter } from "@a11yaudit/storage";
import { captureEvidence } from "./evidence.js";
import { calculateScore } from "./score.js";

export interface RunScanInput {
  request: ScanRequest;
  storage: StorageAdapter;
  allowLocalhost?: boolean;
  onProgress?: (event: { status: "crawling" | "auditing" | "reporting"; pagesQueued: number; pagesScanned: number; findingsTotal: number }) => Promise<void> | void;
}

export async function runScan(input: RunScanInput): Promise<CompletedScanResult> {
  const startedAt = new Date().toISOString();
  await input.onProgress?.({ status: "crawling", pagesQueued: 0, pagesScanned: 0, findingsTotal: 0 });

  const crawl = input.request.mode === "same_domain_crawl"
    ? await crawlSameDomain({
        startUrl: input.request.targetUrl,
        maxPages: input.request.maxPages,
        maxDepth: input.request.maxDepth,
        respectRobotsTxt: input.request.respectRobotsTxt,
        allowLocalhost: input.allowLocalhost
      })
    : await crawlStaticSeed({ startUrl: input.request.targetUrl, maxPages: input.request.maxPages, allowLocalhost: input.allowLocalhost });

  const browser = await chromium.launch({ headless: true });
  const pages = [];
  const findings = [];

  try {
    for (const url of crawl.urls) {
      for (const viewport of input.request.viewports) {
        await input.onProgress?.({ status: "auditing", pagesQueued: crawl.urls.length * input.request.viewports.length, pagesScanned: pages.length, findingsTotal: findings.length });
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
        const audit = await auditPage({ page, url, normalizedUrl: normalizeAuditUrl(url), viewport });
        for (const finding of audit.findings) {
          finding.evidence = await captureEvidence({ runId: input.request.runId, page, finding, storage: input.storage });
          findings.push(finding);
        }
        pages.push(audit.page);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  await input.onProgress?.({ status: "reporting", pagesQueued: crawl.urls.length * input.request.viewports.length, pagesScanned: pages.length, findingsTotal: findings.length });
  const score = calculateScore(findings);
  const reportModel = buildAuditReportModel({
    request: input.request,
    pages,
    findings,
    score,
    generatedAt: new Date().toISOString()
  });
  const html = renderReportHtml(reportModel);
  const htmlStored = await input.storage.put(createArtifactKey({ runId: input.request.runId, kind: "report", name: "report", extension: "html" }), Buffer.from(html), "text/html");
  const pdfStored = await input.storage.put(createArtifactKey({ runId: input.request.runId, kind: "report", name: "report", extension: "pdf" }), await renderPdfFromHtml(html), "application/pdf");

  return {
    runId: input.request.runId,
    projectId: input.request.projectId,
    targetUrl: input.request.targetUrl,
    mode: input.request.mode,
    pages,
    findings,
    reports: [
      { kind: "html", ...htmlStored },
      { kind: "pdf", ...pdfStored }
    ],
    score,
    startedAt,
    finishedAt: new Date().toISOString()
  };
}
```

- [ ] **Step 6: Export audit package APIs**

Create `packages/audit/src/index.ts`:

```ts
export * from "./evidence.js";
export * from "./scan-engine.js";
export * from "./score.js";
```

- [ ] **Step 7: Verify audit package**

Run:

```bash
rtk npm exec pnpm@9 -- install
rtk npm exec pnpm@9 -- vitest run packages/audit/src
rtk npm exec pnpm@9 -- --filter @a11yaudit/audit typecheck
```

Expected: PASS.

## Task 6: Reporter With Real Findings And Evidence

**Files:**
- Modify: `packages/reporter/src/report-model.ts`
- Modify: `packages/reporter/src/html-template.ts`
- Modify: `packages/reporter/src/html-template.test.ts`
- Modify: `packages/reporter/src/index.ts`

- [ ] **Step 1: Add report model builder tests**

Extend `packages/reporter/src/html-template.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAuditReportModel, renderReportHtml } from "./index.js";

describe("real report rendering", () => {
  it("renders executive summary, technical findings, and honesty disclaimer", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-1",
        projectId: "project-1",
        targetUrl: "https://example.com",
        mode: "single_url",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: true
      },
      pages: [],
      findings: [{
        id: "finding-1",
        title: "Images must have alternate text",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: ["1.1.1"],
        ruleId: "image-alt",
        description: "Ensures images have alternate text",
        recommendation: "Add meaningful alternate text.",
        pageUrl: "https://example.com",
        viewport: "desktop",
        selector: "img",
        htmlSnippet: "<img>",
        visibleText: null,
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
        fingerprint: "fingerprint",
        evidence: [],
        instances: 1
      }],
      score: 75,
      generatedAt: "2026-05-31T00:00:00.000Z"
    });

    const html = renderReportHtml(report);
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Images must have alternate text");
    expect(html).toContain("does not certify legal compliance");
  });
});
```

- [ ] **Step 2: Implement richer report model**

Update `packages/reporter/src/report-model.ts`:

```ts
import type { AuditedPage, ScanFinding, ScanRequest } from "@a11yaudit/core";

export interface AuditReportModel {
  projectName: string;
  domain: string;
  score: number;
  pagesAudited: number;
  findingsTotal: number;
  generatedAt: string;
  findings: ScanFinding[];
  pages: AuditedPage[];
  targetUrl: string;
  mode: string;
}

export function buildAuditReportModel(input: {
  request: ScanRequest;
  pages: AuditedPage[];
  findings: ScanFinding[];
  score: number;
  generatedAt: string;
}): AuditReportModel {
  const url = new URL(input.request.targetUrl);
  return {
    projectName: url.hostname,
    domain: url.hostname,
    targetUrl: input.request.targetUrl,
    mode: input.request.mode,
    score: input.score,
    pagesAudited: input.pages.length,
    findingsTotal: input.findings.length,
    generatedAt: input.generatedAt,
    findings: input.findings,
    pages: input.pages
  };
}
```

- [ ] **Step 3: Render technical findings table and evidence references**

Update `renderReportHtml(report)` so it includes:

- Executive Summary.
- Audit Scope.
- Severity Summary.
- Technical Findings table.
- Evidence Appendix with artifact keys.
- Manual Review Notice.
- Existing compliance honesty disclaimer.

- [ ] **Step 4: Verify reporter tests and PDF render**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run packages/reporter/src
rtk npm exec pnpm@9 -- --filter @a11yaudit/reporter typecheck
```

Expected: PASS.

## Task 7: Server Worker Persistence

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/jobs/local-job-runner.ts`
- Modify: `apps/server/src/routes/scans.ts`
- Modify: `apps/server/src/routes/reports.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] **Step 1: Add server dependency on audit package**

Update `apps/server/package.json` dependencies:

```json
"@a11yaudit/audit": "workspace:*"
```

- [ ] **Step 2: Extend schema for score and evidence fields**

Modify `scanRuns` in `apps/server/src/db/schema.ts`:

```ts
score: integer("score"),
```

Modify `findings`:

```ts
viewport: text("viewport").notNull().default("desktop"),
certainty: text("certainty").notNull().default("automatic_violation"),
evidence: text("evidence").notNull().default("[]"),
fingerprint: text("fingerprint").notNull().default(""),
```

- [ ] **Step 3: Replace passive queue with executing worker**

Update `apps/server/src/jobs/local-job-runner.ts` so `enqueue` starts async execution:

```ts
export interface LocalJobRunnerOptions<TPayload> {
  execute: (job: LocalJob<TPayload>) => Promise<void>;
}

export class LocalJobRunner<TPayload> {
  private readonly jobs = new Map<string, LocalJob<TPayload>>();

  constructor(private readonly options?: LocalJobRunnerOptions<TPayload>) {}

  enqueue(id: string, payload: TPayload): LocalJob<TPayload> {
    const job: LocalJob<TPayload> = { id, payload, status: "queued" };
    this.jobs.set(id, job);
    void this.run(job);
    return job;
  }

  private async run(job: LocalJob<TPayload>): Promise<void> {
    if (!this.options) return;
    job.status = "running";
    try {
      await this.options.execute(job);
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
  }
}
```

- [ ] **Step 4: Wire `runScan` into server app startup**

Create the runner in `apps/server/src/app.ts` with an `execute` callback that:

- Updates `scan_runs.status` to `crawling`, `auditing`, `reporting`, `completed`, or `failed`.
- Creates `LocalStorageAdapter` rooted at `.a11yaudit/artifacts`.
- Calls `runScan`.
- Inserts grouped findings into `findings`.
- Inserts HTML and PDF rows into `reports`.
- Stores `score`, `pagesQueued`, `pagesScanned`, `findingsTotal`, `startedAt`, `finishedAt`.

- [ ] **Step 5: Expand scan API payload**

Update `apps/server/src/routes/scans.ts` schema:

```ts
const scanPayloadSchema = z.object({
  projectId: z.string().trim().min(1),
  url: z.string().trim().min(1),
  mode: z.enum(["single_url", "same_domain_crawl"]).default("single_url"),
  maxPages: z.number().int().min(1).max(250).default(10),
  maxDepth: z.number().int().min(0).max(5).default(1),
  viewports: z.array(z.enum(["desktop", "mobile"])).min(1).default(["desktop", "mobile"])
});
```

- [ ] **Step 6: Add report download endpoint**

Modify `apps/server/src/routes/reports.ts` to serve artifact bytes:

```ts
app.get("/api/reports/:id/download", async (request, reply) => {
  const { id } = request.params as { id: string };
  const report = db.select().from(reports).where(eq(reports.id, id)).get();
  if (!report) return reply.code(404).send({ error: "Report not found" });
  const body = await storage.get(report.artifactKey);
  return reply.header("content-type", report.mimeType).send(body);
});
```

- [ ] **Step 7: Add server integration test**

Extend `apps/server/src/app.test.ts`:

```ts
it("executes queued scan and persists findings and reports", async () => {
  const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Fixture", url: fixtureOrigin } });
  const projectBody = project.json();
  const scan = await app.inject({ method: "POST", url: "/api/scans", payload: { projectId: projectBody.id, url: fixtureOrigin, mode: "single_url", maxPages: 1 } });
  expect(scan.statusCode).toBe(201);

  await waitFor(async () => {
    const scans = await app.inject({ method: "GET", url: "/api/scans" });
    expect(scans.json().data[0].status).toBe("completed");
  });

  const findingsResponse = await app.inject({ method: "GET", url: "/api/findings" });
  expect(findingsResponse.json().data.length).toBeGreaterThan(0);
  const reportsResponse = await app.inject({ method: "GET", url: "/api/reports" });
  expect(reportsResponse.json().data.some((report: { kind: string }) => report.kind === "pdf")).toBe(true);
});
```

- [ ] **Step 8: Verify server**

Run:

```bash
rtk npm exec pnpm@9 -- vitest run apps/server/src/app.test.ts
rtk npm exec pnpm@9 -- --filter @a11yaudit/server typecheck
```

Expected: PASS.

## Task 8: CLI Uses Real Audit Engine

**Files:**
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`

- [ ] **Step 1: Add CLI dependency on audit package**

Update `apps/cli/package.json` dependencies:

```json
"@a11yaudit/audit": "workspace:*"
```

- [ ] **Step 2: Extend CLI options**

Update `scan` command options in `apps/cli/src/index.ts`:

```ts
.option("--mobile", "include mobile viewport", true)
.option("--desktop", "include desktop viewport", true)
.option("--mode <mode>", "scan mode: single-url or same-domain-crawl", "single-url")
.option("--max-pages <number>", "maximum pages for crawl mode", "10")
.option("--max-depth <number>", "maximum crawl depth", "1")
```

- [ ] **Step 3: Replace smoke report with `runScan`**

In the CLI action:

```ts
const result = await runScan({
  request: {
    runId: `cli-${Date.now()}`,
    projectId: null,
    targetUrl: auditUrl.href,
    mode: options.mode === "same-domain-crawl" ? "same_domain_crawl" : "single_url",
    viewports,
    maxPages: Number(options.maxPages),
    maxDepth: Number(options.maxDepth),
    respectRobotsTxt: true
  },
  storage
});

console.log(`A11yAudit completed: ${result.pages.length} page viewport(s) processed`);
console.log(`Findings: ${result.findings.length}`);
console.log(`Score: ${result.score}`);
console.log(`Artifacts written to ${outputDir}`);
```

- [ ] **Step 4: Update CLI tests**

Add assertions that CLI output includes `Findings:` and `Score:` after scanning a local fixture page.

- [ ] **Step 5: Verify CLI against the previously tested domain**

Run:

```bash
rtk npm exec pnpm@9 -- --filter @a11yaudit/cli dev -- scan https://www.admelektrik.com.tr/ --pdf --out .a11yaudit-admelektrik-real --mode single-url
```

Expected: CLI reports real pages processed, non-synthetic score, and real artifact files.

## Task 9: Web UI Live Scan State And Report Download

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/pages/scan-runs.tsx`
- Modify: `apps/web/src/pages/reports.tsx`

- [ ] **Step 1: Add API client download URL helper**

In `apps/web/src/api/client.ts`:

```ts
export function getReportDownloadUrl(reportId: string): string | null {
  if (apiBaseUrl === undefined || apiBaseUrl.trim() === "") return null;
  return new URL(`/api/reports/${reportId}/download`, apiBaseUrl).href;
}
```

- [ ] **Step 2: Poll scan runs while active**

Update scan-runs query usage so statuses `queued`, `crawling`, `auditing`, and `reporting` refetch every 2 seconds.

- [ ] **Step 3: Enable report download only for persisted reports**

Update report buttons to use `getReportDownloadUrl(report.id)`. Keep buttons disabled when API base URL is missing or report status is not ready.

- [ ] **Step 4: Verify web integration**

Start both servers:

```bash
rtk npm exec pnpm@9 -- --filter @a11yaudit/server dev
rtk env VITE_A11YAUDIT_API_BASE_URL=http://localhost:7842 npm exec pnpm@9 -- --filter @a11yaudit/web dev
```

Then verify in Browser:

- Create or select a project.
- Start a scan.
- Watch status progress beyond `queued`.
- Confirm findings appear.
- Confirm a PDF report row appears.
- Confirm PDF download endpoint returns `application/pdf`.

## Task 10: Final Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`

- [ ] **Step 1: Document real scan support**

Update `README.md` with:

```md
## CLI Real Scan

```bash
pnpm --filter @a11yaudit/cli dev -- scan https://example.com --pdf --out .a11yaudit-example --mode single-url
pnpm --filter @a11yaudit/cli dev -- scan https://example.com --pdf --out .a11yaudit-example --mode same-domain-crawl --max-pages 10 --max-depth 1
```

The report is an automated technical accessibility audit. It is not a legal certification and does not replace manual WCAG review.
```

- [ ] **Step 2: Document Linux Playwright requirement**

Update `README.md`:

```md
## Playwright On Linux

A11yAudit uses Playwright Chromium for page rendering, axe-core execution, screenshots, and PDF generation.

Install browsers after dependency installation:

```bash
pnpm exec playwright install --with-deps chromium
```
```

- [ ] **Step 3: Document scan safety boundary**

Update `SECURITY.md`:

```md
## URL Fetching Boundary

A11yAudit rejects private, loopback, link-local, and unsupported protocol targets for normal scans. Localhost is allowed only inside tests. Redirect validation and DNS rebinding hardening remain security-sensitive areas and should be reviewed before exposing the server outside a trusted network.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
rtk npm exec pnpm@9 -- install
rtk npm exec pnpm@9 -- test
rtk npm exec pnpm@9 -- typecheck
rtk npm exec pnpm@9 -- -r build
rtk npm exec pnpm@9 -- --filter @a11yaudit/cli dev -- scan https://www.admelektrik.com.tr/ --pdf --out .a11yaudit-admelektrik-real --mode single-url
```

Expected:

- All tests pass.
- Typecheck passes.
- Build passes.
- CLI produces real HTML and PDF artifacts.
- CLI no longer reports synthetic zero findings unless the audited page actually has zero automated findings.

## Risk Register

- **WCAG completeness:** Automated tests cannot prove full WCAG compliance. Mitigation: report labels findings as automated technical violations and keeps manual review notice.
- **SSRF/private network exposure:** User-supplied URLs are dangerous. Mitigation: keep `assertSafeUrl`, validate redirects, reject private ranges, and keep localhost allowance test-only.
- **Long-running scans:** Crawls can become expensive. Mitigation: enforce max pages, max depth, navigation timeout, and per-page timeout.
- **Dynamic sites:** `networkidle` can hang on analytics-heavy pages. Mitigation: use bounded timeout and persist page-level errors without failing the entire run.
- **Evidence storage size:** Full-page screenshots can grow quickly. Mitigation: local MVP stores bounded page counts; later add retention settings and optional object storage adapter.

## Acceptance Criteria

- A Web UI scan does not remain queued indefinitely.
- CLI and server use the same `runScan` implementation.
- Single URL scans audit both desktop and mobile by default.
- Same-domain crawl discovers multiple pages within configured limits.
- Findings are generated from axe/custom rule execution, not placeholder data.
- PDF report contains real pages, findings, severity summary, evidence references, and honesty disclaimer.
- Report download works from the Web UI when API mode is enabled.
- Full test, typecheck, and build commands pass.
