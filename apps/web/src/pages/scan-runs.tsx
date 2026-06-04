import { formatDate } from "../data";
import { Button, PageHeader, Panel, Progress, RunStatusBadge } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { Messages } from "../i18n/messages.js";
import type { PageProps } from "./page-props";
import type { ScanRun } from "../data";

type TFn = <K extends keyof Messages>(key: K) => Messages[K];

export function scanProgressValue(scan: ScanRun): number {
  return (scan.pagesScanned / Math.max(scan.pagesQueued, 1)) * 100;
}

export function scanProgressTone(scan: ScanRun): string {
  return scan.status === "failed" ? "var(--critical)" : "var(--accent)";
}

export function scanProgressLabel(scan: ScanRun, t: TFn): string {
  const pages = `${scan.pagesScanned}/${scan.pagesQueued} ${t("runs.pagesWord")}`;
  return scan.status === "failed" ? `${t("runs.failedAfter")} ${pages}` : pages;
}

export function scanRunMessage(scan: ScanRun): string | null {
  return scan.errorMessage;
}

export function scanRunMessageClass(scan: ScanRun): string {
  return scan.status === "failed" ? "error-text" : "warning-text";
}

export function ScanRunsPage({ scans, navigate }: PageProps) {
  const { t, locale } = useT();
  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">{t("common.newScan")}</Button>}
        icon="activity"
        subtitle={t("runs.subtitle")}
        title={t("nav.scanRuns")}
      />
      <Panel title={t("runs.runs")}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("table.run")}</th>
                <th>{t("table.project")}</th>
                <th>{t("table.status")}</th>
                <th>{t("table.profile")}</th>
                <th>{t("table.target")}</th>
                <th>{t("table.progress")}</th>
                <th className="num">{t("table.occurrences")}</th>
                <th>{t("table.started")}</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="mono">
                    <button className="link-button" onClick={() => navigate({ page: "scan-run-detail", scanRunId: scan.id })} title={t("run.viewDetail")(scan.id)} type="button">{scan.id}</button>
                  </td>
                  <td>{scan.projectName}</td>
	                  <td>
	                    <RunStatusBadge status={scan.status} />
	                    {scanRunMessage(scan) !== null ? (
	                      <div className={`table-sub ${scanRunMessageClass(scan)}`}>{scanRunMessage(scan)}</div>
	                    ) : null}
	                  </td>
                  <td>
                    <strong>{scan.mode === "same_domain_crawl" ? t("runs.fullSite") : t("runs.singleUrl")}</strong>
                    <div className="table-sub">{t("runs.profileMeta")(scan.viewports, scan.maxPages, scan.maxDepth)}</div>
                  </td>
                  <td className="url-cell">{scan.url}</td>
                  <td style={{ minWidth: 150 }}>
                    <Progress color={scanProgressTone(scan)} value={scanProgressValue(scan)} />
                    <div className={`table-sub ${scan.status === "failed" ? "error-text" : ""}`}>{scanProgressLabel(scan, t)}</div>
                  </td>
                  <td className="num tnum">{scan.findingsTotal}</td>
                  <td>{formatDate(scan.createdAt, locale, t("common.notAvailable"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
