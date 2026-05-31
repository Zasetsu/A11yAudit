export type ViewportName = "desktop" | "mobile";
export type FindingViewport = ViewportName | "both";
export type Severity = "critical" | "serious" | "moderate" | "minor";
export type FindingStatus = "new" | "ongoing" | "resolved" | "changed";
export type FindingSource = "axe" | "custom" | "crawler";
export type FindingCertainty = "automatic_violation" | "needs_manual_verification" | "not_automatically_testable";
export type FindingOrigin = "component" | "template" | "content" | "third_party" | "unknown";

export interface Viewport {
  name: ViewportName;
  width: number;
  height: number;
}

export interface FindingFingerprintInput {
  normalizedUrl: string;
  viewport: ViewportName;
  ruleId: string;
  wcagCriteria: string[];
  elementSignature: string;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  source: FindingSource;
  certainty: FindingCertainty;
  origin: FindingOrigin;
  wcagCriteria: string[];
  ruleId: string;
  description: string;
  recommendation: string;
}

export interface FindingInstance {
  id: string;
  findingId: string;
  url: string;
  normalizedUrl: string;
  viewport: ViewportName;
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  elementSignature: string;
  fingerprint: string;
}

export type ScanMode = "single_url" | "url_list" | "same_domain_crawl";
export type ScanRunStatus = "queued" | "crawling" | "auditing" | "reporting" | "completed" | "failed";

export interface ScanRequest {
  runId: string;
  projectId: string | null;
  targetUrl: string;
  mode: ScanMode;
  urls?: string[];
  viewports: Viewport[];
  maxPages: number;
  maxDepth: number;
  respectRobotsTxt: boolean;
}

export interface AuditedPage {
  url: string;
  normalizedUrl: string;
  title: string | null;
  viewport: ViewportName;
  statusCode: number | null;
  finalUrl: string;
  durationMs: number;
  errorMessage: string | null;
}

export interface EvidenceArtifact {
  kind: "page_screenshot" | "element_screenshot" | "html_snippet";
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ScanFinding extends Finding {
  pageUrl: string;
  viewport: ViewportName;
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  helpUrl: string | null;
  fingerprint: string;
  evidence: EvidenceArtifact[];
  instances: number;
}

export interface ScanReportArtifact {
  kind: "html" | "pdf";
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CompletedScanResult {
  runId: string;
  projectId: string | null;
  targetUrl: string;
  mode: ScanMode;
  pages: AuditedPage[];
  findings: ScanFinding[];
  reports: ScanReportArtifact[];
  score: number;
  startedAt: string;
  finishedAt: string;
}

export function createFindingFingerprint(input: FindingFingerprintInput): string {
  return [
    input.normalizedUrl,
    input.viewport,
    input.ruleId,
    [...input.wcagCriteria].sort().join(","),
    input.elementSignature
  ].join("|");
}
