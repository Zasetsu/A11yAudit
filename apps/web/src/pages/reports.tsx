import { getReportDownloadUrl } from "../api/client";
import { formatBytes, formatDate } from "../data";
import { Button, Icon, PageHeader, Panel, RunStatusBadge } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { PageProps } from "./page-props";

export function reportActionLabel(report: PageProps["reports"][number]): string {
  const kind = report.kind.trim();
  return kind === "" ? "Report" : kind.toUpperCase();
}

export function reportDownloadUrl(report: PageProps["reports"][number], workspaceSlug: string): string | null {
  return report.status === "ready" ? getReportDownloadUrl(workspaceSlug, report.id) : null;
}

export function reportDownloadTitle(report: PageProps["reports"][number]): string {
  const actionLabel = reportActionLabel(report);
  return report.status === "ready" ? `Download ${actionLabel} report` : `${actionLabel} report is still generating`;
}

export function ReportsPage({ workspaceSlug, reports, scans, navigate }: PageProps) {
  const { t, locale } = useT();
  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">{t("common.runScan")}</Button>}
        icon="file-text"
        subtitle={t("reports.subtitle")}
        title={t("nav.reports")}
      />
      <Panel title={t("reports.artifacts")} subtitle={t("reports.csvNote")}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("table.report")}</th>
                <th>{t("table.project")}</th>
                <th>{t("table.scan")}</th>
                <th>{t("table.status")}</th>
                <th className="num">{t("table.size")}</th>
                <th>{t("table.created")}</th>
                <th className="num">{t("table.action")}</th>
              </tr>
            </thead>
            <tbody>
	              {reports.map((report) => {
	                const scan = scans.find((candidate) => candidate.id === report.scanRunId);
	                const actionLabel = reportActionLabel(report);
	                const downloadUrl = reportDownloadUrl(report, workspaceSlug);
	                return (
                  <tr key={report.id}>
                    <td>
                      <strong>{t("reports.reportName")(report.kind)}</strong>
                      <div className="table-sub mono">{report.artifactKey}</div>
                    </td>
                    <td>{report.projectName}</td>
                    <td className="mono">{report.scanRunId}</td>
                    <td>{report.status === "ready" && scan !== undefined ? <RunStatusBadge status="completed" /> : <span className="badge run queued"><Icon name="loader" size={11} className="spin" />{t("reports.generating")}</span>}</td>
                    <td className="num">{formatBytes(report.sizeBytes, t("common.pending"))}</td>
                    <td>{formatDate(report.createdAt, locale, t("common.notAvailable"))}</td>
	                    <td className="num">
	                      {downloadUrl === null ? (
	                        <Button disabled icon="download" size="sm" title={reportDownloadTitle(report)}>{actionLabel}</Button>
	                      ) : (
	                        <a className="btn default sm" download href={downloadUrl} title={reportDownloadTitle(report)}>
                          <Icon name="download" size={13} />
                          {actionLabel}
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
