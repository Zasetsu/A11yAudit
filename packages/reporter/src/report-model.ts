import { aggregateScanIssues, type AggregatedIssue, type AuditedPage, type ScanFinding, type ScanRequest, type Severity } from "@a11yaudit/core";

export type SeveritySummary = Record<Severity, number>;

export interface AuditReportModel {
  projectName: string;
  domain: string;
  score: number;
  pagesAudited: number;
  findingsTotal: number;
  uniqueIssues: number;
  totalOccurrences: number;
  generatedAt: string;
  findings: ScanFinding[];
  issues: AggregatedIssue[];
  pages: AuditedPage[];
  targetUrl: string;
  mode: string;
  severitySummary?: SeveritySummary;
}

export function buildAuditReportModel(input: {
  request: ScanRequest;
  pages: AuditedPage[];
  findings: ScanFinding[];
  score: number;
  generatedAt: string;
}): AuditReportModel {
  const url = new URL(input.request.targetUrl);
  const issues = aggregateScanIssues(input.findings, { auditedPages: input.pages });

  return {
    projectName: url.hostname,
    domain: url.hostname,
    targetUrl: input.request.targetUrl,
    mode: input.request.mode,
    score: input.score,
    pagesAudited: input.pages.length,
    findingsTotal: input.findings.length,
    uniqueIssues: issues.length,
    totalOccurrences: issues.reduce((total, issue) => total + issue.occurrences, 0),
    generatedAt: input.generatedAt,
    findings: input.findings,
    issues,
    pages: input.pages,
    severitySummary: summarizeSeverity(issues)
  };
}

function summarizeSeverity(issues: AggregatedIssue[]): SeveritySummary {
  return issues.reduce<SeveritySummary>((summary, issue) => {
    summary[issue.severity] += 1;
    return summary;
  }, {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  });
}
