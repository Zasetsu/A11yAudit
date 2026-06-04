import { formatDate, severityMeta, type Issue, type Severity } from "../data";
import { Button, Icon, PageHeader, Panel, Progress, RunStatusBadge, ScoreRing, SeverityBadge } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { PageProps } from "./page-props";

export function issueOverviewMetrics(issues: Issue[]) {
  const sampledUrls = new Set<string>();
  let totalOccurrences = 0;
  let criticalIssues = 0;

  for (const issue of issues) {
    totalOccurrences += issue.occurrences;
    if (issue.severity === "critical") {
      criticalIssues += 1;
    }
    for (const url of issue.sampleUrls) {
      sampledUrls.add(url);
    }
  }

  return {
    affectedPages: sampledUrls.size,
    criticalIssues,
    totalOccurrences,
    uniqueIssues: issues.length
  };
}

function Stat({ icon, label, value, sub }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string | number; sub: string }) {
  return (
    <div className="stat">
      <div className="stat-label"><Icon name={icon} size={12} />{label}</div>
      <div className="stat-value tnum">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function OverviewPage({ project, scans, issues, navigate }: PageProps) {
  const { t, locale } = useT();
  const projectScans = scans.filter((scan) => scan.projectId === project.id);
  const projectIssues = issues.filter((issue) => issue.projectId === project.id);
  const issueMetrics = issueOverviewMetrics(projectIssues);
  const severityCounts = projectIssues.reduce<Record<Severity, number>>(
    (counts, issue) => {
      counts[issue.severity] += 1;
      return counts;
    },
    { critical: 0, serious: 0, moderate: 0, minor: 0 }
  );
  const total = Object.values(severityCounts).reduce((sum, value) => sum + value, 0) || 1;
  const activeRun = projectScans.find(
    (scan) => scan.status === "auditing" || scan.status === "crawling" || scan.status === "queued" || scan.status === "reporting"
  );
  const topIssues = [...projectIssues]
    .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || b.occurrences - a.occurrences)
    .slice(0, 5);

  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={
          <>
            <Button icon="download" onClick={() => navigate({ page: "reports" })}>{t("overview.latestPdf")}</Button>
            <Button icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">{t("common.startScan")}</Button>
          </>
        }
        breadcrumb={<><Icon name="globe" size={13} /><span className="mono">{project.domain}</span></>}
        subtitle={activeRun ? `Manual scan in progress: ${activeRun.id}` : `${t("projects.lastScan")}${formatDate(project.lastScan, locale, t("common.notAvailable"))}`}
        title={project.name}
      />

      <div className="split-grid score" style={{ marginBottom: 16 }}>
        <Panel>
          <div className="score-panel">
            <ScoreRing score={project.score} size={96} />
            <div>
              <div className="stat-label">{t("overview.accessibilityScore")}</div>
              <p className="panel-copy">{t("overview.scoreHint")}</p>
              <div className="note" style={{ marginTop: 10 }}><Icon name="info" size={14} /> {t("overview.scoreDisclaimer")}</div>
            </div>
          </div>
        </Panel>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Stat icon="list" label={t("overview.uniqueIssues")} sub={t("overview.groupedProblems")} value={issueMetrics.uniqueIssues} />
          <Stat icon="file-text" label={t("overview.affectedPages")} sub={t("overview.sampledFromIssues")} value={issueMetrics.affectedPages} />
          <Stat icon="circle-dot" label={t("overview.occurrences")} sub={t("overview.rawDetections")} value={issueMetrics.totalOccurrences} />
          <Stat icon="alert-octagon" label={t("overview.criticalIssues")} sub={t("overview.highestSeverity")} value={issueMetrics.criticalIssues} />
        </div>
      </div>

      <div className="split-grid three" style={{ marginBottom: 16 }}>
        <Panel action={<Button iconRight="arrow-right" onClick={() => navigate({ page: "findings" })} size="sm" variant="ghost">{t("overview.triage")}</Button>} title={t("overview.issuesBySeverity")}>
          <div className="severity-meter" aria-label={t("overview.severityDistribution")}>
            {(["critical", "serious", "moderate", "minor"] as const).map((level) => (
              <i className={level} key={level} style={{ width: `${(severityCounts[level] / total) * 100}%` }} />
            ))}
          </div>
          <div className="metric-list">
            {(["critical", "serious", "moderate", "minor"] as const).map((level) => (
              <div className="metric-row" key={level}>
                <SeverityBadge level={level} />
                <Progress color={`var(--${level})`} value={(severityCounts[level] / total) * 100} />
                <strong className="tnum">{severityCounts[level]}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={t("overview.viewportSplit")}>
          <div className="metric-list">
            <div className="metric-row"><span className="inline-meta"><Icon name="monitor" size={14} />{t("viewport.desktop")}</span><Progress value={46} /><strong>46%</strong></div>
            <div className="metric-row"><span className="inline-meta"><Icon name="smartphone" size={14} />{t("viewport.mobile")}</span><Progress color="var(--serious)" value={54} /><strong>54%</strong></div>
          </div>
          <div className="note" style={{ marginTop: 14 }}><Icon name="smartphone" size={14} /> {t("overview.viewportHint")}</div>
        </Panel>
        <Panel title={t("overview.currentRun")}>
          {activeRun ? (
            <div className="metric-list">
              <div className="kv"><span>{t("table.status")}</span><RunStatusBadge status={activeRun.status} /></div>
              <div className="kv"><span>{t("table.pages")}</span><strong>{activeRun.pagesScanned}/{activeRun.pagesQueued}</strong></div>
              <Progress tall value={(activeRun.pagesScanned / Math.max(activeRun.pagesQueued, 1)) * 100} />
            </div>
          ) : (
            <div className="note"><Icon name="check-circle" size={14} /> {t("overview.noRunning")}</div>
          )}
        </Panel>
      </div>

      <div className="split-grid two">
        <Panel title={t("overview.topRecurring")}>
          <div className="stack-list">
            {topIssues.map((issue) => (
              <button className="list-row" key={issue.id} onClick={() => navigate({ page: "finding-detail", findingId: issue.id })} type="button">
                <SeverityBadge level={issue.severity} />
                <span className="truncate">{issue.title}</span>
                <span className="wcag">{issue.wcagCriteria}</span>
                <strong className="tnum">{issue.occurrences}</strong>
              </button>
            ))}
          </div>
        </Panel>
        <Panel action={<Button iconRight="arrow-right" onClick={() => navigate({ page: "scan-runs" })} size="sm" variant="ghost">{t("overview.allRuns")}</Button>} title={t("overview.recentRuns")}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("table.run")}</th><th>{t("table.status")}</th><th>{t("table.started")}</th><th className="num">{t("table.occurrences")}</th></tr></thead>
              <tbody>
                {projectScans.slice(0, 4).map((scan) => (
                  <tr key={scan.id}>
                    <td className="mono">{scan.id}</td>
                    <td><RunStatusBadge status={scan.status} /></td>
                    <td>{formatDate(scan.createdAt, locale, t("common.notAvailable"))}</td>
                    <td className="num tnum">{scan.findingsTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
