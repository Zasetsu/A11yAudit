import type { AuditedPage, ScanFinding, ScanRequest, Severity } from "@a11yaudit/core";

export type SeveritySummary = Record<Severity, number>;

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
    pages: input.pages,
    severitySummary: summarizeSeverity(input.findings)
  };
}

function summarizeSeverity(findings: ScanFinding[]): SeveritySummary {
  return findings.reduce<SeveritySummary>((summary, finding) => {
    summary[finding.severity] += 1;
    return summary;
  }, {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  });
}
