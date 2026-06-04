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
