import { createHash } from "node:crypto";
import type { ScanFinding, ViewportName } from "./models.js";

export type IssueConfidence = "high" | "medium" | "low";
export type ComponentArea = "header" | "footer" | "nav" | "aside" | "form" | "main" | "unknown";
export type CmsHint =
  | "Elementor widget button"
  | "Elementor nav menu"
  | "Elementor form"
  | "WordPress single post"
  | "WordPress archive/category"
  | "WordPress post template"
  | "none";
export type ViewportSummary = ViewportName | "desktop,mobile";

export interface UrlScopeInference {
  scope: "global" | "single page" | `URL group ${string}`;
  groupKey: string;
}

export interface IssueKeyInput {
  ruleId: string;
  wcagCriteria: string[];
  elementSignature: string;
  urlScopeGroup: string;
  scopeOrigin?: string;
  componentArea: ComponentArea;
  cmsHint: CmsHint;
}

export interface AggregatedIssue {
  id: string;
  issueKey: string;
  title: string;
  severity: ScanFinding["severity"];
  status: ScanFinding["status"];
  source: ScanFinding["source"];
  certainty: ScanFinding["certainty"];
  origin: ScanFinding["origin"];
  wcagCriteria: string[];
  ruleId: string;
  description: string;
  recommendation: string;
  helpUrl: string | null;
  likelyScope: UrlScopeInference["scope"];
  urlScopeGroup: string;
  componentArea: ComponentArea;
  cmsHint: CmsHint;
  elementSignature: string;
  affectedPages: number;
  occurrences: number;
  viewportSummary: ViewportSummary;
  confidence: IssueConfidence;
  representativeUrl: string;
  representativeSelector: string | null;
  representativeHtmlSnippet: string | null;
  sampleUrls: string[];
  occurrenceFingerprints: string[];
  occurrenceIds: string[];
}

interface IssueAccumulator {
  first: ScanFinding;
  componentArea: ComponentArea;
  cmsHint: CmsHint;
  elementSignature: string;
  pages: Map<string, string>;
  viewports: Set<ViewportName>;
  occurrences: number;
  occurrenceFingerprints: string[];
  occurrenceIds: string[];
}

export function inferUrlScope(url: string, groupSize: number): UrlScopeInference {
  const path = normalizeUrlPath(url);

  if (path === "/") {
    return { scope: "global", groupKey: "/" };
  }

  if (groupSize <= 1) {
    return { scope: "single page", groupKey: path };
  }

  const firstSegment = path.split("/").filter(Boolean)[0];
  if (!firstSegment) {
    return { scope: "global", groupKey: "/" };
  }

  const groupKey = `/${firstSegment}/*`;
  return { scope: `URL group ${groupKey}`, groupKey };
}

export function inferComponentArea(selector: string | null, htmlSnippet: string | null): ComponentArea {
  const haystack = `${selector ?? ""} ${htmlSnippet ?? ""}`.toLowerCase();

  if (matchesArea(haystack, "header")) return "header";
  if (matchesArea(haystack, "footer")) return "footer";
  if (matchesArea(haystack, "nav") || /\bnavigation\b/.test(haystack)) return "nav";
  if (matchesArea(haystack, "aside") || /\bsidebar\b/.test(haystack)) return "aside";
  if (matchesArea(haystack, "form")) return "form";
  if (matchesArea(haystack, "main")) return "main";

  return "unknown";
}

export function inferCmsHint(selector: string | null, htmlSnippet: string | null): CmsHint {
  const haystack = `${selector ?? ""} ${htmlSnippet ?? ""}`.toLowerCase();

  if (haystack.includes("elementor-widget-button")) return "Elementor widget button";
  if (haystack.includes("elementor-widget-nav-menu") || haystack.includes("elementor-nav-menu")) {
    return "Elementor nav menu";
  }
  if (haystack.includes("elementor-widget-form") || haystack.includes("elementor-form")) {
    return "Elementor form";
  }
  if (/\bsingle-post\b/.test(haystack)) return "WordPress single post";
  if (/\barchive\b|\bcategory\b|\bcategory-[\w-]+/.test(haystack)) return "WordPress archive/category";
  if (/\bpost-template\b|\bpost-template-[\w-]+/.test(haystack)) return "WordPress post template";

  return "none";
}

export function createIssueKey(input: IssueKeyInput): string {
  return JSON.stringify([
    input.ruleId,
    [...input.wcagCriteria].sort(),
    normalizeElementSignature(input.elementSignature),
    input.urlScopeGroup,
    input.scopeOrigin ?? "",
    input.componentArea,
    input.cmsHint
  ]);
}

export function aggregateScanIssues(findings: ScanFinding[]): AggregatedIssue[] {
  const accumulators = new Map<string, IssueAccumulator>();

  for (const finding of findings) {
    const elementSignature = getElementSignature(finding);
    const componentArea = inferComponentArea(finding.selector, finding.htmlSnippet);
    const cmsHint = inferCmsHint(finding.selector, finding.htmlSnippet);
    const candidateKey = createIssueKey({
      ruleId: finding.ruleId,
      wcagCriteria: finding.wcagCriteria,
      elementSignature,
      urlScopeGroup: firstSegmentScopeGroup(finding.pageUrl),
      scopeOrigin: getUrlOrigin(finding.pageUrl),
      componentArea,
      cmsHint
    });
    const normalizedUrl = normalizeUrlWithoutHash(finding.pageUrl);
    const existing = accumulators.get(candidateKey);

    if (existing) {
      existing.pages.set(normalizedUrl, normalizedUrl);
      existing.viewports.add(finding.viewport);
      existing.occurrences += finding.instances;
      existing.occurrenceFingerprints.push(finding.fingerprint);
      existing.occurrenceIds.push(finding.id);
      continue;
    }

    accumulators.set(candidateKey, {
      first: finding,
      componentArea,
      cmsHint,
      elementSignature,
      pages: new Map([[normalizedUrl, normalizedUrl]]),
      viewports: new Set([finding.viewport]),
      occurrences: finding.instances,
      occurrenceFingerprints: [finding.fingerprint],
      occurrenceIds: [finding.id]
    });
  }

  return [...accumulators.values()].map(toAggregatedIssue);
}

function toAggregatedIssue(accumulator: IssueAccumulator): AggregatedIssue {
  const sampleUrls = [...accumulator.pages.values()];
  const affectedPages = sampleUrls.length;
  const urlScope = inferUrlScope(accumulator.first.pageUrl, affectedPages);
  const issueKey = createIssueKey({
    ruleId: accumulator.first.ruleId,
    wcagCriteria: accumulator.first.wcagCriteria,
    elementSignature: accumulator.elementSignature,
    urlScopeGroup: urlScope.groupKey,
    scopeOrigin: getUrlOrigin(accumulator.first.pageUrl),
    componentArea: accumulator.componentArea,
    cmsHint: accumulator.cmsHint
  });

  return {
    id: createIssueId(issueKey),
    issueKey,
    title: accumulator.first.title,
    severity: accumulator.first.severity,
    status: accumulator.first.status,
    source: accumulator.first.source,
    certainty: accumulator.first.certainty,
    origin: accumulator.first.origin,
    wcagCriteria: [...accumulator.first.wcagCriteria],
    ruleId: accumulator.first.ruleId,
    description: accumulator.first.description,
    recommendation: accumulator.first.recommendation,
    helpUrl: accumulator.first.helpUrl,
    likelyScope: urlScope.scope,
    urlScopeGroup: urlScope.groupKey,
    componentArea: accumulator.componentArea,
    cmsHint: accumulator.cmsHint,
    elementSignature: accumulator.elementSignature,
    affectedPages,
    occurrences: accumulator.occurrences,
    viewportSummary: summarizeViewports(accumulator.viewports),
    confidence: inferConfidence(affectedPages),
    representativeUrl: accumulator.first.pageUrl,
    representativeSelector: accumulator.first.selector,
    representativeHtmlSnippet: accumulator.first.htmlSnippet,
    sampleUrls,
    occurrenceFingerprints: [...accumulator.occurrenceFingerprints],
    occurrenceIds: [...accumulator.occurrenceIds]
  };
}

function inferConfidence(affectedPages: number): IssueConfidence {
  if (affectedPages >= 5) return "high";
  if (affectedPages >= 3) return "medium";
  return "low";
}

function summarizeViewports(viewports: Set<ViewportName>): ViewportSummary {
  if (viewports.has("desktop") && viewports.has("mobile")) return "desktop,mobile";
  if (viewports.has("mobile")) return "mobile";
  return "desktop";
}

function createIssueId(issueKey: string): string {
  return `issue-${createHash("sha256").update(issueKey).digest("base64url").slice(0, 24)}`;
}

function firstSegmentScopeGroup(url: string): string {
  const path = normalizeUrlPath(url);
  const firstSegment = path.split("/").filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}/*` : "/";
}

function getElementSignature(finding: ScanFinding): string {
  return finding.selector ?? finding.htmlSnippet ?? finding.title;
}

function getUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function normalizeUrlWithoutHash(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("#", 1)[0] ?? url;
  }
}

function normalizeUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return normalizePath(parsed.pathname);
  } catch {
    return normalizePath(url.split(/[?#]/, 1)[0] ?? "/");
  }
}

function normalizePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash = normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
  return withoutTrailingSlash || "/";
}

function normalizeElementSignature(elementSignature: string): string {
  return elementSignature.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesArea(haystack: string, area: Exclude<ComponentArea, "unknown">): boolean {
  return new RegExp(`(^|[\\s.#<"/-])${area}([\\s.#>"/-]|$)`).test(haystack);
}
