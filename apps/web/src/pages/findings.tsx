import { useMemo, useState } from "react";
import { severityMeta, type Issue, type Severity } from "../data";
import { Button, PageHeader, Panel, SeverityBadge } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { Messages } from "../i18n/messages.js";
import { areaLabel, cmsLabel, scopeLabel } from "../i18n/inference-labels.js";
import type { PageProps } from "./page-props";

type TFn = <K extends keyof Messages>(key: K) => Messages[K];

const severityOptions: Array<Severity | "all"> = ["all", "critical", "serious", "moderate", "minor"];

export function sortIssuesForTriage(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) =>
      severityMeta[a.severity].rank - severityMeta[b.severity].rank ||
      b.affectedPages - a.affectedPages ||
      b.occurrences - a.occurrences
  );
}

function confidenceLabel(confidence: Issue["confidence"], t: TFn): string {
  const key = confidence === "high" ? "finding.confidenceHigh" : confidence === "medium" ? "finding.confidenceMedium" : "finding.confidenceLow";
  return t(key);
}

export function FindingsPage({ issues, project, navigate }: PageProps) {
  const { t, locale } = useT();
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const projectIssues = useMemo(() => {
    return sortIssuesForTriage(
      issues
        .filter((issue) => issue.projectId === project.id)
        .filter((issue) => severity === "all" || issue.severity === severity)
    );
  }, [issues, project.id, severity]);

  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="list"
        subtitle={t("findings.subtitle")}
        title={t("nav.findings")}
      />
      <Panel
        action={<Button disabled icon="check-circle" size="sm" title={t("findings.markResolvedDisabled")}>{t("findings.markResolved")}</Button>}
        title={t("findings.issueGroups")}
        subtitle={t("findings.csvDisabled")}
      >
        <div className="filter-bar">
          <select className="input" onChange={(event) => setSeverity(event.target.value as Severity | "all")} value={severity}>
            {severityOptions.map((value) => <option key={value} value={value}>{value === "all" ? t("findings.allSeverities") : (t(severityMeta[value].labelKey) as string)}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("table.severity")}</th>
                <th>{t("table.issue")}</th>
                <th>{t("table.wcag")}</th>
                <th>{t("table.likelyScope")}</th>
                <th>{t("table.component")}</th>
                <th>{t("table.cmsHint")}</th>
                <th className="num">{t("table.pages")}</th>
                <th className="num">{t("table.occurrences")}</th>
              </tr>
            </thead>
            <tbody>
              {projectIssues.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="note">{t("findings.empty")}</div>
                  </td>
                </tr>
              ) : null}
              {projectIssues.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => navigate({ page: "finding-detail", findingId: issue.id })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate({ page: "finding-detail", findingId: issue.id });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td><SeverityBadge level={issue.severity} /></td>
                  <td>
                    <strong>{issue.title}</strong>
                    <div className="table-sub mono">{issue.ruleId}</div>
                    <div className="table-sub">{issue.viewportSummary}</div>
                  </td>
                  <td><span className="wcag">{issue.wcagCriteria}</span></td>
                  <td>
                    {scopeLabel(issue.likelyScope, locale)}
                    <div className="table-sub">{confidenceLabel(issue.confidence, t)}</div>
                  </td>
                  <td>{areaLabel(issue.componentArea, locale)}</td>
                  <td>{cmsLabel(issue.cmsHint, locale)}</td>
                  <td className="num tnum">{issue.affectedPages}</td>
                  <td className="num tnum">{issue.occurrences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
