import { describe, expect, it } from "vitest";
import type { CompletedScanResult, ScanRequest } from "./index.js";
import { DEFAULT_SCAN_LIMITS, DEFAULT_VIEWPORTS, createFindingFingerprint } from "./index.js";

const scanRequestFixture = {
  runId: "run-1",
  projectId: null,
  targetUrl: "https://example.com",
  mode: "same_domain_crawl",
  urls: ["https://example.com/about"],
  viewports: DEFAULT_VIEWPORTS,
  maxPages: DEFAULT_SCAN_LIMITS.maxPages,
  maxDepth: DEFAULT_SCAN_LIMITS.maxDepth,
  respectRobotsTxt: DEFAULT_SCAN_LIMITS.respectRobotsTxt
} satisfies ScanRequest;

const completedScanResultFixture = {
  runId: scanRequestFixture.runId,
  projectId: scanRequestFixture.projectId,
  targetUrl: scanRequestFixture.targetUrl,
  mode: scanRequestFixture.mode,
  pages: [],
  findings: [],
  reports: [],
  score: 100,
  startedAt: "2026-05-31T00:00:00.000Z",
  finishedAt: "2026-05-31T00:01:00.000Z"
} satisfies CompletedScanResult;

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

  it("keeps scan result fixtures aligned with exported contracts", () => {
    expect(completedScanResultFixture.runId).toBe(scanRequestFixture.runId);
  });
});
