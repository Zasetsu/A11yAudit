import { describe, expect, it } from "vitest";
import type { Issue } from "../data";
import { issueOverviewMetrics } from "./overview";
import { sortIssuesForTriage } from "./findings";

function issue(overrides: Partial<Issue>): Issue {
  return {
    id: "issue-1",
    projectId: "project-1",
    scanRunId: "run-1",
    issueKey: "rule|1.1.1|scope|/*|main|hint",
    title: "Issue",
    severity: "moderate",
    source: "axe",
    certainty: "automatic_violation",
    status: "ongoing",
    ruleId: "rule",
    wcagCriteria: "1.1.1",
    description: "Description",
    recommendation: "Recommendation",
    likelyScope: "Shared component",
    urlScopeGroup: "/*",
    componentArea: "main",
    cmsHint: "CMS hint",
    confidence: "medium",
    affectedPages: 1,
    occurrences: 1,
    viewportSummary: "desktop",
    representativeUrl: "https://example.com/",
    representativeSelector: null,
    representativeHtmlSnippet: null,
    sampleUrls: ["https://example.com/"],
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

describe("grouped issue presentation", () => {
  it("sorts triage rows by severity, affected pages, then occurrences", () => {
    const moderateLarge = issue({ id: "moderate-large", severity: "moderate", affectedPages: 50, occurrences: 80 });
    const criticalSmall = issue({ id: "critical-small", severity: "critical", affectedPages: 1, occurrences: 1 });
    const seriousMoreOccurrences = issue({ id: "serious-more-occurrences", severity: "serious", affectedPages: 10, occurrences: 40 });
    const seriousFewerOccurrences = issue({ id: "serious-fewer-occurrences", severity: "serious", affectedPages: 10, occurrences: 20 });

    expect(sortIssuesForTriage([moderateLarge, seriousFewerOccurrences, criticalSmall, seriousMoreOccurrences]).map((row) => row.id)).toEqual([
      "critical-small",
      "serious-more-occurrences",
      "serious-fewer-occurrences",
      "moderate-large"
    ]);
  });

  it("counts unique sampled URLs and occurrence totals for overview metrics", () => {
    const metrics = issueOverviewMetrics([
      issue({
        id: "critical",
        severity: "critical",
        occurrences: 4,
        sampleUrls: ["https://example.com/a", "https://example.com/b"]
      }),
      issue({
        id: "serious",
        severity: "serious",
        occurrences: 7,
        sampleUrls: ["https://example.com/b", "https://example.com/c"]
      })
    ]);

    expect(metrics).toEqual({
      affectedPages: 3,
      criticalIssues: 1,
      totalOccurrences: 11,
      uniqueIssues: 2
    });
  });
});
