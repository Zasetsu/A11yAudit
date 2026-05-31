import { formatDate, severityMeta, type Severity } from "../data";
import { Button, Icon, PageHeader, Panel, Progress, RunStatusBadge, ScoreRing, SeverityBadge } from "../design/ui";
import type { PageProps } from "./page-props";

function countBySeverity(findings: PageProps["findings"]): Record<Severity, number> {
  return findings.reduce<Record<Severity, number>>(
    (counts, finding) => {
      counts[finding.severity] += finding.instances;
      return counts;
    },
    { critical: 0, serious: 0, moderate: 0, minor: 0 }
  );
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

export function OverviewPage({ project, scans, findings, navigate }: PageProps) {
  const projectScans = scans.filter((scan) => scan.projectId === project.id);
  const projectFindings = findings.filter((finding) => finding.projectId === project.id && finding.status !== "resolved");
  const severityCounts = countBySeverity(projectFindings);
  const total = Object.values(severityCounts).reduce((sum, value) => sum + value, 0) || 1;
  const activeRun = projectScans.find(
    (scan) => scan.status === "auditing" || scan.status === "crawling" || scan.status === "queued" || scan.status === "reporting"
  );
  const topIssues = [...projectFindings]
    .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || b.instances - a.instances)
    .slice(0, 5);

  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={
          <>
            <Button icon="download" onClick={() => navigate({ page: "reports" })}>Latest PDF</Button>
            <Button icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">Start Scan</Button>
          </>
        }
        breadcrumb={<><Icon name="globe" size={13} /><span className="mono">{project.domain}</span></>}
        subtitle={activeRun ? `Manual scan in progress: ${activeRun.id}` : `Last scan ${formatDate(project.lastScan)}`}
        title={project.name}
      />

      <div className="split-grid score" style={{ marginBottom: 16 }}>
        <Panel>
          <div className="score-panel">
            <ScoreRing score={project.score} size={96} />
            <div>
              <div className="stat-label">Accessibility score</div>
              <p className="panel-copy">Weighted score across audited public URLs, desktop checks, and mobile checks.</p>
              <div className="note" style={{ marginTop: 10 }}><Icon name="info" size={14} /> Automated checks do not certify legal compliance.</div>
            </div>
          </div>
        </Panel>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Stat icon="list" label="Open findings" sub="current project" value={projectFindings.length} />
          <Stat icon="file-text" label="Pages scanned" sub="latest scan" value={activeRun?.pagesScanned ?? projectScans[0]?.pagesScanned ?? 0} />
          <Stat icon="circle-dot" label="New" sub="needs triage" value={projectFindings.filter((finding) => finding.status === "new").length} />
          <Stat icon="check-circle" label="Resolved" sub="current project" value={findings.filter((finding) => finding.projectId === project.id && finding.status === "resolved").length} />
        </div>
      </div>

      <div className="split-grid three" style={{ marginBottom: 16 }}>
        <Panel action={<Button iconRight="arrow-right" onClick={() => navigate({ page: "findings" })} size="sm" variant="ghost">Triage</Button>} title="Findings by severity">
          <div className="severity-meter" aria-label="Severity distribution">
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
        <Panel title="Viewport split">
          <div className="metric-list">
            <div className="metric-row"><span className="inline-meta"><Icon name="monitor" size={14} />Desktop</span><Progress value={46} /><strong>46%</strong></div>
            <div className="metric-row"><span className="inline-meta"><Icon name="smartphone" size={14} />Mobile</span><Progress color="var(--serious)" value={54} /><strong>54%</strong></div>
          </div>
          <div className="note" style={{ marginTop: 14 }}><Icon name="smartphone" size={14} /> Mobile checks expose more target size and reflow issues.</div>
        </Panel>
        <Panel title="Current run">
          {activeRun ? (
            <div className="metric-list">
              <div className="kv"><span>Status</span><RunStatusBadge status={activeRun.status} /></div>
              <div className="kv"><span>Pages</span><strong>{activeRun.pagesScanned}/{activeRun.pagesQueued}</strong></div>
              <Progress tall value={(activeRun.pagesScanned / Math.max(activeRun.pagesQueued, 1)) * 100} />
            </div>
          ) : (
            <div className="note"><Icon name="check-circle" size={14} /> No scan is currently running for this project.</div>
          )}
        </Panel>
      </div>

      <div className="split-grid two">
        <Panel title="Top recurring issues">
          <div className="stack-list">
            {topIssues.map((finding) => (
              <button className="list-row" key={finding.id} onClick={() => navigate({ page: "finding-detail", findingId: finding.id })} type="button">
                <SeverityBadge level={finding.severity} />
                <span className="truncate">{finding.title}</span>
                <span className="wcag">{finding.wcagCriteria}</span>
                <strong className="tnum">{finding.instances}</strong>
              </button>
            ))}
          </div>
        </Panel>
        <Panel action={<Button iconRight="arrow-right" onClick={() => navigate({ page: "scan-runs" })} size="sm" variant="ghost">All runs</Button>} title="Recent scan runs">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Run</th><th>Status</th><th>Started</th><th className="num">Findings</th></tr></thead>
              <tbody>
                {projectScans.slice(0, 4).map((scan) => (
                  <tr key={scan.id}>
                    <td className="mono">{scan.id}</td>
                    <td><RunStatusBadge status={scan.status} /></td>
                    <td>{formatDate(scan.createdAt)}</td>
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
