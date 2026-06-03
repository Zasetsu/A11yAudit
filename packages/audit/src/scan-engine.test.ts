import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_VIEWPORTS, type ScanRequest } from "@a11yaudit/core";
import { LocalStorageAdapter } from "@a11yaudit/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureElementCropEvidence, collectScreenshotDataUris, runScan } from "./scan-engine.js";

const crawlerSafety = vi.hoisted(() => ({
  assertSafeResolvedUrl: vi.fn(),
  unsafeResolvedHosts: new Set<string>()
}));

const reporterMocks = vi.hoisted(() => ({
  renderReportHtml: vi.fn(),
  renderPdfFromHtml: vi.fn()
}));

vi.mock("@a11yaudit/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@a11yaudit/crawler")>();
  const assertSafeUrl = vi.fn((input: string) => {
    const hostname = new URL(input).hostname.toLowerCase();
    if (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]") {
      return;
    }

    actual.assertSafeUrl(input);
  });
  crawlerSafety.assertSafeResolvedUrl.mockImplementation(async (input: string) => {
    const hostname = new URL(input).hostname.toLowerCase();
    if (crawlerSafety.unsafeResolvedHosts.has(hostname)) {
      throw new Error(`Blocked unsafe audit target: ${hostname} resolved to 127.0.0.1`);
    }

    assertSafeUrl(input);
  });
  const crawlStaticSeed = vi.fn(async (input: Parameters<typeof actual.crawlStaticSeed>[0]) => {
    await crawlerSafety.assertSafeResolvedUrl(input.startUrl);
    const normalized = actual.normalizeAuditUrl(input.startUrl);
    return { urls: actual.shouldSkipUrl(normalized) ? [] : [normalized], skipped: [] };
  });

  return {
    ...actual,
    assertSafeUrl,
    assertSafeResolvedUrl: crawlerSafety.assertSafeResolvedUrl,
    crawlStaticSeed,
    crawlSameDomain: vi.fn(async (input: Parameters<typeof actual.crawlSameDomain>[0]) => crawlStaticSeed(input))
  };
});

vi.mock("@a11yaudit/reporter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@a11yaudit/reporter")>();

  return {
    ...actual,
    renderReportHtml: reporterMocks.renderReportHtml,
    renderPdfFromHtml: reporterMocks.renderPdfFromHtml
  };
});

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine fixture server address"));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}/`);
    });
  });
}

function closeServer(server: Server | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe("runScan", () => {
  let server: Server | null = null;
  let tempDir: string | null = null;

  beforeEach(() => {
    reporterMocks.renderReportHtml.mockReturnValue("<!doctype html><html><body>Report</body></html>");
    reporterMocks.renderPdfFromHtml.mockResolvedValue(Buffer.from("%PDF-1.4\n"));
  });

  afterEach(async () => {
    crawlerSafety.assertSafeResolvedUrl.mockClear();
    crawlerSafety.unsafeResolvedHosts.clear();
    reporterMocks.renderReportHtml.mockReset();
    reporterMocks.renderPdfFromHtml.mockReset();

    await closeServer(server);
    server = null;

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("audits a local single URL across configured viewports and stores reports", async () => {
    server = createServer((request, response) => {
      if (request.url === "/missing.png") {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html lang="en">
          <head><title>Audit Fixture</title></head>
          <body><main><h1>Audit Fixture</h1><img src="/missing.png"></main></body>
        </html>`);
    });
    const url = await listen(server);
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-1",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: DEFAULT_VIEWPORTS,
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    const result = await runScan({
      request,
      storage
    });

    expect(result.pages).toHaveLength(2);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.reports.map((report) => report.kind).sort()).toEqual(["html", "pdf"]);
    expect(result.score).toBeLessThan(100);
  }, 60_000);

  it("returns completed audit data and HTML report when PDF rendering fails", async () => {
    reporterMocks.renderPdfFromHtml.mockRejectedValueOnce(
      new Error("page.pdf: Protocol error (Page.printToPDF): Printing failed")
    );
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html lang="en">
          <head><title>Audit Fixture</title></head>
          <body><main><h1>Audit Fixture</h1><img src="/missing.png"></main></body>
        </html>`);
    });
    const url = await listen(server);
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-pdf-failure",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    const result = await runScan({
      request,
      storage
    });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.reports.map((report) => report.kind)).toEqual(["html"]);
    expect(result.reportWarnings).toContain(
      "PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"
    );
  }, 60_000);

  it("does not audit a redirect from an allowed local URL to a private address", async () => {
    server = createServer((_request, response) => {
      response.writeHead(302, { location: "http://10.0.0.1/private" });
      response.end();
    });
    const url = await listen(server);
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-redirect",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    await expect(runScan({
      request,
      storage
    })).rejects.toThrow(/No pages were audited successfully/);
  }, 60_000);

  it("aborts unsafe private subresource requests while auditing the safe document", async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html lang="en">
          <head><title>Audit Fixture</title></head>
          <body>
            <main>
              <h1>Audit Fixture</h1>
              <img src="http://10.0.0.1/private.png" alt="">
            </main>
          </body>
        </html>`);
    });
    const url = await listen(server);
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-private-subresource",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    const result = await runScan({
      request,
      storage
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.errorMessage).toBeNull();
    expect(result.pages[0]?.finalUrl).toBe(url);
    expect(result.findings.some((finding) => finding.pageUrl.includes("10.0.0.1"))).toBe(false);
  }, 60_000);

  it("aborts subresource hostnames that resolve to private addresses", async () => {
    crawlerSafety.unsafeResolvedHosts.add("private.example.test");
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html lang="en">
          <head><title>Audit Fixture</title></head>
          <body>
            <main>
              <h1>Audit Fixture</h1>
              <img src="http://private.example.test/private.png" alt="">
            </main>
          </body>
        </html>`);
    });
    const url = await listen(server);
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-private-resolved-subresource",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    const result = await runScan({
      request,
      storage
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.errorMessage).toBeNull();
    expect(crawlerSafety.assertSafeResolvedUrl).toHaveBeenCalledWith(
      "http://private.example.test/private.png"
    );
  }, 60_000);

  it("fails url_list scans when no submitted URL is auditable", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-empty-list",
      projectId: "project-1",
      targetUrl: "http://10.0.0.1/",
      mode: "url_list",
      urls: ["http://10.0.0.1/"],
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    await expect(runScan({ request, storage })).rejects.toThrow(/No auditable URLs found/);
  });

  it("reuses one page screenshot artifact for multiple findings on the same page viewport", async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html lang="en">
          <head><title>Audit Fixture</title></head>
          <body>
            <main>
              <h1>Audit Fixture</h1>
              <img src="/one.png">
              <img src="/two.png">
            </main>
          </body>
        </html>`);
    });
    const url = await listen(server);
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-scan-"));
    const storage = new LocalStorageAdapter({ rootDir: tempDir });
    const request: ScanRequest = {
      runId: "run-reuse",
      projectId: "project-1",
      targetUrl: url,
      mode: "single_url",
      viewports: [DEFAULT_VIEWPORTS[0]!],
      maxPages: 1,
      maxDepth: 0,
      respectRobotsTxt: false
    };

    const result = await runScan({
      request,
      storage
    });

    expect(result.findings.length).toBeGreaterThan(1);
    const screenshotKeys = result.findings.flatMap((finding) =>
      finding.evidence
        .filter((artifact) => artifact.kind === "page_screenshot")
        .map((artifact) => artifact.artifactKey)
    );
    expect(new Set(screenshotKeys)).toHaveLength(1);
  }, 60_000);

  it("collects screenshot artifacts as data uris", async () => {
    const storage = {
      get: async (key: string) => Buffer.from(`bytes-${key}`),
      put: async () => ({ key: "", mimeType: "", sizeBytes: 0 }),
      delete: async () => undefined
    };
    const findings = [{
      evidence: [{ kind: "page_screenshot", artifactKey: "k1", mimeType: "image/png", sizeBytes: 1 }]
    }] as any;
    const map = await collectScreenshotDataUris(findings, storage as any);
    expect(map.get("k1")).toBe(`data:image/png;base64,${Buffer.from("bytes-k1").toString("base64")}`);
  });

  it("captures an element crop with a temporary highlight", async () => {
    const calls: string[] = [];
    const el = {
      evaluate: async (_fn: unknown) => { calls.push("style"); },
      boundingBox: async () => ({ x: 10, y: 20, width: 100, height: 30 })
    };
    const page = {
      screenshot: async (_opts: unknown) => Buffer.from("png"),
      viewportSize: () => ({ width: 1440, height: 900 })
    };
    const storage = {
      put: async (k: string) => ({ key: k, mimeType: "image/png", sizeBytes: 3 }),
      get: async () => Buffer.from(""),
      delete: async () => undefined
    };

    const artifact = await captureElementCropEvidence({
      runId: "r1", page: page as any, element: el as any, fingerprint: "fp", storage: storage as any
    });
    expect(artifact?.kind).toBe("element_screenshot");
    expect(calls.filter((c) => c === "style").length).toBeGreaterThanOrEqual(2); // outline set + cleared
  });
});
