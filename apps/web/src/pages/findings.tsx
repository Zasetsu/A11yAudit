import { useMemo, useState } from "react";
import { severityMeta, type Severity } from "../data";
import { Button, PageHeader, Panel, SeverityBadge, StatusBadge, ViewportBadge } from "../design/ui";
import type { PageProps } from "./page-props";

const severityOptions: Array<Severity | "all"> = ["all", "critical", "serious", "moderate", "minor"];

export function FindingsPage({ findings, project, navigate }: PageProps) {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<"open" | "new" | "all">("open");
  const projectFindings = useMemo(() => {
    return findings
      .filter((finding) => finding.projectId === project.id)
      .filter((finding) => severity === "all" || finding.severity === severity)
      .filter((finding) => status === "all" || (status === "open" ? finding.status !== "resolved" : finding.status === "new"))
      .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || b.instances - a.instances);
  }, [findings, project.id, severity, status]);

  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="list"
        subtitle="Grouped technical findings with WCAG references and evidence pointers."
        title="Findings"
      />
      <Panel
        action={<Button disabled icon="check-circle" size="sm" title="Mark Resolved is outside the MVP">Mark Resolved</Button>}
        title="Finding groups"
        subtitle="CSV export is not included in this MVP."
      >
        <div className="filter-bar">
          <select className="input" onChange={(event) => setSeverity(event.target.value as Severity | "all")} value={severity}>
            {severityOptions.map((value) => <option key={value} value={value}>{value === "all" ? "All severities" : severityMeta[value].label}</option>)}
          </select>
          <select className="input" onChange={(event) => setStatus(event.target.value as "open" | "new" | "all")} value={status}>
            <option value="open">Open findings</option>
            <option value="new">New only</option>
            <option value="all">All statuses</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Severity</th>
                <th>Status</th>
                <th>WCAG</th>
                <th>Viewport</th>
                <th className="num">Instances</th>
              </tr>
            </thead>
            <tbody>
              {projectFindings.map((finding) => (
                <tr key={finding.id}>
                  <td>
                    <button className="table-link" onClick={() => navigate({ page: "finding-detail", findingId: finding.id })} type="button">
                      <strong>{finding.title}</strong>
                      <span className="table-sub mono">{finding.ruleId}</span>
                    </button>
                  </td>
                  <td><SeverityBadge level={finding.severity} /></td>
                  <td><StatusBadge status={finding.status} /></td>
                  <td><span className="wcag">{finding.wcagCriteria}</span></td>
                  <td><ViewportBadge viewport={finding.viewport} /></td>
                  <td className="num tnum">{finding.instances}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
