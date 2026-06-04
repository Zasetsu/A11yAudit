import { getArtifactDownloadUrl } from "../api/client";
import { formatBytes, type Issue } from "../data";
import { Button, Icon, PageHeader, Panel, SeverityBadge, StatusBadge, ViewportBadge } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { Messages } from "../i18n/messages.js";
import { areaLabel, cmsLabel, scopeLabel } from "../i18n/inference-labels.js";
import type { PageProps } from "./page-props";

type Translate = <K extends keyof Messages>(key: K) => Messages[K];

function evidenceLabel(kind: string, t: Translate): string {
  if (kind === "page_screenshot") return t("finding.evidencePageScreenshot");
  if (kind === "html_snippet") return t("finding.evidenceHtmlSnippet");
  return kind.replaceAll("_", " ");
}

function confidenceLabel(confidence: Issue["confidence"], t: Translate): string {
  if (confidence === "high") return t("finding.confidenceHigh");
  if (confidence === "medium") return t("finding.confidenceMedium");
  return t("finding.confidenceLow");
}

export function FindingDetailPage({ workspaceSlug, findings, issues, findingId, navigate }: PageProps & { findingId: string }) {
  const { t, locale } = useT();
  const issue = issues.find((candidate) => candidate.id === findingId);
  const finding = findings.find((candidate) => candidate.id === findingId) ?? findings[0];

  if (issue !== undefined) {
    return (
      <div className="content-inner fadein">
        <PageHeader
          actions={<Button icon="arrow-right" onClick={() => navigate({ page: "findings" })}>{t("finding.back")}</Button>}
          breadcrumb={<><Icon name="list" size={13} /> <span>{issue.id}</span></>}
          subtitle={issue.description}
          title={issue.title}
        />
        <div className="split-grid score">
          <Panel title={t("finding.summary")}>
            <div className="detail-stack">
              <div className="detail-title-row">
                <SeverityBadge level={issue.severity} />
                <span className="wcag">{issue.wcagCriteria}</span>
                <span className="inline-meta">{issue.viewportSummary}</span>
              </div>
              <div className="kv"><span>{t("finding.ruleId")}</span><strong className="mono">{issue.ruleId}</strong></div>
              <div className="kv"><span>{t("finding.affectedPages")}</span><strong className="tnum">{issue.affectedPages}</strong></div>
              <div className="kv"><span>{t("finding.occurrences")}</span><strong className="tnum">{issue.occurrences}</strong></div>
              <div className="kv"><span>{t("finding.likelyScope")}</span><strong>{scopeLabel(issue.likelyScope, locale)}</strong></div>
              <div className="kv"><span>{t("finding.componentArea")}</span><strong>{areaLabel(issue.componentArea, locale)}</strong></div>
              <div className="kv"><span>{t("finding.cmsHint")}</span><strong>{cmsLabel(issue.cmsHint)}</strong></div>
              <div className="kv"><span>{t("finding.confidence")}</span><strong>{confidenceLabel(issue.confidence, t)}</strong></div>
              <div className="kv"><span>{t("finding.representativeUrl")}</span><strong className="mono break-text">{issue.representativeUrl}</strong></div>
              <div className="kv"><span>{t("finding.representativeSelector")}</span><strong className="mono break-text">{issue.representativeSelector ?? t("common.notCaptured")}</strong></div>
            </div>
          </Panel>
          <Panel title={t("finding.sampleUrls")} subtitle={t("finding.sampleUrlsHint")}>
            {issue.sampleUrls.length === 0 ? (
              <div className="note"><Icon name="info" size={14} /> {t("finding.sampleUrlsEmpty")}</div>
            ) : (
              <div className="stack-list static">
                {issue.sampleUrls.map((url) => (
                  <div className="list-row" key={url}>
                    <Icon name="file-text" size={15} />
                    <span className="mono break-text">{url}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title={t("finding.recommendation")}>
            <div className="detail-stack">
              <p className="panel-copy">{issue.recommendation}</p>
              {issue.representativeHtmlSnippet ? (
                <div className="kv"><span>{t("finding.htmlSnippet")}</span><strong className="mono break-text">{issue.representativeHtmlSnippet}</strong></div>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (finding === undefined) {
    return (
      <div className="content-inner fadein">
        <PageHeader title={t("finding.notFound")} />
        <Panel><Button onClick={() => navigate({ page: "findings" })}>{t("finding.back")}</Button></Panel>
      </div>
    );
  }

  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="arrow-right" onClick={() => navigate({ page: "findings" })}>{t("finding.back")}</Button>}
        breadcrumb={<><Icon name="list" size={13} /> <span>{finding.id}</span></>}
        subtitle={finding.description}
        title={finding.title}
      />
      <div className="split-grid score">
        <Panel title={t("finding.evidence")}>
          <div className="detail-stack">
            <div className="detail-title-row">
              <SeverityBadge level={finding.severity} />
              <StatusBadge status={finding.status} />
              <ViewportBadge viewport={finding.viewport} />
              <span className="wcag">{finding.wcagCriteria}</span>
            </div>
            <div className="kv"><span>{t("finding.ruleId")}</span><strong className="mono">{finding.ruleId}</strong></div>
            <div className="kv"><span>{t("finding.pageUrl")}</span><strong className="mono break-text">{finding.pageUrl}</strong></div>
            <div className="kv"><span>{t("finding.selector")}</span><strong className="mono break-text">{finding.selector ?? t("common.notCaptured")}</strong></div>
            <div className="kv"><span>{t("finding.instances")}</span><strong className="tnum">{finding.instances}</strong></div>
            {finding.helpUrl ? <a className="external-link" href={finding.helpUrl} rel="noreferrer" target="_blank">{t("finding.ruleDocs")}</a> : null}
          </div>
        </Panel>
        <Panel title={t("finding.capturedArtifacts")} subtitle={t("finding.capturedArtifactsHint")}>
          {finding.evidenceArtifacts.length === 0 ? (
            <div className="note"><Icon name="info" size={14} /> {t("finding.noArtifacts")}</div>
          ) : (
            <div className="evidence-grid">
              {finding.evidenceArtifacts.map((artifact) => {
                const downloadUrl = getArtifactDownloadUrl(workspaceSlug, artifact.artifactKey);
                const isImage = artifact.mimeType.startsWith("image/");
                return (
                  <div className="evidence-card" key={artifact.artifactKey}>
                    {isImage && downloadUrl !== null ? (
                      <a href={downloadUrl} rel="noreferrer" target="_blank" title={t("finding.openScreenshot")}>
                        <img alt={t("finding.screenshotAlt")(finding.title)} className="evidence-thumb" src={downloadUrl} />
                      </a>
                    ) : (
                      <div className="evidence-file"><Icon name="file-text" size={18} /></div>
                    )}
                    <div>
                      <strong>{evidenceLabel(artifact.kind, t)}</strong>
                      <div className="table-sub mono break-text">{artifact.artifactKey}</div>
                      <div className="table-sub">{artifact.mimeType} · {formatBytes(artifact.sizeBytes, t("common.pending"))}</div>
                    </div>
                    {downloadUrl !== null ? (
                      <a className="btn default sm" download href={downloadUrl}>
                        <Icon name="download" size={13} />
                        {t("common.download")}
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title={t("finding.workflow")}>
          <div className="stack-list static">
            <div className="list-row"><Icon name="eye" size={15} /> {t("finding.workflow1")}</div>
            <div className="list-row"><Icon name="check-circle" size={15} /> {t("finding.workflow2")}</div>
            <div className="list-row"><Icon name="scan-search" size={15} /> {t("finding.workflow3")}</div>
          </div>
          <div className="note" style={{ marginTop: 14 }}><Icon name="info" size={14} /> {t("finding.workflowNote")}</div>
        </Panel>
      </div>
    </div>
  );
}
