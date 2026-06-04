import type { AggregatedIssue } from "./issues.js";
import type { FindingCertainty, FindingSource, Severity } from "./models.js";

export type DiffStatus = "new" | "ongoing" | "resolved";

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
