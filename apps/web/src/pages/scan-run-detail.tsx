import { getReportDownloadUrl } from "../api/client";
import { formatDate, severityMeta } from "../data";
import { Button, Icon, PageHeader, Panel, Progress, RunStatusBadge, SeverityBadge, StatusBadge } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { PageProps } from "./page-props";

export function ScanRunDetailPage({ workspaceSlug, scans, issues, reports, scanRunId, navigate }: PageProps & { scanRunId: string }) {
  const { t, locale } = useT();
  const scan = scans.find((candidate) => candidate.id === scanRunId);

  if (scan === undefined) {
    return (
      <div className="content-inner fadein">
        <PageHeader title={t("run.notFound")} />
        <Panel><Button icon="arrow-right" onClick={() => navigate({ page: "scan-runs" })}>{t("run.back")}</Button></Panel>
      </div>
    );
  }

  const scanIssues = [...issues.filter((issue) => issue.scanRunId === scan.id)].sort(
    (a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || b.occurrences - a.occurrences
  );
  const counts = { new: 0, ongoing: 0, resolved: 0 };
  for (const i of scanIssues) {
    if (i.status === "new") counts.new += 1;
    else if (i.status === "ongoing") counts.ongoing += 1;
    else if (i.status === "resolved") counts.resolved += 1;
  }
  const openIssues = scanIssues.filter((i) => i.status !== "resolved");
  const resolvedIssues = scanIssues.filter((i) => i.status === "resolved");
  const scanReports = reports.filter((report) => report.scanRunId === scan.id);
  const progress = (scan.pagesScanned / Math.max(scan.pagesQueued, 1)) * 100;

  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="arrow-right" onClick={() => navigate({ page: "scan-runs" })}>{t("run.back")}</Button>}
        breadcrumb={<><Icon name="activity" size={13} /> <span className="mono">{scan.id}</span></>}
        subtitle={scan.url}
        title={scan.projectName}
      />
      <div className="split-grid score">
        <Panel title={t("run.summary")}>
          <div className="detail-stack">
            <div className="detail-title-row">
              <RunStatusBadge status={scan.status} />
              <strong>{scan.mode === "same_domain_crawl" ? t("runs.fullSite") : t("runs.singleUrl")}</strong>
            </div>
            <div className="kv"><span>{t("run.mode")}</span><strong>{t("runs.profileMeta")(scan.viewports, scan.maxPages, scan.maxDepth)}</strong></div>
            <div className="kv"><span>{t("table.target")}</span><strong className="mono break-text">{scan.url}</strong></div>
            <div className="kv"><span>{t("table.progress")}</span><strong className="tnum">{scan.pagesScanned}/{scan.pagesQueued} {t("runs.pagesWord")}</strong></div>
            <Progress color={scan.status === "failed" ? "var(--critical)" : "var(--accent)"} value={progress} />
            <div className="kv"><span>{t("table.occurrences")}</span><strong className="tnum">{scan.findingsTotal}</strong></div>
            <div className="kv"><span>{t("run.sinceLastScan")}</span><strong>{counts.new} {t("run.statusNew")} · {counts.ongoing} {t("run.statusOngoing")} · {counts.resolved} {t("run.statusResolved")}</strong></div>
            {scan.score !== null ? <div className="kv"><span>{t("run.score")}</span><strong className="tnum">{scan.score}</strong></div> : null}
            <div className="kv"><span>{t("table.started")}</span><strong>{formatDate(scan.createdAt, locale, t("common.notAvailable"))}</strong></div>
            {scan.errorMessage !== null ? (
              <div className="kv"><span>{t("run.error")}</span><strong className="error-text break-text">{scan.errorMessage}</strong></div>
            ) : null}
          </div>
        </Panel>

        <Panel title={t("run.relatedIssues")}>
          {openIssues.length === 0 ? (
            <div className="note"><Icon name="info" size={14} /> {t("run.noIssues")}</div>
          ) : (
            <div className="stack-list">
              {openIssues.map((issue) => (
                <button className="list-row" key={issue.id} onClick={() => navigate({ page: "finding-detail", findingId: issue.id })} type="button">
                  <SeverityBadge level={issue.severity} />
                  <StatusBadge status={issue.status} />
                  <span className="truncate">{issue.title}</span>
                  <span className="wcag">{issue.wcagCriteria}</span>
                  <strong className="tnum">{issue.occurrences}</strong>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {resolvedIssues.length > 0 ? (
          <Panel title={t("run.resolvedGroup")}>
            <div className="stack-list static">
              {resolvedIssues.map((issue) => (
                <div className="list-row" key={issue.id}>
                  <StatusBadge status={issue.status} />
                  <span className="truncate">{issue.title}</span>
                  <span className="wcag">{issue.wcagCriteria}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title={t("run.relatedReports")}>
          {scanReports.length === 0 ? (
            <div className="note"><Icon name="info" size={14} /> {t("run.noReports")}</div>
          ) : (
            <div className="stack-list static">
              {scanReports.map((report) => {
                const downloadUrl = report.status === "ready" ? getReportDownloadUrl(workspaceSlug, report.id) : null;
                return (
                  <div className="list-row" key={report.id}>
                    <Icon name="file-text" size={15} />
                    <span className="truncate">{t("reports.reportName")(report.kind)}</span>
                    {downloadUrl !== null ? (
                      <a className="btn default sm" download href={downloadUrl}>
                        <Icon name="download" size={13} />
                        {t("common.download")}
                      </a>
                    ) : (
                      <span className="badge run queued"><Icon name="loader" size={11} className="spin" />{t("reports.generating")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
