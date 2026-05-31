import { formatDate } from "../data";
import { Button, PageHeader, Panel, Progress, RunStatusBadge } from "../design/ui";
import type { PageProps } from "./page-props";
import type { ScanRun } from "../data";

export function scanProgressValue(scan: ScanRun): number {
  return (scan.pagesScanned / Math.max(scan.pagesQueued, 1)) * 100;
}

export function scanProgressTone(scan: ScanRun): string {
  return scan.status === "failed" ? "var(--critical)" : "var(--accent)";
}

export function scanProgressLabel(scan: ScanRun): string {
  const pages = `${scan.pagesScanned}/${scan.pagesQueued} pages`;
  return scan.status === "failed" ? `Failed after ${pages}` : pages;
}

export function ScanRunsPage({ scans, navigate }: PageProps) {
  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">New Scan</Button>}
        icon="activity"
        subtitle="Manual public URL scan runs from the local instance."
        title="Scan Runs"
      />
      <Panel title="Runs">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Project</th>
                <th>Status</th>
                <th>Profile</th>
                <th>Target</th>
                <th>Progress</th>
                <th className="num">Findings</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="mono">{scan.id}</td>
                  <td>{scan.projectName}</td>
                  <td>
                    <RunStatusBadge status={scan.status} />
                    {scan.status === "failed" && scan.errorMessage !== null ? (
                      <div className="table-sub error-text">{scan.errorMessage}</div>
                    ) : null}
                  </td>
                  <td>
                    <strong>{scan.mode === "same_domain_crawl" ? "Full site" : "Single URL"}</strong>
                    <div className="table-sub">{scan.viewports} · {scan.maxPages} pages · depth {scan.maxDepth}</div>
                  </td>
                  <td className="url-cell">{scan.url}</td>
                  <td style={{ minWidth: 150 }}>
                    <Progress color={scanProgressTone(scan)} value={scanProgressValue(scan)} />
                    <div className={`table-sub ${scan.status === "failed" ? "error-text" : ""}`}>{scanProgressLabel(scan)}</div>
                  </td>
                  <td className="num tnum">{scan.findingsTotal}</td>
                  <td>{formatDate(scan.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
