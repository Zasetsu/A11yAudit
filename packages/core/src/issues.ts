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
  issueKey: string;
  urlScope: UrlScopeInference;
  componentArea: ComponentArea;
  cmsHint: CmsHint;
  elementSignature: string;
  groupSize: number;
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
  return [
    input.ruleId,
    [...input.wcagCriteria].sort().join(","),
    normalizeElementSignature(input.elementSignature),
    input.urlScopeGroup,
    input.componentArea,
    input.cmsHint
  ].join("|");
}

export function aggregateScanIssues(findings: ScanFinding[]): AggregatedIssue[] {
  const groupSizes = countUrlScopeGroups(findings);
  const accumulators = new Map<string, IssueAccumulator>();

  for (const finding of findings) {
    const elementSignature = finding.selector ?? "unknown";
    const groupSize = groupSizes.get(firstSegmentGroupKey(finding.pageUrl)) ?? 1;
    const urlScope = inferUrlScope(finding.pageUrl, groupSize);
    const componentArea = inferComponentArea(finding.selector, finding.htmlSnippet);
    const cmsHint = inferCmsHint(finding.selector, finding.htmlSnippet);
    const issueKey = createIssueKey({
      ruleId: finding.ruleId,
      wcagCriteria: finding.wcagCriteria,
      elementSignature,
      urlScopeGroup: urlScope.groupKey,
      componentArea,
      cmsHint
    });
    const normalizedUrl = normalizeUrlWithoutHash(finding.pageUrl);
    const existing = accumulators.get(issueKey);

    if (existing) {
      existing.pages.set(normalizedUrl, normalizedUrl);
      existing.viewports.add(finding.viewport);
      existing.occurrences += finding.instances;
      existing.occurrenceFingerprints.push(finding.fingerprint);
      existing.occurrenceIds.push(finding.id);
      continue;
    }

    accumulators.set(issueKey, {
      first: finding,
      issueKey,
      urlScope,
      componentArea,
      cmsHint,
      elementSignature,
      groupSize,
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

  return {
    id: createIssueId(accumulator.issueKey),
    issueKey: accumulator.issueKey,
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
    likelyScope: accumulator.urlScope.scope,
    urlScopeGroup: accumulator.urlScope.groupKey,
    componentArea: accumulator.componentArea,
    cmsHint: accumulator.cmsHint,
    elementSignature: accumulator.elementSignature,
    affectedPages,
    occurrences: accumulator.occurrences,
    viewportSummary: summarizeViewports(accumulator.viewports),
    confidence: inferConfidence(accumulator.groupSize, affectedPages),
    representativeUrl: accumulator.first.pageUrl,
    representativeSelector: accumulator.first.selector,
    representativeHtmlSnippet: accumulator.first.htmlSnippet,
    sampleUrls,
    occurrenceFingerprints: [...accumulator.occurrenceFingerprints],
    occurrenceIds: [...accumulator.occurrenceIds]
  };
}

function inferConfidence(groupSize: number, affectedPages: number): IssueConfidence {
  const ratio = groupSize === 0 ? 0 : affectedPages / groupSize;

  if (groupSize >= 5 && ratio >= 0.8) return "high";
  if (groupSize >= 3 && ratio >= 0.4) return "medium";
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

function countUrlScopeGroups(findings: ScanFinding[]): Map<string, number> {
  const groupedPages = new Map<string, Set<string>>();

  for (const finding of findings) {
    const groupKey = firstSegmentGroupKey(finding.pageUrl);
    const pages = groupedPages.get(groupKey) ?? new Set<string>();
    pages.add(normalizeUrlWithoutHash(finding.pageUrl));
    groupedPages.set(groupKey, pages);
  }

  return new Map([...groupedPages].map(([groupKey, pages]) => [groupKey, pages.size]));
}

function firstSegmentGroupKey(url: string): string {
  const path = normalizeUrlPath(url);
  const firstSegment = path.split("/").filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}/*` : "/";
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
