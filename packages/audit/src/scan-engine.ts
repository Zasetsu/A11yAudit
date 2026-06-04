import {
  assertSafeResolvedUrl,
  crawlSameDomain,
  crawlStaticSeed,
  normalizeAuditUrl,
  shouldSkipUrl
} from "@a11yaudit/crawler";
import {
  aggregateScanIssues,
  diffScanIssues,
  DEFAULT_SCAN_LIMITS,
  type AuditedPage,
  type BaselineIssue,
  type CompletedScanResult,
  type EvidenceArtifact,
  type ScanFinding,
  type ScanRequest
} from "@a11yaudit/core";
import { buildAuditReportModel, MAX_ELEMENTS_PER_CARD, renderPdfFromHtml, renderReportHtml } from "@a11yaudit/reporter";
import { auditPage } from "@a11yaudit/rules";
import { createArtifactKey, type StorageAdapter } from "@a11yaudit/storage";
import { chromium, type Browser, type BrowserContext, type ElementHandle, type Page } from "playwright";
import { calculateScore } from "./score.js";

const PDF_DETAILED_FINDING_LIMIT = 500;
const PDF_EVIDENCE_ROW_LIMIT = 500;
// Crop capture is aligned to what the report actually displays: each problem card
// shows at most MAX_ELEMENTS_PER_CARD elements, so we capture a crop only for the
// first MAX_ELEMENTS_PER_CARD findings of each rule on a page (the displayed ones),
// bounded by a per-page ceiling so pathological pages with many rules stay fast.
const MAX_ELEMENT_CROPS_PER_PAGE = 80;
const CROP_CONTEXT_PADDING = 24;

export async function collectScreenshotDataUris(
  findings: ScanFinding[],
  storage: StorageAdapter
): Promise<Map<string, string>> {
  const keys = new Map<string, string>(); // artifactKey -> mimeType
  for (const finding of findings) {
    for (const evidence of finding.evidence) {
      // Only element crops are embedded inline. Full-page screenshots stay as
      // downloadable artifacts — inlining them duplicated a multi-MB image per
      // element and bloated the report to hundreds of MB (PDF render then crashed).
      if (evidence.kind === "element_screenshot") {
        keys.set(evidence.artifactKey, evidence.mimeType);
      }
    }
  }

  const result = new Map<string, string>();
  for (const [key, mimeType] of keys) {
    try {
      const bytes = await storage.get(key);
      result.set(key, `data:${mimeType};base64,${bytes.toString("base64")}`);
    } catch {
      // missing artifact -> skip; the report renders that element without an image
    }
  }
  return result;
}

export interface ScanProgressEvent {
  status: "crawling" | "auditing" | "reporting";
  pagesQueued: number;
  pagesScanned: number;
  findingsTotal: number;
}

export interface RunScanInput {
  request: ScanRequest;
  storage: StorageAdapter;
  onProgress?: (event: ScanProgressEvent) => Promise<void> | void;
  baselineIssues?: BaselineIssue[];
}

export async function runScan(input: RunScanInput): Promise<CompletedScanResult> {
  const startedAt = new Date().toISOString();
  const pages: AuditedPage[] = [];
  const findings: ScanFinding[] = [];
  const cropCapWarnings: string[] = [];
  let browser: Browser | null = null;

  await emitProgress(input, "crawling", 0, 0, 0);
  const urls = await crawlRequestedUrls(input);
  if (urls.length === 0) {
    throw new Error("No auditable URLs found");
  }

  const pagesQueued = urls.length * input.request.viewports.length;
  await emitProgress(input, "auditing", pagesQueued, 0, 0);

  try {
    browser = await chromium.launch({ headless: true });

    for (const url of urls) {
      for (const viewport of input.request.viewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        await installNavigationSafetyRoute(context, url);
        const page = await context.newPage();

        try {
          const response = await page.goto(url, {
            waitUntil: "networkidle",
            timeout: DEFAULT_SCAN_LIMITS.navigationTimeoutMs
          });
          const finalUrl = page.url() || url;
          await validateFinalNavigation(url, finalUrl);
          const normalizedUrl = normalizeUrlSafely(finalUrl);
          const auditResult = await auditPage({
            page,
            url,
            normalizedUrl,
            viewport
          });

          pages.push({
            ...auditResult.page,
            statusCode: response?.status() ?? auditResult.page.statusCode
          });

          const pageScreenshot = auditResult.findings.length > 0
            ? await capturePageScreenshotEvidence({
              runId: input.request.runId,
              page,
              normalizedUrl,
              viewport: viewport.name,
              storage: input.storage
            })
            : null;

          let cropsThisPage = 0;
          let cropsSkippedByCap = 0;
          const cropsByRule = new Map<string, number>();
          for (const finding of auditResult.findings) {
            let elementCrop: EvidenceArtifact | null = null;
            // Only capture a crop if this element will actually be displayed: within
            // the first MAX_ELEMENTS_PER_CARD findings of its rule (the per-card limit).
            const ruleCropCount = cropsByRule.get(finding.ruleId) ?? 0;
            const willBeDisplayed = Boolean(finding.selector) && ruleCropCount < MAX_ELEMENTS_PER_CARD;
            if (willBeDisplayed && cropsThisPage < MAX_ELEMENT_CROPS_PER_PAGE) {
              const handle = await page.$(finding.selector!).catch(() => null);
              if (handle) {
                elementCrop = await captureElementCropEvidence({
                  runId: input.request.runId,
                  page,
                  element: handle,
                  fingerprint: finding.fingerprint,
                  storage: input.storage
                });
                await handle.dispose().catch(() => undefined);
                if (elementCrop) {
                  cropsThisPage += 1;
                  cropsByRule.set(finding.ruleId, ruleCropCount + 1);
                }
              }
            } else if (willBeDisplayed && cropsThisPage >= MAX_ELEMENT_CROPS_PER_PAGE) {
              // A displayed element missed its crop only because the per-page ceiling
              // was hit — this is the meaningful loss worth surfacing.
              cropsSkippedByCap += 1;
            }
            const snippet = await captureSnippetEvidence(input.request.runId, finding, input.storage);
            const evidence = [
              ...(elementCrop ? [elementCrop] : []),
              ...(pageScreenshot ? [pageScreenshot] : []),
              ...snippet
            ];
            findings.push({ ...finding, evidence });
          }
          if (cropsSkippedByCap > 0) {
            const warning = `Per-page element screenshot ceiling (${MAX_ELEMENT_CROPS_PER_PAGE}) reached on ${normalizedUrl} (${viewport.name}): ${cropsSkippedByCap} displayed element(s) shown without a crop.`;
            cropCapWarnings.push(warning);
            console.warn(`[scan-engine] ${warning}`);
          }
        } catch (error) {
          pages.push(createFailedPage(url, viewport.name, error));
        } finally {
          await page.close().catch(() => undefined);
          await context.close().catch(() => undefined);
        }

        await emitProgress(input, "auditing", pagesQueued, pages.length, findings.length);
      }
    }
  } finally {
    await browser?.close().catch(() => undefined);
  }

  if (!pages.some((page) => page.errorMessage === null)) {
    throw new Error("No pages were audited successfully");
  }

  const currentIssues = aggregateScanIssues(findings, { auditedPages: pages });
  const diff = diffScanIssues(currentIssues, input.baselineIssues ?? []);

  const statusByFingerprint = new Map<string, "new" | "ongoing">();
  for (const issue of diff.issues) {
    for (const fp of issue.occurrenceFingerprints) {
      if (fp) statusByFingerprint.set(fp, issue.status);
    }
  }
  const diffedFindings: ScanFinding[] = findings.map((f) => ({
    ...f,
    status: statusByFingerprint.get(f.fingerprint) ?? "new"
  }));

  const score = calculateScore(diffedFindings);
  await emitProgress(input, "reporting", pagesQueued, pages.length, diffedFindings.length);
  const { reports, reportWarnings } = await storeReports(input, {
    score,
    pages,
    findings: diffedFindings,
    diffSummary: {
      counts: diff.counts,
      resolvedTitles: diff.resolved.map((r) => r.title),
      hasBaseline: (input.baselineIssues ?? []).length > 0
    }
  });

  return {
    runId: input.request.runId,
    projectId: input.request.projectId,
    targetUrl: input.request.targetUrl,
    mode: input.request.mode,
    pages,
    findings: diffedFindings,
    reports,
    reportWarnings: [...cropCapWarnings, ...reportWarnings],
    resolvedIssues: diff.resolved,
    score,
    startedAt,
    finishedAt: new Date().toISOString()
  };
}

async function crawlRequestedUrls(input: RunScanInput): Promise<string[]> {
  const request = input.request;
  const crawlInput = {
    startUrl: request.targetUrl,
    maxPages: request.maxPages,
    maxDepth: request.maxDepth,
    respectRobotsTxt: request.respectRobotsTxt,
    pageTimeoutMs: DEFAULT_SCAN_LIMITS.pageTimeoutMs,
    maxHtmlBytes: DEFAULT_SCAN_LIMITS.maxHtmlBytes
  };

  if (request.mode === "same_domain_crawl") {
    const result = await crawlSameDomain(crawlInput);
    return result.urls.slice(0, request.maxPages);
  }

  if (request.mode === "single_url") {
    const result = await crawlStaticSeed(crawlInput);
    return result.urls.slice(0, request.maxPages);
  }

  const urls = request.urls && request.urls.length > 0 ? request.urls : [request.targetUrl];
  const normalizedUrls: string[] = [];

  for (const url of urls) {
    try {
      const result = await crawlStaticSeed({
        ...crawlInput,
        startUrl: url,
        maxPages: 1,
        maxDepth: 0
      });

      for (const normalizedUrl of result.urls) {
        if (!shouldSkipUrl(normalizedUrl) && !normalizedUrls.includes(normalizedUrl)) {
          normalizedUrls.push(normalizedUrl);
        }
      }
    } catch {
      continue;
    }

    if (normalizedUrls.length >= request.maxPages) break;
  }

  return normalizedUrls;
}

async function installNavigationSafetyRoute(
  context: BrowserContext,
  requestedUrl: string
): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    try {
      await validateSafeAuditUrl(request.url());

      if (request.resourceType() === "document") {
        const response = await route.fetch({ maxRedirects: 0 });
        const redirectUrl = getRedirectLocation(response.status(), response.headers(), request.url());
        if (redirectUrl) {
          await validateFinalNavigation(requestedUrl, redirectUrl);
        }

        await route.fulfill({ response });
        return;
      }

      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
}

function getRedirectLocation(status: number, headers: Record<string, string>, requestUrl: string): string | null {
  if (status < 300 || status >= 400) {
    return null;
  }

  const location = headers.location;
  if (!location) {
    return null;
  }

  return new URL(location, requestUrl).href;
}

async function capturePageScreenshotEvidence(input: {
  runId: string;
  page: Page;
  normalizedUrl: string;
  viewport: AuditedPage["viewport"];
  storage: StorageAdapter;
}): Promise<EvidenceArtifact> {
  const pageScreenshot = await input.page.screenshot({ fullPage: true, type: "png" });
  const pageKey = createArtifactKey({
    runId: input.runId,
    kind: "screenshot",
    name: `${input.normalizedUrl}:${input.viewport}:page`,
    extension: "png"
  });
  const storedPage = await input.storage.put(pageKey, Buffer.from(pageScreenshot), "image/png");

  return {
    kind: "page_screenshot",
    artifactKey: storedPage.key,
    mimeType: storedPage.mimeType,
    sizeBytes: storedPage.sizeBytes
  };
}

async function captureSnippetEvidence(
  runId: string,
  finding: ScanFinding,
  storage: StorageAdapter
): Promise<EvidenceArtifact[]> {
  if (!finding.htmlSnippet) {
    return [];
  }

  const snippetKey = createArtifactKey({
    runId,
    kind: "snippet",
    name: `${finding.fingerprint}:html`,
    extension: "txt"
  });
  const storedSnippet = await storage.put(snippetKey, Buffer.from(finding.htmlSnippet), "text/plain");

  return [
    {
      kind: "html_snippet",
      artifactKey: storedSnippet.key,
      mimeType: storedSnippet.mimeType,
      sizeBytes: storedSnippet.sizeBytes
    }
  ];
}

export async function captureElementCropEvidence(input: {
  runId: string;
  page: Page;
  element: ElementHandle<Element>;
  fingerprint: string;
  storage: StorageAdapter;
}): Promise<EvidenceArtifact | null> {
  try {
    await input.element.evaluate((node) => {
      const el = node as HTMLElement;
      el.dataset.aaPrevOutline = el.style.outline;
      el.dataset.aaPrevOutlineOffset = el.style.outlineOffset;
      el.style.outline = "3px solid #e11d48";
      el.style.outlineOffset = "2px";
    });

    const box = await input.element.boundingBox();
    if (!box) {
      await clearCropHighlight(input.element);
      return null;
    }

    const viewport = input.page.viewportSize() ?? { width: box.x + box.width, height: box.y + box.height };
    const clipX = Math.max(0, box.x - CROP_CONTEXT_PADDING);
    const clipY = Math.max(0, box.y - CROP_CONTEXT_PADDING);
    const clip = {
      x: clipX,
      y: clipY,
      width: Math.max(1, Math.min(viewport.width - clipX, box.width + CROP_CONTEXT_PADDING * 2)),
      height: Math.max(1, Math.min(viewport.height - clipY, box.height + CROP_CONTEXT_PADDING * 2))
    };
    const png = await input.page.screenshot({ type: "png", clip });
    await clearCropHighlight(input.element);

    const key = createArtifactKey({
      runId: input.runId,
      kind: "screenshot",
      name: `${input.fingerprint}:crop`,
      extension: "png"
    });
    const stored = await input.storage.put(key, Buffer.from(png), "image/png");
    return { kind: "element_screenshot", artifactKey: stored.key, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes };
  } catch {
    await clearCropHighlight(input.element).catch(() => undefined);
    return null;
  }
}

async function clearCropHighlight(element: ElementHandle<Element>): Promise<void> {
  await element.evaluate((node) => {
    const el = node as HTMLElement;
    el.style.outline = el.dataset.aaPrevOutline ?? "";
    el.style.outlineOffset = el.dataset.aaPrevOutlineOffset ?? "";
    delete el.dataset.aaPrevOutline;
    delete el.dataset.aaPrevOutlineOffset;
  });
}

async function validateFinalNavigation(requestedUrl: string, finalUrl: string): Promise<void> {
  await validateSafeAuditUrl(finalUrl);

  const requested = new URL(requestedUrl);
  const final = new URL(finalUrl);
  if (requested.origin !== final.origin) {
    throw new Error(`Unsafe redirect: final URL origin changed from ${requested.origin} to ${final.origin}`);
  }
}

async function validateSafeAuditUrl(url: string): Promise<void> {
  await assertSafeResolvedUrl(url);
}

async function storeReports(
  input: RunScanInput,
  reportInput: {
    score: number;
    pages: AuditedPage[];
    findings: ScanFinding[];
    diffSummary: { counts: { new: number; ongoing: number; resolved: number }; resolvedTitles: string[]; hasBaseline: boolean };
  }
): Promise<{ reports: CompletedScanResult["reports"]; reportWarnings: string[] }> {
  const generatedAt = new Date().toISOString();
  const screenshotDataUris = await collectScreenshotDataUris(reportInput.findings, input.storage);
  const report = buildAuditReportModel({
    request: input.request,
    pages: reportInput.pages,
    findings: reportInput.findings,
    score: reportInput.score,
    generatedAt,
    locale: "tr",
    screenshotDataUris,
    diffSummary: reportInput.diffSummary
  });
  const html = renderReportHtml(report);
  const htmlArtifact = await input.storage.put(
    createArtifactKey({
      runId: input.request.runId,
      kind: "report",
      name: "audit-report-html",
      extension: "html"
    }),
    Buffer.from(html),
    "text/html"
  );
  const reports: CompletedScanResult["reports"] = [
    {
      kind: "html",
      artifactKey: htmlArtifact.key,
      mimeType: htmlArtifact.mimeType,
      sizeBytes: htmlArtifact.sizeBytes
    }
  ];
  const reportWarnings: string[] = [];

  try {
    const pdfHtml = renderReportHtml(report, {
      maxDetailedFindings: PDF_DETAILED_FINDING_LIMIT,
      maxEvidenceRows: PDF_EVIDENCE_ROW_LIMIT
    });
    const pdf = await renderPdfFromHtml(pdfHtml);
    const pdfArtifact = await input.storage.put(
      createArtifactKey({
        runId: input.request.runId,
        kind: "report",
        name: "audit-report-pdf",
        extension: "pdf"
      }),
      pdf,
      "application/pdf"
    );
    reports.push({
      kind: "pdf",
      artifactKey: pdfArtifact.key,
      mimeType: pdfArtifact.mimeType,
      sizeBytes: pdfArtifact.sizeBytes
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportWarnings.push(`PDF report failed: ${message}`);
  }

  return { reports, reportWarnings };
}

async function emitProgress(
  input: RunScanInput,
  status: ScanProgressEvent["status"],
  pagesQueued: number,
  pagesScanned: number,
  findingsTotal: number
): Promise<void> {
  await input.onProgress?.({ status, pagesQueued, pagesScanned, findingsTotal });
}

function createFailedPage(url: string, viewport: AuditedPage["viewport"], error: unknown): AuditedPage {
  return {
    url,
    normalizedUrl: normalizeUrlSafely(url),
    title: null,
    viewport,
    statusCode: null,
    finalUrl: url,
    durationMs: 0,
    errorMessage: getAuditErrorMessage(error)
  };
}

function getAuditErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unable to audit page";
  if (message.includes("ERR_BLOCKED_BY_CLIENT")) {
    return "Unsafe document request blocked";
  }

  return message;
}

function normalizeUrlSafely(url: string): string {
  try {
    return normalizeAuditUrl(url);
  } catch {
    return url;
  }
}
