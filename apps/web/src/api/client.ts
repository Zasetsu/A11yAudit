import {
  demoFindings,
  demoIssues,
  demoProjects,
  demoReports,
  demoScanRuns,
  type EvidenceArtifact,
  type Finding,
  type Issue,
  type Project,
  type Report,
  type ScanRun,
  type ScanStatus
} from "../data";

interface ApiList<T> {
  data: T[];
}

const apiBaseUrl = import.meta.env.VITE_A11YAUDIT_API_BASE_URL as string | undefined;
const configuredWorkspaceSlug = import.meta.env.VITE_A11YAUDIT_WORKSPACE_SLUG as string | undefined;
export const currentWorkspaceSlug = configuredWorkspaceSlug?.trim() || "default-workspace";

type ApiListResult<T> =
  | { status: "not_configured" }
  | { status: "unavailable" }
  | { status: "ok"; data: T[] };

type ServerProject = Partial<Project> & {
  id: string;
  name: string;
  url?: string;
  domain: string;
  createdAt?: string;
  openFindings?: number;
  lastScan?: string | null;
};

type ServerScanRun = Partial<ScanRun> & {
  id: string;
  projectId: string;
  url: string;
  status: string;
  mode: string;
  maxPages?: number;
  maxDepth?: number;
  viewports?: string;
  pagesQueued?: number;
  pagesScanned?: number;
  findingsTotal?: number;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
};

type ServerFinding = Partial<Finding> & {
  id: string;
  projectId: string;
  scanRunId: string;
  pageUrl: string;
  ruleId: string;
  title: string;
  severity: string;
  status: string;
  wcagCriteria: string;
  instances?: number;
  createdAt?: string;
  evidence?: string | EvidenceArtifact[];
};

type ServerReport = Partial<Report> & {
  id: string;
  projectId: string;
  scanRunId: string;
  kind: string;
  artifactKey: string;
  mimeType: string;
  sizeBytes?: number;
  createdAt?: string;
};

type ServerIssue = Partial<Omit<Issue, "severity" | "source" | "certainty" | "confidence" | "sampleUrls">> & {
  id: string;
  projectId: string;
  scanRunId: string;
  issueKey: string;
  title: string;
  severity: Issue["severity"];
  source: Issue["source"];
  certainty: Issue["certainty"];
  ruleId: string;
  wcagCriteria: string;
  description: string;
  recommendation: string;
  likelyScope: string;
  urlScopeGroup: string;
  componentArea: string;
  cmsHint: string;
  confidence: Issue["confidence"];
  affectedPages: number;
  occurrences: number;
  viewportSummary: string;
  representativeUrl: string;
  createdAt: string;
  sampleUrls?: unknown;
};

function apiUrl(path: string): string | null {
  if (apiBaseUrl === undefined || apiBaseUrl.trim() === "") {
    return null;
  }

  const normalizedBase = apiBaseUrl.trim().endsWith("/") ? apiBaseUrl.trim() : `${apiBaseUrl.trim()}/`;
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, normalizedBase).href;
}

function workspaceScansPath(workspaceSlug = currentWorkspaceSlug): string {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/scans`;
}

async function fetchList<T>(path: string): Promise<ApiListResult<T>> {
  const url = apiUrl(path);
  if (url === null) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return { status: "unavailable" };
    }

    const payload = (await response.json()) as ApiList<T>;
    return Array.isArray(payload.data) ? { status: "ok", data: payload.data } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

function projectName(projectId: string): string {
  return demoProjects.find((project) => project.id === projectId)?.name ?? "Project";
}

function scanStatus(status: string): ScanStatus {
  return status === "failed" ||
    status === "completed" ||
    status === "reporting" ||
    status === "auditing" ||
    status === "crawling"
    ? status
    : "queued";
}

function formatViewportNames(value: string | undefined): string {
  const names = (value ?? "desktop,mobile").split(",").map((item) => item.trim()).filter(Boolean);
  if (names.includes("desktop") && names.includes("mobile")) return "Desktop + mobile";
  if (names.includes("desktop")) return "Desktop";
  if (names.includes("mobile")) return "Mobile";
  return "Desktop + mobile";
}

function parseEvidenceArtifacts(evidence: string | EvidenceArtifact[] | undefined): EvidenceArtifact[] {
  const raw = typeof evidence === "string" ? safeJsonParse(evidence) : evidence;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item): EvidenceArtifact[] => {
    if (item === null || typeof item !== "object") return [];
    const artifact = item as Partial<EvidenceArtifact>;
    if (
      typeof artifact.kind !== "string" ||
      typeof artifact.artifactKey !== "string" ||
      typeof artifact.mimeType !== "string" ||
      typeof artifact.sizeBytes !== "number"
    ) {
      return [];
    }

    return [{
      kind: artifact.kind,
      artifactKey: artifact.artifactKey,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes
    }];
  });
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function issueSampleUrls(sampleUrls: unknown): string[] {
  return Array.isArray(sampleUrls) ? sampleUrls.filter((url): url is string => typeof url === "string") : [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isSeverity(value: unknown): value is Issue["severity"] {
  return value === "critical" || value === "serious" || value === "moderate" || value === "minor";
}

function isSource(value: unknown): value is Issue["source"] {
  return value === "axe" || value === "custom" || value === "crawler";
}

function isCertainty(value: unknown): value is Issue["certainty"] {
  return value === "automatic_violation" ||
    value === "needs_manual_verification" ||
    value === "not_automatically_testable";
}

function isConfidence(value: unknown): value is Issue["confidence"] {
  return value === "high" || value === "medium" || value === "low";
}

function isServerIssue(row: unknown): row is ServerIssue {
  if (row === null || typeof row !== "object") return false;
  const issue = row as Partial<ServerIssue>;

  return isNonEmptyString(issue.id) &&
    isNonEmptyString(issue.projectId) &&
    isNonEmptyString(issue.scanRunId) &&
    isNonEmptyString(issue.issueKey) &&
    isNonEmptyString(issue.title) &&
    isSeverity(issue.severity) &&
    isSource(issue.source) &&
    isCertainty(issue.certainty) &&
    isNonEmptyString(issue.ruleId) &&
    isNonEmptyString(issue.wcagCriteria) &&
    isNonEmptyString(issue.description) &&
    isNonEmptyString(issue.recommendation) &&
    isNonEmptyString(issue.likelyScope) &&
    isNonEmptyString(issue.urlScopeGroup) &&
    isNonEmptyString(issue.componentArea) &&
    isNonEmptyString(issue.cmsHint) &&
    isConfidence(issue.confidence) &&
    typeof issue.affectedPages === "number" &&
    typeof issue.occurrences === "number" &&
    isNonEmptyString(issue.viewportSummary) &&
    isNonEmptyString(issue.representativeUrl) &&
    isNonEmptyString(issue.createdAt);
}

function mapIssue(row: ServerIssue): Issue {
  return {
    id: row.id,
    projectId: row.projectId,
    scanRunId: row.scanRunId,
    issueKey: row.issueKey,
    title: row.title,
    severity: row.severity,
    source: row.source,
    certainty: row.certainty,
    ruleId: row.ruleId,
    wcagCriteria: row.wcagCriteria,
    description: row.description,
    recommendation: row.recommendation,
    likelyScope: row.likelyScope,
    urlScopeGroup: row.urlScopeGroup,
    componentArea: row.componentArea,
    cmsHint: row.cmsHint,
    confidence: row.confidence,
    affectedPages: row.affectedPages,
    occurrences: row.occurrences,
    viewportSummary: row.viewportSummary,
    representativeUrl: row.representativeUrl,
    representativeSelector: row.representativeSelector ?? null,
    representativeHtmlSnippet: row.representativeHtmlSnippet ?? null,
    sampleUrls: issueSampleUrls(row.sampleUrls),
    createdAt: row.createdAt
  };
}

export async function getProjects(): Promise<Project[]> {
  const result = await fetchList<ServerProject>("/api/projects");
  if (result.status === "not_configured") {
    return demoProjects;
  }
  if (result.status === "unavailable") return [];

  return result.data.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url ?? `https://${row.domain}`,
    domain: row.domain,
    score: row.score ?? 0,
    createdAt: row.createdAt ?? new Date().toISOString(),
    lastScan: row.lastScan ?? null,
    openFindings: row.openFindings ?? 0,
    reports: row.reports ?? 0,
    status: row.status ?? "active",
    crawlLimit: row.crawlLimit ?? 1,
    viewports: formatViewportNames(row.viewports)
  }));
}

export async function getScans(workspaceSlug = currentWorkspaceSlug): Promise<ScanRun[]> {
  const result = await fetchList<ServerScanRun>(workspaceScansPath(workspaceSlug));
  if (result.status === "not_configured") {
    return demoScanRuns;
  }
  if (result.status === "unavailable") return [];

  return result.data.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName ?? projectName(row.projectId),
    url: row.url,
    status: scanStatus(row.status),
    mode: row.mode,
    maxPages: row.maxPages ?? 10,
    maxDepth: row.maxDepth ?? 1,
    viewports: formatViewportNames(row.viewports),
    trigger: row.trigger ?? "Manual",
    pagesQueued: row.pagesQueued ?? 0,
    pagesScanned: row.pagesScanned ?? 0,
    findingsTotal: row.findingsTotal ?? 0,
    score: row.score ?? null,
    createdAt: row.createdAt ?? new Date().toISOString(),
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    errorMessage: row.errorMessage ?? null
  }));
}

export async function getFindings(): Promise<Finding[]> {
  const result = await fetchList<ServerFinding>("/api/findings");
  if (result.status === "not_configured") {
    return demoFindings;
  }
  if (result.status === "unavailable") return [];

  return result.data.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    scanRunId: row.scanRunId,
    pageUrl: row.pageUrl,
    ruleId: row.ruleId,
    title: row.title,
    severity: row.severity === "critical" || row.severity === "serious" || row.severity === "moderate" ? row.severity : "minor",
    status: row.status === "new" || row.status === "resolved" ? row.status : "ongoing",
    wcagCriteria: row.wcagCriteria,
    selector: row.selector ?? null,
    description: row.description ?? null,
    helpUrl: row.helpUrl ?? null,
    instances: row.instances ?? 1,
    createdAt: row.createdAt ?? new Date().toISOString(),
    viewport: row.viewport ?? "both",
    origin: row.origin ?? "component",
    testability: row.testability ?? "automatic",
    evidenceArtifacts: parseEvidenceArtifacts(row.evidence)
  }));
}

export async function fetchIssues(params: { projectId?: string; scanRunId?: string } = {}): Promise<Issue[]> {
  const search = new URLSearchParams();
  if (params.projectId !== undefined) search.set("projectId", params.projectId);
  if (params.scanRunId !== undefined) search.set("scanRunId", params.scanRunId);

  const query = search.toString();
  const result = await fetchList<ServerIssue>(`/api/issues${query === "" ? "" : `?${query}`}`);
  if (result.status === "not_configured") {
    return demoIssues;
  }
  if (result.status === "unavailable") return [];

  return result.data.filter(isServerIssue).map(mapIssue);
}

export async function getReports(): Promise<Report[]> {
  const result = await fetchList<ServerReport>("/api/reports");
  if (result.status === "not_configured") {
    return demoReports;
  }
  if (result.status === "unavailable") return [];

  return result.data.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    scanRunId: row.scanRunId,
    kind: row.kind,
    artifactKey: row.artifactKey,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes ?? 0,
    createdAt: row.createdAt ?? new Date().toISOString(),
    projectName: row.projectName ?? projectName(row.projectId),
    status: row.status ?? "ready"
  }));
}

export function getReportDownloadUrl(reportId: string): string | null {
  return apiUrl(`/api/reports/${reportId}/download`);
}

export function getArtifactDownloadUrl(artifactKey: string): string | null {
  const encoded = encodeURIComponent(artifactKey);
  return apiUrl(`/api/artifacts/download?key=${encoded}`);
}

export async function createProject(payload: { name?: string; url: string }): Promise<Project | null> {
  const url = apiUrl("/api/projects");
  if (url === null) {
    return null;
  }

  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      return null;
    }

    const row = (await response.json()) as ServerProject;
    return {
      id: row.id,
      name: row.name,
      url: row.url ?? `https://${row.domain}`,
      domain: row.domain,
      score: row.score ?? 0,
      createdAt: row.createdAt ?? new Date().toISOString(),
      lastScan: row.lastScan ?? null,
      openFindings: row.openFindings ?? 0,
      reports: row.reports ?? 0,
      status: row.status ?? "active",
      crawlLimit: row.crawlLimit ?? 1,
      viewports: formatViewportNames(row.viewports)
    };
  } catch {
    return null;
  }
}

export async function createScan(payload: {
  projectId: string;
  url: string;
  mode: "single_url" | "same_domain_crawl";
  maxPages: number;
  maxDepth: number;
  viewports: Array<"desktop" | "mobile">;
}, workspaceSlug = currentWorkspaceSlug): Promise<ScanRun | null> {
  const url = apiUrl(workspaceScansPath(workspaceSlug));
  if (url === null) {
    return null;
  }

  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      return null;
    }

    const row = (await response.json()) as ServerScanRun;
    return {
      id: row.id,
      projectId: row.projectId,
      projectName: projectName(row.projectId),
      url: row.url,
      status: scanStatus(row.status),
      mode: row.mode,
      maxPages: row.maxPages ?? payload.maxPages,
      maxDepth: row.maxDepth ?? payload.maxDepth,
      viewports: formatViewportNames(row.viewports ?? payload.viewports.join(",")),
      trigger: "Manual",
      pagesQueued: row.pagesQueued ?? 1,
      pagesScanned: row.pagesScanned ?? 0,
      findingsTotal: row.findingsTotal ?? 0,
      score: null,
      createdAt: row.createdAt ?? new Date().toISOString(),
      startedAt: row.startedAt ?? null,
      finishedAt: row.finishedAt ?? null,
      errorMessage: row.errorMessage ?? null
    };
  } catch {
    return null;
  }
}
