import type { ReportLocale } from "@a11yaudit/core";
import {
  SEVERITY_COLORS,
  formatMode,
  formatReportDate,
  reportStrings,
  scoreBand,
  severityLabel,
  type ReportStrings,
} from "./i18n.js";
import type { AuditReportModel, ReportProblem, SeveritySummary } from "./report-model.js";

export interface RenderReportHtmlOptions {
  maxDetailedFindings?: number;
  maxEvidenceRows?: number;
}

export function renderReportHtml(report: AuditReportModel, options: RenderReportHtmlOptions = {}): string {
  const locale: ReportLocale = report.locale ?? "tr";
  const strings = reportStrings(locale);
  const issues = report.issues ?? [];
  const severitySummary = report.severitySummary ?? summarizeSeverity(report);
  const failedPages = report.pages.filter((page) => page.errorMessage !== null).length;
  const uniqueIssues = report.uniqueIssues ?? issues.length;
  const totalOccurrences = report.totalOccurrences ?? issues.reduce((total, issue) => total + issue.occurrences, 0);
  const affectedPages = countAffectedPagesFromIssues(issues);
  const band = scoreBand(report.score, locale);
  const problems = report.problems ?? [];

  // severity color legend entries (ensures all hex colors appear in the document)
  const severityLegend = (["critical", "serious", "moderate", "minor"] as const)
    .map((sev) => `<span class="sev" style="background:${SEVERITY_COLORS[sev]}">${escapeHtml(severityLabel(sev, locale))}</span>`)
    .join(" ");

  // top-5 fix-first list
  const top5 = problems.slice(0, 5);
  const fixFirstList = top5.length === 0
    ? `<p>—</p>`
    : `<ol>${top5.map((p) =>
        `<li><strong>${escapeHtml(p.title)}</strong> — WCAG ${escapeHtml(p.wcagCriteria.join(", "))} · ${p.occurrences} ${escapeHtml(strings.occurrences)}</li>`
      ).join("")}</ol>`;

  const allIssuesHtml = problems.length === 0
    ? `<p>—</p>`
    : problems.map((p) => renderProblemCard(p, strings, locale)).join("");


  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(strings.reportTitle)} - ${escapeHtml(report.projectName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1d1b18; margin: 40px; }
    h1, h2, h3 { margin: 0 0 12px; }
    h2 { margin-top: 32px; }
    .meta { color: #595550; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #e6e2da; border-radius: 8px; padding: 14px; }
    .value { font-size: 28px; font-weight: 700; }
    .score-band { font-size: 16px; font-weight: 600; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; }
    th, td { border: 1px solid #e6e2da; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f4f1ec; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
    .limit-note { margin: 8px 0 12px; padding: 10px 12px; border-left: 4px solid #315fba; background: #eef3ff; color: #25324a; }
    .notice,
    .disclaimer { margin-top: 32px; padding: 12px; border: 1px solid #d4cfc5; background: #f4f1ec; }
    /* severity pill */
    .sev { display: inline-block; color: #fff; border-radius: 4px; padding: 2px 8px; font-size: 0.82em; font-weight: 600; }
    /* problem cards */
    .problem { margin-bottom: 20px; }
    .problem-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .wcag-line { font-size: 0.88em; color: #595550; margin-bottom: 10px; }
    .block { margin: 8px 0; }
    /* element evidence */
    .element { display: flex; gap: 12px; margin: 8px 0; align-items: flex-start; }
    .element-detail { flex: 1; min-width: 0; }
    .element-meta { font-size: 0.82em; color: #595550; margin-top: 4px; }
    .snippet { background: #1d1b18; color: #e6e2da; padding: 10px 12px; border-radius: 4px; overflow: auto; font-size: 0.85em; margin: 4px 0; white-space: pre-wrap; word-break: break-all; }
    .shot { max-width: 120px; border: 1px solid #e6e2da; border-radius: 4px; }
  </style>
</head>
<body>

  <!-- COVER -->
  <h1>${escapeHtml(strings.reportTitle)}</h1>
  <div class="meta">
    ${escapeHtml(report.domain)} ·
    ${escapeHtml(formatReportDate(report.generatedAt, locale))} ·
    ${escapeHtml(formatMode(report.mode, locale))} ·
    ${report.pagesAudited} ${escapeHtml(strings.pagesAudited)}
  </div>
  <div class="grid">
    <div class="card">
      <div>${escapeHtml(strings.scoreOutOf)}</div>
      <div class="value">${report.score}</div>
      <div class="score-band" style="color:${band.color}">${escapeHtml(band.label)}</div>
    </div>
    <div class="card"><div>Unique Issues</div><div class="value">${uniqueIssues}</div></div>
    <div class="card"><div>Affected Pages</div><div class="value">${affectedPages}</div></div>
    <div class="card"><div>Total Occurrences</div><div class="value">${totalOccurrences}</div></div>
    <div class="card"><div>Pages Audited</div><div class="value">${report.pagesAudited}</div></div>
  </div>

  <!-- AT A GLANCE -->
  <h2>${escapeHtml(strings.atAGlance)}</h2>
  <div style="margin-bottom:12px">${severityLegend}</div>
  <table>
    <thead>
      <tr>
        <th><span class="sev" style="background:${SEVERITY_COLORS.critical}">${escapeHtml(severityLabel("critical", locale))}</span></th>
        <th><span class="sev" style="background:${SEVERITY_COLORS.serious}">${escapeHtml(severityLabel("serious", locale))}</span></th>
        <th><span class="sev" style="background:${SEVERITY_COLORS.moderate}">${escapeHtml(severityLabel("moderate", locale))}</span></th>
        <th><span class="sev" style="background:${SEVERITY_COLORS.minor}">${escapeHtml(severityLabel("minor", locale))}</span></th>
      </tr>
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

  <!-- FIX THESE FIRST -->
  <h2>${escapeHtml(strings.fixFirst)}</h2>
  ${fixFirstList}

  <!-- ALL ISSUES (grouped problem cards) -->
  <h2>${escapeHtml(strings.allIssues)}</h2>
  ${allIssuesHtml}

  <!-- MANUAL REVIEW + DISCLAIMER -->
  <div class="notice">${escapeHtml(strings.manualReview)}</div>

  <div class="disclaimer">${escapeHtml(strings.disclaimer)}</div>

  <!-- TECHNICAL APPENDIX -->
  <h2>${escapeHtml(strings.technicalAppendix)}</h2>
  ${renderFindingsTable(report, options.maxDetailedFindings)}
  ${renderEvidenceAppendix(report, options.maxEvidenceRows)}

</body>
</html>`;
}

function renderProblemCard(problem: ReportProblem, strings: ReportStrings, locale: ReportLocale): string {
  const sevColor = SEVERITY_COLORS[problem.severity];
  const crit = problem.criterion;
  const wcagLine = crit
    ? `<a href="${escapeHtml(crit.w3cUrl)}">WCAG ${escapeHtml(crit.id)} — ${escapeHtml(crit.name)} (${escapeHtml(crit.level)})</a>`
    : escapeHtml(problem.wcagCriteria.join(", "));
  const impact = crit ? escapeHtml(crit.content.userImpact) : "";
  const fix = crit ? escapeHtml(crit.content.howToFix) : "";
  const elements = problem.elements.map((el) => `
    <div class="element">
      ${el.screenshotDataUri ? `<img class="shot" alt="" src="${el.screenshotDataUri}" />` : ""}
      <div class="element-detail">
        <pre class="snippet">${escapeHtml(el.htmlSnippet ?? "")}</pre>
        <div class="element-meta">${strings.selector} <code>${escapeHtml(el.selector ?? "—")}</code> · ${strings.page} ${escapeHtml(el.pageUrl)} · ${escapeHtml(el.viewport)}</div>
      </div>
    </div>`).join("");

  return `<div class="card problem">
    <div class="problem-head"><span class="sev" style="background:${sevColor}">${escapeHtml(severityLabel(problem.severity, locale))}</span> <strong>${escapeHtml(problem.title)}</strong></div>
    <div class="wcag-line">${wcagLine} · ${problem.occurrences} ${escapeHtml(strings.occurrences)} · ${problem.affectedPages} ${escapeHtml(strings.affectedPages)}</div>
    <div class="block"><b>${escapeHtml(strings.whatItMeans)}</b><br>${impact}</div>
    <div class="block"><b>${escapeHtml(strings.howToFix)}</b><br>${fix}</div>
    <div class="block"><b>${escapeHtml(strings.whereFound)} (${problem.elements.length})</b>${elements}</div>
  </div>`;
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

function summarizeSeverity(report: AuditReportModel): SeveritySummary {
  const severities = report.issues.length > 0
    ? report.issues.map((issue) => issue.severity)
    : report.findings.map((finding) => finding.severity);

  return severities.reduce<SeveritySummary>((summary, severity) => {
    summary[severity] += 1;
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
