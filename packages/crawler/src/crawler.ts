import { DEFAULT_SCAN_LIMITS } from "@a11yaudit/core";
import { assertSafeResolvedUrl } from "./network-safety.js";
import { isAllowedByRobots, parseRobotsTxt, type RobotsRules } from "./robots.js";
import { normalizeAuditUrl, shouldSkipUrl } from "./url-normalizer.js";

export interface CrawlInput {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  respectRobotsTxt?: boolean;
  pageTimeoutMs?: number;
  maxHtmlBytes?: number;
}

export interface SkippedUrl {
  url: string;
  reason: "asset" | "duplicate" | "external_origin" | "robots" | "unsafe" | "depth";
}

export interface CrawlResult {
  urls: string[];
  skipped: SkippedUrl[];
}

interface QueuedUrl {
  url: string;
  depth: number;
}

interface TimedResponse {
  response: Response;
  clearTimeout: () => void;
}

const HREF_PATTERN = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
const ROBOTS_MAX_BYTES = 64 * 1024;

async function assertSafeCrawlUrl(input: CrawlInput): Promise<void> {
  await assertSafeResolvedUrl(input.startUrl);
}

function extractAnchorHrefs(html: string): string[] {
  return [...html.matchAll(HREF_PATTERN)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .filter((href) => href.length > 0);
}

async function fetchWithTimeout(url: string | URL, timeoutMs: number): Promise<TimedResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal
    });

    return {
      response,
      clearTimeout: () => clearTimeout(timeout)
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function readTimedBoundedText(timedResponse: TimedResponse, maxBytes: number): Promise<string> {
  try {
    return await readBoundedText(timedResponse.response, maxBytes);
  } finally {
    timedResponse.clearTimeout();
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw new Error("Response body exceeds maximum size");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error("Response body exceeds maximum size");
      }

      chunks.push(value);
    }
  } catch {
    await reader.cancel();
    throw new Error("Unable to read bounded response body");
  }

  return new TextDecoder().decode(concatChunks(chunks, totalBytes));
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function isRedirectResponse(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

async function fetchRobotsRules(origin: string, timeoutMs: number, maxBytes: number): Promise<RobotsRules> {
  try {
    await assertSafeResolvedUrl(origin);
    const timedResponse = await fetchWithTimeout(new URL("/robots.txt", origin), timeoutMs);
    const { response } = timedResponse;
    if (isRedirectResponse(response) || !response.ok) {
      timedResponse.clearTimeout();
      return { disallow: [] };
    }

    return parseRobotsTxt(await readTimedBoundedText(timedResponse, Math.min(maxBytes, ROBOTS_MAX_BYTES)));
  } catch {
    return { disallow: [] };
  }
}

function normalizeCandidate(href: string, currentUrl: string): string | undefined {
  try {
    const url = new URL(href, currentUrl);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;

    return normalizeAuditUrl(url.href);
  } catch {
    return undefined;
  }
}

export async function crawlSameDomain(input: CrawlInput): Promise<CrawlResult> {
  await assertSafeCrawlUrl(input);

  const startUrl = normalizeAuditUrl(input.startUrl);
  const start = new URL(startUrl);
  const maxPages = input.maxPages ?? DEFAULT_SCAN_LIMITS.maxPages;
  const maxDepth = input.maxDepth ?? DEFAULT_SCAN_LIMITS.maxDepth;
  const pageTimeoutMs = input.pageTimeoutMs ?? DEFAULT_SCAN_LIMITS.pageTimeoutMs;
  const maxHtmlBytes = input.maxHtmlBytes ?? DEFAULT_SCAN_LIMITS.maxHtmlBytes;
  const respectRobotsTxt = input.respectRobotsTxt ?? DEFAULT_SCAN_LIMITS.respectRobotsTxt;
  const rules = respectRobotsTxt ? await fetchRobotsRules(start.origin, pageTimeoutMs, maxHtmlBytes) : { disallow: [] };
  const urls: string[] = [];
  const skipped: SkippedUrl[] = [];
  const queued = new Set<string>([startUrl]);
  const queue: QueuedUrl[] = [{ url: startUrl, depth: 0 }];

  if (shouldSkipUrl(startUrl)) {
    return { urls, skipped: [{ url: startUrl, reason: "asset" }] };
  }

  if (respectRobotsTxt && !isAllowedByRobots(start, rules)) {
    return { urls, skipped: [{ url: startUrl, reason: "robots" }] };
  }

  while (queue.length > 0 && urls.length < maxPages) {
    const current = queue.shift();
    if (!current) continue;

    let timedResponse: TimedResponse;
    try {
      await assertSafeResolvedUrl(current.url);
      timedResponse = await fetchWithTimeout(current.url, pageTimeoutMs);
    } catch {
      skipped.push({ url: current.url, reason: "unsafe" });
      continue;
    }

    const { response } = timedResponse;
    const contentType = response.headers.get("content-type") ?? "";
    if (isRedirectResponse(response)) {
      timedResponse.clearTimeout();
      skipped.push({ url: current.url, reason: "unsafe" });
      continue;
    }

    if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
      timedResponse.clearTimeout();
      continue;
    }

    let html: string;
    try {
      html = await readTimedBoundedText(timedResponse, maxHtmlBytes);
    } catch {
      skipped.push({ url: current.url, reason: "unsafe" });
      continue;
    }

    urls.push(current.url);

    for (const href of extractAnchorHrefs(html)) {
      const candidate = normalizeCandidate(href, current.url);
      if (!candidate) {
        skipped.push({ url: href, reason: "unsafe" });
        continue;
      }

      if (shouldSkipUrl(candidate)) {
        skipped.push({ url: candidate, reason: "asset" });
        continue;
      }

      const candidateUrl = new URL(candidate);
      if (candidateUrl.origin !== start.origin) {
        skipped.push({ url: candidate, reason: "external_origin" });
        continue;
      }

      const nextDepth = current.depth + 1;
      if (nextDepth > maxDepth) {
        skipped.push({ url: candidate, reason: "depth" });
        continue;
      }

      if (respectRobotsTxt && !isAllowedByRobots(candidateUrl, rules)) {
        skipped.push({ url: candidate, reason: "robots" });
        continue;
      }

      if (queued.has(candidate) || urls.includes(candidate)) {
        skipped.push({ url: candidate, reason: "duplicate" });
        continue;
      }

      queued.add(candidate);
      queue.push({ url: candidate, depth: nextDepth });
    }
  }

  return { urls, skipped };
}

export async function crawlStaticSeed(input: CrawlInput): Promise<CrawlResult> {
  await assertSafeCrawlUrl(input);

  const normalized = normalizeAuditUrl(input.startUrl);
  return { urls: shouldSkipUrl(normalized) ? [] : [normalized], skipped: [] };
}
