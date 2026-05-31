import { getArtifactDownloadUrl } from "../api/client";
import { formatBytes } from "../data";
import { Button, Icon, PageHeader, Panel, SeverityBadge, StatusBadge, ViewportBadge } from "../design/ui";
import type { PageProps } from "./page-props";

function evidenceLabel(kind: string): string {
  if (kind === "page_screenshot") return "Page screenshot";
  if (kind === "html_snippet") return "HTML snippet";
  return kind.replaceAll("_", " ");
}

export function FindingDetailPage({ findings, findingId, navigate }: PageProps & { findingId: string }) {
  const finding = findings.find((candidate) => candidate.id === findingId) ?? findings[0];

  if (finding === undefined) {
    return (
      <div className="content-inner fadein">
        <PageHeader title="Finding not found" />
        <Panel><Button onClick={() => navigate({ page: "findings" })}>Back to Findings</Button></Panel>
      </div>
    );
  }

  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="arrow-right" onClick={() => navigate({ page: "findings" })}>Back to Findings</Button>}
        breadcrumb={<><Icon name="list" size={13} /> <span>{finding.id}</span></>}
        subtitle={finding.description}
        title={finding.title}
      />
      <div className="split-grid score">
        <Panel title="Finding evidence">
          <div className="detail-stack">
            <div className="detail-title-row">
              <SeverityBadge level={finding.severity} />
              <StatusBadge status={finding.status} />
              <ViewportBadge viewport={finding.viewport} />
              <span className="wcag">{finding.wcagCriteria}</span>
            </div>
            <div className="kv"><span>Rule ID</span><strong className="mono">{finding.ruleId}</strong></div>
            <div className="kv"><span>Page URL</span><strong className="mono break-text">{finding.pageUrl}</strong></div>
            <div className="kv"><span>Selector</span><strong className="mono break-text">{finding.selector ?? "Not captured"}</strong></div>
            <div className="kv"><span>Instances</span><strong className="tnum">{finding.instances}</strong></div>
            {finding.helpUrl ? <a className="external-link" href={finding.helpUrl} rel="noreferrer" target="_blank">Rule documentation</a> : null}
          </div>
        </Panel>
        <Panel title="Captured artifacts" subtitle="Screenshots and snippets are stored per finding.">
          {finding.evidenceArtifacts.length === 0 ? (
            <div className="note"><Icon name="info" size={14} /> No screenshot or snippet artifact was captured for this finding.</div>
          ) : (
            <div className="evidence-grid">
              {finding.evidenceArtifacts.map((artifact) => {
                const downloadUrl = getArtifactDownloadUrl(artifact.artifactKey);
                const isImage = artifact.mimeType.startsWith("image/");
                return (
                  <div className="evidence-card" key={artifact.artifactKey}>
                    {isImage && downloadUrl !== null ? (
                      <a href={downloadUrl} rel="noreferrer" target="_blank" title="Open screenshot">
                        <img alt={`${finding.title} screenshot evidence`} className="evidence-thumb" src={downloadUrl} />
                      </a>
                    ) : (
                      <div className="evidence-file"><Icon name="file-text" size={18} /></div>
                    )}
                    <div>
                      <strong>{evidenceLabel(artifact.kind)}</strong>
                      <div className="table-sub mono break-text">{artifact.artifactKey}</div>
                      <div className="table-sub">{artifact.mimeType} · {formatBytes(artifact.sizeBytes)}</div>
                    </div>
                    {downloadUrl !== null ? (
                      <a className="btn default sm" download href={downloadUrl}>
                        <Icon name="download" size={13} />
                        Download
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Recommended workflow">
          <div className="stack-list static">
            <div className="list-row"><Icon name="eye" size={15} /> Verify the affected component in keyboard and screen reader flows.</div>
            <div className="list-row"><Icon name="check-circle" size={15} /> Fix the source pattern, not individual generated pages.</div>
            <div className="list-row"><Icon name="scan-search" size={15} /> Re-run a public URL scan after deploying the fix.</div>
          </div>
          <div className="note" style={{ marginTop: 14 }}><Icon name="info" size={14} /> Marking findings as resolved is intentionally disabled until backend state support exists.</div>
        </Panel>
      </div>
    </div>
  );
}
