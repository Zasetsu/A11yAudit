import type { Locale, Messages } from "./i18n/messages.js";

export type Severity = "critical" | "serious" | "moderate" | "minor";
export type FindingSource = "axe" | "custom" | "crawler";
export type FindingCertainty = "automatic_violation" | "needs_manual_verification" | "not_automatically_testable";
export type FindingStatus = "new" | "ongoing" | "resolved";
export type ScanStatus = "queued" | "crawling" | "auditing" | "reporting" | "completed" | "failed";
export type Viewport = "desktop" | "mobile" | "both";

export interface Project {
  id: string;
  name: string;
  url: string;
  domain: string;
  score: number;
  createdAt: string;
  lastScan: string | null;
  openFindings: number;
  reports: number;
  status: "active" | "archived";
  crawlLimit: number;
  viewports: string;
}

export interface ScanRun {
  id: string;
  projectId: string;
  projectName: string;
  url: string;
  status: ScanStatus;
  mode: string;
  maxPages: number;
  maxDepth: number;
  viewports: string;
  trigger: "Manual" | "API";
  pagesQueued: number;
  pagesScanned: number;
  findingsTotal: number;
  score: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface Finding {
  id: string;
  projectId: string;
  scanRunId: string;
  pageUrl: string;
  ruleId: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  wcagCriteria: string;
  selector: string | null;
  description: string | null;
  helpUrl: string | null;
  instances: number;
  createdAt: string;
  viewport: Viewport;
  origin: "component" | "template" | "content" | "third-party";
  testability: "automatic" | "manual";
  evidenceArtifacts: EvidenceArtifact[];
}

export interface Issue {
  id: string;
  projectId: string;
  scanRunId: string;
  issueKey: string;
  title: string;
  severity: Severity;
  source: FindingSource;
  certainty: FindingCertainty;
  status: FindingStatus;
  ruleId: string;
  wcagCriteria: string;
  description: string;
  recommendation: string;
  likelyScope: string;
  urlScopeGroup: string;
  componentArea: string;
  cmsHint: string;
  confidence: "high" | "medium" | "low";
  affectedPages: number;
  occurrences: number;
  viewportSummary: string;
  representativeUrl: string;
  representativeSelector: string | null;
  representativeHtmlSnippet: string | null;
  sampleUrls: string[];
  createdAt: string;
}

export interface EvidenceArtifact {
  kind: "page_screenshot" | "html_snippet" | string;
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Report {
  id: string;
  projectId: string;
  scanRunId: string;
  kind: string;
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  projectName: string;
  status: "ready" | "generating";
}

export const severityMeta: Record<Severity, { labelKey: keyof Messages; rank: number }> = {
  critical: { labelKey: "severity.critical", rank: 0 },
  serious: { labelKey: "severity.serious", rank: 1 },
  moderate: { labelKey: "severity.moderate", rank: 2 },
  minor: { labelKey: "severity.minor", rank: 3 }
};

export const demoProjects: Project[] = [
  {
    id: "proj-usagov",
    name: "USA.gov Portal",
    url: "https://example.gov",
    domain: "example.gov",
    score: 74,
    createdAt: "2026-05-10T10:20:00.000Z",
    lastScan: "2026-05-31T09:14:00.000Z",
    openFindings: 419,
    reports: 12,
    status: "active",
    crawlLimit: 250,
    viewports: "Desktop + mobile"
  },
  {
    id: "proj-services",
    name: "City Services Hub",
    url: "https://services.example.gov",
    domain: "services.example.gov",
    score: 81,
    createdAt: "2026-05-04T14:00:00.000Z",
    lastScan: "2026-05-29T16:40:00.000Z",
    openFindings: 207,
    reports: 7,
    status: "active",
    crawlLimit: 150,
    viewports: "Desktop + mobile"
  },
  {
    id: "proj-data",
    name: "Open Data Catalog",
    url: "https://data.example.gov",
    domain: "data.example.gov",
    score: 88,
    createdAt: "2026-04-28T08:30:00.000Z",
    lastScan: "2026-05-28T11:02:00.000Z",
    openFindings: 96,
    reports: 5,
    status: "active",
    crawlLimit: 100,
    viewports: "Desktop"
  },
  {
    id: "proj-benefits",
    name: "Benefits Application",
    url: "https://apply.example.gov",
    domain: "apply.example.gov",
    score: 63,
    createdAt: "2026-04-15T12:00:00.000Z",
    lastScan: "2026-05-30T22:18:00.000Z",
    openFindings: 534,
    reports: 9,
    status: "active",
    crawlLimit: 300,
    viewports: "Desktop + mobile"
  }
];

export const demoScanRuns: ScanRun[] = [
  {
    id: "run-1042",
    projectId: "proj-usagov",
    projectName: "USA.gov Portal",
    url: "https://example.gov",
    status: "auditing",
    mode: "Public URL crawl",
    maxPages: 250,
    maxDepth: 3,
    viewports: "Desktop + mobile",
    trigger: "Manual",
    pagesQueued: 248,
    pagesScanned: 173,
    findingsTotal: 431,
    score: null,
    createdAt: "2026-05-31T09:14:00.000Z",
    startedAt: "2026-05-31T09:14:21.000Z",
    finishedAt: null,
    errorMessage: null
  },
  {
    id: "run-1041",
    projectId: "proj-usagov",
    projectName: "USA.gov Portal",
    url: "https://example.gov",
    status: "completed",
    mode: "Public URL crawl",
    maxPages: 250,
    maxDepth: 3,
    viewports: "Desktop + mobile",
    trigger: "Manual",
    pagesQueued: 244,
    pagesScanned: 244,
    findingsTotal: 619,
    score: 71,
    createdAt: "2026-05-24T03:00:00.000Z",
    startedAt: "2026-05-24T03:00:10.000Z",
    finishedAt: "2026-05-24T03:21:04.000Z",
    errorMessage: null
  },
  {
    id: "run-1035",
    projectId: "proj-benefits",
    projectName: "Benefits Application",
    url: "https://apply.example.gov",
    status: "completed",
    mode: "Public URL crawl",
    maxPages: 300,
    maxDepth: 3,
    viewports: "Desktop + mobile",
    trigger: "Manual",
    pagesQueued: 312,
    pagesScanned: 308,
    findingsTotal: 871,
    score: 63,
    createdAt: "2026-05-30T22:18:00.000Z",
    startedAt: "2026-05-30T22:18:24.000Z",
    finishedAt: "2026-05-30T22:41:12.000Z",
    errorMessage: null
  },
  {
    id: "run-1031",
    projectId: "proj-services",
    projectName: "City Services Hub",
    url: "https://services.example.gov",
    status: "failed",
    mode: "Single public URL",
    maxPages: 1,
    maxDepth: 0,
    viewports: "Desktop + mobile",
    trigger: "Manual",
    pagesQueued: 41,
    pagesScanned: 12,
    findingsTotal: 38,
    score: null,
    createdAt: "2026-05-29T16:40:00.000Z",
    startedAt: "2026-05-29T16:40:08.000Z",
    finishedAt: "2026-05-29T16:44:01.000Z",
    errorMessage: "Navigation timeout while crawling linked pages"
  }
];

export const demoFindings: Finding[] = [
  {
    id: "f-4012",
    projectId: "proj-usagov",
    scanRunId: "run-1042",
    pageUrl: "https://example.gov/",
    ruleId: "button-name",
    title: "Icon-only mobile menu button has no accessible name",
    severity: "critical",
    status: "new",
    wcagCriteria: "4.1.2",
    selector: "header > nav > button.menu-toggle",
    description: "The control exposes a button role but does not provide an accessible name.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/button-name",
    instances: 41,
    createdAt: "2026-05-31T09:27:00.000Z",
    viewport: "mobile",
    origin: "component",
    testability: "automatic",
    evidenceArtifacts: []
  },
  {
    id: "f-3980",
    projectId: "proj-usagov",
    scanRunId: "run-1041",
    pageUrl: "https://example.gov/forms/contact",
    ruleId: "label",
    title: "Form field has no programmatically associated label",
    severity: "critical",
    status: "ongoing",
    wcagCriteria: "1.3.1",
    selector: "input#case-number",
    description: "Visible instructions are present, but the input is not associated with a label element.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/label",
    instances: 63,
    createdAt: "2026-05-24T03:18:00.000Z",
    viewport: "both",
    origin: "component",
    testability: "automatic",
    evidenceArtifacts: []
  },
  {
    id: "f-3955",
    projectId: "proj-usagov",
    scanRunId: "run-1041",
    pageUrl: "https://example.gov/search/results",
    ruleId: "color-contrast",
    title: "Text contrast below 4.5:1 on secondary navigation",
    severity: "serious",
    status: "ongoing",
    wcagCriteria: "1.4.3",
    selector: ".secondary-nav a",
    description: "Several navigation links have insufficient contrast against the panel background.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
    instances: 214,
    createdAt: "2026-05-24T03:16:00.000Z",
    viewport: "both",
    origin: "template",
    testability: "automatic",
    evidenceArtifacts: []
  },
  {
    id: "f-3922",
    projectId: "proj-usagov",
    scanRunId: "run-1042",
    pageUrl: "https://example.gov/search/results",
    ruleId: "target-size-min",
    title: "Pagination links smaller than 24 by 24 CSS pixels",
    severity: "moderate",
    status: "new",
    wcagCriteria: "2.5.8",
    selector: ".pagination a",
    description: "Tap targets are below the WCAG 2.2 AA target size minimum.",
    helpUrl: null,
    instances: 61,
    createdAt: "2026-05-31T09:25:00.000Z",
    viewport: "mobile",
    origin: "component",
    testability: "automatic",
    evidenceArtifacts: []
  },
  {
    id: "f-3910",
    projectId: "proj-usagov",
    scanRunId: "run-1041",
    pageUrl: "https://example.gov/benefits/overview",
    ruleId: "focus-visible-heuristic",
    title: "Visible focus indicator removed on primary links",
    severity: "serious",
    status: "ongoing",
    wcagCriteria: "2.4.7",
    selector: "main a.primary-link",
    description: "Keyboard focus is visually difficult to identify on primary content links.",
    helpUrl: null,
    instances: 56,
    createdAt: "2026-05-24T03:12:00.000Z",
    viewport: "both",
    origin: "template",
    testability: "manual",
    evidenceArtifacts: []
  },
  {
    id: "f-3866",
    projectId: "proj-services",
    scanRunId: "run-1031",
    pageUrl: "https://services.example.gov/news",
    ruleId: "link-name",
    title: "Link text is not descriptive out of context",
    severity: "minor",
    status: "ongoing",
    wcagCriteria: "2.4.4",
    selector: "article a.more",
    description: "Repeated links use generic text that does not describe the destination.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/link-name",
    instances: 142,
    createdAt: "2026-05-29T16:42:00.000Z",
    viewport: "both",
    origin: "content",
    testability: "manual",
    evidenceArtifacts: []
  }
];

export const demoIssues: Issue[] = [
  {
    id: "issue-button-name-header-menu",
    projectId: "proj-usagov",
    scanRunId: "run-1042",
    issueKey: "button-name|4.1.2|header menu|/*|header|Navigation menu button",
    title: "Icon-only mobile menu button has no accessible name",
    severity: "critical",
    source: "axe",
    certainty: "automatic_violation",
    status: "new",
    ruleId: "button-name",
    wcagCriteria: "4.1.2",
    description: "The control exposes a button role but does not provide an accessible name.",
    recommendation: "Add visible text or an aria-label that describes the menu button.",
    likelyScope: "Shared header component",
    urlScopeGroup: "/*",
    componentArea: "header",
    cmsHint: "Navigation menu button",
    confidence: "high",
    affectedPages: 41,
    occurrences: 41,
    viewportSummary: "mobile",
    representativeUrl: "https://example.gov/",
    representativeSelector: "header > nav > button.menu-toggle",
    representativeHtmlSnippet: null,
    sampleUrls: ["https://example.gov/"],
    createdAt: "2026-05-31T09:27:00.000Z"
  }
];

export const demoReports: Report[] = [
  {
    id: "rep-0312",
    projectId: "proj-usagov",
    scanRunId: "run-1041",
    kind: "pdf",
    artifactKey: "reports/rep-0312.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8_400_000,
    createdAt: "2026-05-24T03:23:00.000Z",
    projectName: "USA.gov Portal",
    status: "ready"
  },
  {
    id: "rep-0309",
    projectId: "proj-benefits",
    scanRunId: "run-1035",
    kind: "pdf",
    artifactKey: "reports/rep-0309.pdf",
    mimeType: "application/pdf",
    sizeBytes: 11_200_000,
    createdAt: "2026-05-30T22:44:00.000Z",
    projectName: "Benefits Application",
    status: "ready"
  },
  {
    id: "rep-generating",
    projectId: "proj-usagov",
    scanRunId: "run-1042",
    kind: "pdf",
    artifactKey: "reports/run-1042.pdf",
    mimeType: "application/pdf",
    sizeBytes: 0,
    createdAt: "2026-05-31T09:31:00.000Z",
    projectName: "USA.gov Portal",
    status: "generating"
  }
];

export function activeProject(): Project {
  return demoProjects[0];
}

export function emptyProject(): Project {
  return {
    id: "no-project",
    name: "No project selected",
    url: "",
    domain: "",
    score: 0,
    createdAt: new Date(0).toISOString(),
    lastScan: null,
    openFindings: 0,
    reports: 0,
    status: "active",
    crawlLimit: 0,
    viewports: "Desktop + mobile"
  };
}

export function formatDate(value: string | null, locale: Locale = "en", notAvailable = "Not available"): string {
  if (value === null) {
    return notAvailable;
  }

  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatBytes(value: number, pending = "Pending"): string {
  if (value <= 0) {
    return pending;
  }

  return `${(value / 1_000_000).toFixed(1)} MB`;
}
