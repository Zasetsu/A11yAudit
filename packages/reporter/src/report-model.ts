import {
  aggregateScanIssues,
  getCriterionContent,
  WCAG_22_CRITERIA,
  type AggregatedIssue,
  type AuditedPage,
  type ReportLocale,
  type ScanFinding,
  type ScanRequest,
  type Severity,
  type WcagCriterionContent,
} from "@a11yaudit/core";

export type SeveritySummary = Record<Severity, number>;

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

export interface ReportElement {
  htmlSnippet: string | null;
  selector: string | null;
  pageUrl: string;
  viewport: string;
  screenshotDataUri: string | null;
}

export interface ReportProblemCriterion {
  id: string;
  name: string;
  level: string;
  content: WcagCriterionContent;
  w3cUrl: string;
}

export interface ReportProblem {
  ruleId: string;
  title: string;
  severity: Severity;
  wcagCriteria: string[];
  criterion: ReportProblemCriterion | null;
  elements: ReportElement[];
  affectedPages: number;
  occurrences: number;
}

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
  locale: ReportLocale;
  problems: ReportProblem[];
}

function preferredScreenshotKey(finding: ScanFinding): string | null {
  // Only element crops are embedded inline — they are small and element-specific.
  // Full-page screenshots are NOT inlined (they would bloat the report to hundreds of
  // MB when many elements share a page); they remain downloadable evidence artifacts.
  const crop = finding.evidence.find((e) => e.kind === "element_screenshot");
  return crop ? crop.artifactKey : null;
}

export function buildReportProblems(
  findings: ScanFinding[],
  locale: ReportLocale,
  screenshotDataUris: Map<string, string>
): ReportProblem[] {
  const byRule = new Map<string, ScanFinding[]>();
  for (const finding of findings) {
    const list = byRule.get(finding.ruleId) ?? [];
    list.push(finding);
    byRule.set(finding.ruleId, list);
  }

  const problems: ReportProblem[] = [];
  for (const [ruleId, group] of byRule) {
    const first = group[0];
    const criterionId = first.wcagCriteria[0];
    const meta = criterionId ? WCAG_22_CRITERIA[criterionId] : undefined;
    const content = criterionId ? getCriterionContent(criterionId, locale) : null;
    const criterion: ReportProblemCriterion | null = meta && content
      ? { id: meta.id, name: content.name, level: meta.level, content, w3cUrl: content.w3cUrl }
      : null;

    const elements: ReportElement[] = group.map((finding) => {
      const key = preferredScreenshotKey(finding);
      return {
        htmlSnippet: finding.htmlSnippet,
        selector: finding.selector,
        pageUrl: finding.pageUrl,
        viewport: finding.viewport,
        screenshotDataUri: key ? screenshotDataUris.get(key) ?? null : null
      };
    });

    problems.push({
      ruleId,
      title: first.title,
      severity: first.severity,
      wcagCriteria: first.wcagCriteria,
      criterion,
      elements,
      affectedPages: new Set(group.map((f) => f.pageUrl)).size,
      occurrences: group.length
    });
  }

  problems.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.occurrences - a.occurrences);
  return problems;
}

export function buildAuditReportModel(input: {
  request: ScanRequest;
  pages: AuditedPage[];
  findings: ScanFinding[];
  score: number;
  generatedAt: string;
  locale?: ReportLocale;
  screenshotDataUris?: Map<string, string>;
}): AuditReportModel {
  const url = new URL(input.request.targetUrl);
  const issues = aggregateScanIssues(input.findings, { auditedPages: input.pages });
  const locale = input.locale ?? "tr";
  const screenshotDataUris = input.screenshotDataUris ?? new Map();
  const problems = buildReportProblems(input.findings, locale, screenshotDataUris);

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
    severitySummary: summarizeSeverity(issues),
    locale,
    problems
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
