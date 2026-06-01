import type { AuditReportModel, SeveritySummary } from "./report-model.js";

export interface RenderReportHtmlOptions {
  maxDetailedFindings?: number;
  maxEvidenceRows?: number;
}

export function renderReportHtml(report: AuditReportModel, options: RenderReportHtmlOptions = {}): string {
  const severitySummary = report.severitySummary ?? summarizeSeverityFromFindings(report);
  const failedPages = report.pages.filter((page) => page.errorMessage !== null).length;
  const issues = report.issues ?? [];
  const uniqueIssues = report.uniqueIssues ?? issues.length;
  const totalOccurrences = report.totalOccurrences ?? issues.reduce((total, issue) => total + issue.occurrences, 0);
  const affectedPages = countAffectedPagesFromIssues(issues);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>A11yAudit Report - ${escapeHtml(report.projectName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1d1b18; margin: 40px; }
    h1, h2, h3 { margin: 0 0 12px; }
    h2 { margin-top: 32px; }
    .meta { color: #595550; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #e6e2da; border-radius: 8px; padding: 14px; }
    .value { font-size: 28px; font-weight: 700; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; }
    th, td { border: 1px solid #e6e2da; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f4f1ec; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
    .limit-note { margin: 8px 0 12px; padding: 10px 12px; border-left: 4px solid #315fba; background: #eef3ff; color: #25324a; }
    .notice,
    .disclaimer { margin-top: 32px; padding: 12px; border: 1px solid #d4cfc5; background: #f4f1ec; }
  </style>
</head>
<body>
  <h1>Accessibility Audit Report</h1>
  <div class="meta">${escapeHtml(report.projectName)} · ${escapeHtml(report.domain)} · ${escapeHtml(report.generatedAt)}</div>

  <h2>Executive Summary</h2>
  <p>A11yAudit scanned ${report.pagesAudited} page and viewport combination${report.pagesAudited === 1 ? "" : "s"} for ${escapeHtml(report.domain)} and found ${uniqueIssues} unique issue${uniqueIssues === 1 ? "" : "s"} across ${totalOccurrences} occurrence${totalOccurrences === 1 ? "" : "s"}.</p>
  <div class="grid">
    <div class="card"><div>Score</div><div class="value">${report.score}</div></div>
    <div class="card"><div>Unique Issues</div><div class="value">${uniqueIssues}</div></div>
    <div class="card"><div>Affected Pages</div><div class="value">${affectedPages}</div></div>
    <div class="card"><div>Total Occurrences</div><div class="value">${totalOccurrences}</div></div>
    <div class="card"><div>Pages Audited</div><div class="value">${report.pagesAudited}</div></div>
  </div>

  <h2>Audit Scope</h2>
  <table>
    <tbody>
      <tr><th>Target URL</th><td>${escapeHtml(report.targetUrl)}</td></tr>
      <tr><th>Mode</th><td>${escapeHtml(report.mode)}</td></tr>
      <tr><th>Domain</th><td>${escapeHtml(report.domain)}</td></tr>
      <tr><th>Pages with Errors</th><td>${failedPages}</td></tr>
    </tbody>
  </table>

  <h2>Severity Summary</h2>
  <table>
    <thead>
      <tr><th>Critical</th><th>Serious</th><th>Moderate</th><th>Minor</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${severitySummary.critical}</td>
        <td>${severitySummary.serious}</td>
        <td>${severitySummary.moderate}</td>
        <td>${severitySummary.minor}</td>
      </tr>
    </tbody>
  </table>

  <h2>Grouped Issues</h2>
  ${renderGroupedIssuesTable(report, options.maxDetailedFindings)}

  <h2>Raw Occurrence Appendix</h2>
  ${renderFindingsTable(report, options.maxDetailedFindings)}

  <h2>Evidence Appendix</h2>
  ${renderEvidenceAppendix(report, options.maxEvidenceRows)}

  <h2>Manual Review Notice</h2>
  <div class="notice">Automated scan results can identify many technical accessibility issues, but some WCAG 2.2 success criteria require manual review, assistive technology checks, and human judgment.</div>

  <div class="disclaimer">A11yAudit provides automated technical accessibility audit results. It does not certify legal compliance. Some WCAG 2.2 success criteria require manual review and human judgment.</div>
</body>
</html>`;
}

function renderGroupedIssuesTable(report: AuditReportModel, maxDetailedFindings?: number): string {
  const issues = report.issues ?? [];

  if (issues.length === 0) {
    return "<p>No grouped issues were detected by the automated scan.</p>";
  }

  const visibleIssues = limitItems(issues, maxDetailedFindings);
  const hiddenCount = issues.length - visibleIssues.length;
  const limitNote = hiddenCount > 0
    ? `<div class="limit-note">Showing ${visibleIssues.length} of ${issues.length} grouped issues. ${hiddenCount} additional grouped issues are summarized in the issue totals and remain available in the stored scan data.</div>`
    : "";
  const rows = visibleIssues.map((issue) => `<tr>
    <td>${escapeHtml(issue.title)}</td>
    <td>${escapeHtml(issue.severity)}</td>
    <td>${escapeHtml(issue.wcagCriteria.join(", "))}</td>
    <td>${escapeHtml(issue.likelyScope)}</td>
    <td>${escapeHtml(issue.componentArea)}</td>
    <td>${escapeHtml(issue.cmsHint)}</td>
    <td>${issue.affectedPages}</td>
    <td>${issue.occurrences}</td>
    <td>${escapeHtml(formatSampleUrls(issue.sampleUrls))}</td>
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

function renderFindingsTable(report: AuditReportModel, maxDetailedFindings?: number): string {
  if (report.findings.length === 0) {
    return "<p>No raw occurrences were detected by the automated scan.</p>";
  }

  const visibleFindings = limitItems(report.findings, maxDetailedFindings);
  const hiddenCount = report.findings.length - visibleFindings.length;
  const limitNote = hiddenCount > 0
    ? `<div class="limit-note">Showing ${visibleFindings.length} of ${report.findings.length} raw occurrences. ${hiddenCount} additional raw occurrences are summarized in the issue and severity totals and remain available in the stored scan data.</div>`
    : "";
  const rows = visibleFindings.map((finding) => `<tr>
    <td>${escapeHtml(finding.severity)}</td>
    <td>${escapeHtml(finding.title)}</td>
    <td>${escapeHtml(finding.pageUrl)}</td>
    <td>${escapeHtml(finding.viewport)}</td>
    <td>${escapeHtml(finding.wcagCriteria.join(", "))}</td>
    <td>${escapeHtml(finding.ruleId)}</td>
    <td>${escapeHtml(finding.selector ?? "N/A")}</td>
    <td>${finding.instances}</td>
    <td>${escapeHtml(finding.recommendation)}</td>
  </tr>`).join("");

  return `${limitNote}<table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Occurrence</th>
        <th>Page</th>
        <th>Viewport</th>
        <th>WCAG</th>
        <th>Rule</th>
        <th>Selector</th>
        <th>Instances</th>
        <th>Recommendation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderEvidenceAppendix(report: AuditReportModel, maxEvidenceRows?: number): string {
  const evidenceRows = report.findings.flatMap((finding) => finding.evidence.map((evidence) => ({ finding, evidence })));
  const visibleEvidenceRows = limitItems(evidenceRows, maxEvidenceRows);
  const hiddenCount = evidenceRows.length - visibleEvidenceRows.length;
  const rows = visibleEvidenceRows.map(({ finding, evidence }) => `<tr>
    <td>${escapeHtml(finding.id)}</td>
    <td>${escapeHtml(finding.title)}</td>
    <td>${escapeHtml(evidence.kind)}</td>
    <td><code>${escapeHtml(evidence.artifactKey)}</code></td>
    <td>${escapeHtml(evidence.mimeType)}</td>
    <td>${evidence.sizeBytes}</td>
  </tr>`);

  if (evidenceRows.length === 0) {
    return "<p>No evidence artifacts were attached to the scan findings.</p>";
  }

  const limitNote = hiddenCount > 0
    ? `<div class="limit-note">Showing ${visibleEvidenceRows.length} of ${evidenceRows.length} evidence artifacts. ${hiddenCount} additional evidence artifacts remain available in storage.</div>`
    : "";

  return `${limitNote}<table>
    <thead>
      <tr>
        <th>Finding ID</th>
        <th>Finding</th>
        <th>Evidence Type</th>
        <th>Artifact Key</th>
        <th>MIME Type</th>
        <th>Size</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

function summarizeSeverityFromFindings(report: AuditReportModel): SeveritySummary {
  return report.findings.reduce<SeveritySummary>((summary, finding) => {
    summary[finding.severity] += 1;
    return summary;
  }, {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  });
}

function countAffectedPagesFromIssues(issues: AuditReportModel["issues"]): number {
  return new Set(issues.flatMap((issue) => issue.sampleUrls)).size;
}

function formatSampleUrls(sampleUrls: string[]): string {
  return sampleUrls.length === 0 ? "N/A" : sampleUrls.join(", ");
}

function limitItems<T>(items: T[], maxItems?: number): T[] {
  if (maxItems === undefined) {
    return items;
  }

  return items.slice(0, Math.max(0, maxItems));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char] ?? char);
}
