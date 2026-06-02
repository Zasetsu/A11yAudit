import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "./app.js";
import { createDb, initializeDb } from "./db/client.js";
import { findings, issues, projects, reports, scanRuns } from "./db/schema.js";

const { runScanMock } = vi.hoisted(() => ({
  runScanMock: vi.fn()
}));

vi.mock("@a11yaudit/audit", () => ({
  runScan: runScanMock
}));

async function withTempDb<T>(run: (dbPath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "a11yaudit-server-"));
  try {
    return await run(join(dir, "a11yaudit.db"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function waitForCompletedScan(app: Awaited<ReturnType<typeof buildServer>>, scanId: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastStatus = "queued";

  while (Date.now() < deadline) {
    const response = await app.inject({ method: "GET", url: "/api/scans" });
    const scan = response.json().data.find((row: { id: string }) => row.id === scanId);
    lastStatus = scan?.status ?? "missing";

    if (lastStatus === "completed") return;
    if (lastStatus === "failed") {
      throw new Error(`Scan failed: ${scan.errorMessage}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for scan completion, last status: ${lastStatus}`);
}

async function waitForScan(
  app: Awaited<ReturnType<typeof buildServer>>,
  scanId: string,
  terminalStatus: "completed" | "failed"
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 30_000;
  let lastScan: Record<string, unknown> | undefined;

  while (Date.now() < deadline) {
    const response = await app.inject({ method: "GET", url: "/api/scans" });
    lastScan = response.json().data.find((row: { id: string }) => row.id === scanId);

    if (lastScan?.status === terminalStatus) return lastScan;

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for scan ${scanId} to reach ${terminalStatus}, last status: ${String(lastScan?.status)}`);
}

function mockCompletedScan(): void {
  runScanMock.mockImplementation(async ({ request, storage }: {
    request: { runId: string; projectId: string | null; targetUrl: string };
    storage: { put: (key: string, body: Buffer, mimeType: string) => Promise<{ key: string; mimeType: string; sizeBytes: number }> };
  }) => {
    const html = await storage.put(`runs/${request.runId}/report/audit-report.html`, Buffer.from("<html></html>"), "text/html");
    const pdf = await storage.put(`runs/${request.runId}/report/audit-report.pdf`, Buffer.from("%PDF-1.4\n"), "application/pdf");

    const screenshot = await storage.put(`runs/${request.runId}/screenshot/page.png`, Buffer.from("png"), "image/png");
    const snippet = await storage.put(`runs/${request.runId}/snippet/node.txt`, Buffer.from("<img>"), "text/plain");

    return {
      runId: request.runId,
      projectId: request.projectId,
      targetUrl: request.targetUrl,
      mode: "single_url",
      pages: [{ url: request.targetUrl, normalizedUrl: request.targetUrl, title: "Fixture", viewport: "desktop", statusCode: 200, finalUrl: request.targetUrl, durationMs: 1, errorMessage: null }],
      findings: [{
        id: "finding-image-alt",
        pageUrl: request.targetUrl,
        viewport: "desktop",
        selector: "img",
        htmlSnippet: "<img>",
        visibleText: null,
        helpUrl: null,
        fingerprint: "fingerprint-image-alt",
        evidence: [
          { kind: "page_screenshot", artifactKey: screenshot.key, mimeType: screenshot.mimeType, sizeBytes: screenshot.sizeBytes },
          { kind: "html_snippet", artifactKey: snippet.key, mimeType: snippet.mimeType, sizeBytes: snippet.sizeBytes }
        ],
        instances: 1,
        title: "Image missing alternative text",
        severity: "serious",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "content",
        wcagCriteria: ["1.1.1"],
        ruleId: "image-alt",
        description: "Image elements must have alternate text.",
        recommendation: "Add alt text."
      }],
      reports: [
        { kind: "html", artifactKey: html.key, mimeType: html.mimeType, sizeBytes: html.sizeBytes },
        { kind: "pdf", artifactKey: pdf.key, mimeType: pdf.mimeType, sizeBytes: pdf.sizeBytes }
      ],
      score: 75,
      startedAt: "2026-05-31T00:00:00.000Z",
      finishedAt: "2026-05-31T00:00:01.000Z"
    };
  });
}

function mockCompletedScanWithReportWarning(): void {
  runScanMock.mockImplementation(async ({ request, storage }: {
    request: { runId: string; projectId: string | null; targetUrl: string };
    storage: { put: (key: string, body: Buffer, mimeType: string) => Promise<{ key: string; mimeType: string; sizeBytes: number }> };
  }) => {
    const html = await storage.put(`runs/${request.runId}/report/audit-report.html`, Buffer.from("<html></html>"), "text/html");

    return {
      runId: request.runId,
      projectId: request.projectId,
      targetUrl: request.targetUrl,
      mode: "single_url",
      pages: [{ url: request.targetUrl, normalizedUrl: request.targetUrl, title: "Fixture", viewport: "desktop", statusCode: 200, finalUrl: request.targetUrl, durationMs: 1, errorMessage: null }],
      findings: [{
        id: "finding-image-alt",
        pageUrl: request.targetUrl,
        viewport: "desktop",
        selector: "img",
        htmlSnippet: "<img>",
        visibleText: null,
        helpUrl: null,
        fingerprint: "fingerprint-image-alt",
        evidence: [],
        instances: 1,
        title: "Image missing alternative text",
        severity: "serious",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "content",
        wcagCriteria: ["1.1.1"],
        ruleId: "image-alt",
        description: "Image elements must have alternate text.",
        recommendation: "Add alt text."
      }],
      reports: [
        { kind: "html", artifactKey: html.key, mimeType: html.mimeType, sizeBytes: html.sizeBytes }
      ],
      reportWarnings: [
        "PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"
      ],
      score: 75,
      startedAt: "2026-05-31T00:00:00.000Z",
      finishedAt: "2026-05-31T00:00:01.000Z"
    };
  });
}

function mockLargeCompletedScan(count: number): void {
  runScanMock.mockImplementation(async ({ request, storage }: {
    request: { runId: string; projectId: string | null; targetUrl: string };
    storage: { put: (key: string, body: Buffer, mimeType: string) => Promise<{ key: string; mimeType: string; sizeBytes: number }> };
  }) => {
    const html = await storage.put(`runs/${request.runId}/report/audit-report.html`, Buffer.from("<html></html>"), "text/html");
    const pdf = await storage.put(`runs/${request.runId}/report/audit-report.pdf`, Buffer.from("%PDF-1.4\n"), "application/pdf");

    return {
      runId: request.runId,
      projectId: request.projectId,
      targetUrl: request.targetUrl,
      mode: "same_domain_crawl",
      pages: Array.from({ length: 102 }, (_, index) => ({
        url: `${request.targetUrl}/page-${index}`,
        normalizedUrl: `${request.targetUrl}/page-${index}`,
        title: `Fixture ${index}`,
        viewport: index % 2 === 0 ? "desktop" : "mobile",
        statusCode: 200,
        finalUrl: `${request.targetUrl}/page-${index}`,
        durationMs: 1,
        errorMessage: null
      })),
      findings: Array.from({ length: count }, (_, index) => ({
        id: `finding-${index}`,
        pageUrl: request.targetUrl,
        viewport: index % 2 === 0 ? "desktop" : "mobile",
        selector: `.node-${index}`,
        htmlSnippet: "<button></button>",
        visibleText: null,
        helpUrl: null,
        fingerprint: `fingerprint-${index}`,
        evidence: [],
        instances: 1,
        title: "Buttons must have discernible text",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "component",
        wcagCriteria: ["4.1.2"],
        ruleId: "button-name",
        description: "Buttons must have discernible text.",
        recommendation: "Add an accessible name."
      })),
      reports: [
        { kind: "html", artifactKey: html.key, mimeType: html.mimeType, sizeBytes: html.sizeBytes },
        { kind: "pdf", artifactKey: pdf.key, mimeType: pdf.mimeType, sizeBytes: pdf.sizeBytes }
      ],
      score: 0,
      startedAt: "2026-05-31T00:00:00.000Z",
      finishedAt: "2026-05-31T00:00:01.000Z"
    };
  });
}

function mockGroupedIssueCompletedScan(): void {
  runScanMock.mockImplementation(async ({ request }: {
    request: { runId: string; projectId: string | null; targetUrl: string };
  }) => ({
    runId: request.runId,
    projectId: request.projectId,
    targetUrl: request.targetUrl,
    mode: "single_url",
    pages: [
      {
        url: request.targetUrl,
        normalizedUrl: request.targetUrl,
        title: "Fixture",
        viewport: "desktop",
        statusCode: 200,
        finalUrl: request.targetUrl,
        durationMs: 1,
        errorMessage: null
      },
      {
        url: request.targetUrl,
        normalizedUrl: request.targetUrl,
        title: "Fixture",
        viewport: "mobile",
        statusCode: 200,
        finalUrl: request.targetUrl,
        durationMs: 1,
        errorMessage: null
      }
    ],
    findings: [
      {
        id: "occurrence-desktop",
        pageUrl: request.targetUrl,
        viewport: "desktop",
        selector: "aside .elementor-widget-button a",
        htmlSnippet: '<aside><div class="elementor-widget-button"><a></a></div></aside>',
        visibleText: null,
        helpUrl: null,
        fingerprint: "raw-1",
        evidence: [],
        instances: 1,
        title: "Buttons must have discernible text",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "component",
        wcagCriteria: ["4.1.2"],
        ruleId: "button-name",
        description: "Buttons must have discernible text.",
        recommendation: "Add an accessible name."
      },
      {
        id: "occurrence-mobile",
        pageUrl: request.targetUrl,
        viewport: "mobile",
        selector: "aside .elementor-widget-button a",
        htmlSnippet: '<aside><div class="elementor-widget-button"><a></a></div></aside>',
        visibleText: null,
        helpUrl: null,
        fingerprint: "raw-2",
        evidence: [],
        instances: 1,
        title: "Buttons must have discernible text",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "component",
        wcagCriteria: ["4.1.2"],
        ruleId: "button-name",
        description: "Buttons must have discernible text.",
        recommendation: "Add an accessible name."
      }
    ],
    reports: [],
    score: 50,
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:00:01.000Z"
  }));
}

function issueFixture(overrides: Partial<typeof issues.$inferInsert> = {}): typeof issues.$inferInsert {
  return {
    id: "issue-fixture",
    projectId: "project-fixture",
    scanRunId: "run-fixture",
    issueKey: "axe:image-alt:img",
    title: "Image missing alternative text",
    severity: "serious",
    source: "axe",
    certainty: "automatic_violation",
    ruleId: "image-alt",
    wcagCriteria: "1.1.1",
    description: "Image elements must have alternate text.",
    recommendation: "Add alt text.",
    likelyScope: "single page",
    urlScopeGroup: "single page",
    componentArea: "content",
    cmsHint: "Unknown",
    confidence: "high",
    affectedPages: 1,
    occurrences: 1,
    viewportSummary: "desktop",
    representativeUrl: "https://fixture.example.com",
    representativeSelector: "img",
    representativeHtmlSnippet: "<img>",
    sampleUrls: JSON.stringify(["https://fixture.example.com"]),
    createdAt: "2026-05-31T00:00:01.000Z",
    ...overrides
  };
}

afterEach(() => {
  runScanMock.mockReset();
});

describe("server", () => {
  it("returns health without requiring a network listener", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const response = await app.inject({ method: "GET", url: "/health" });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ ok: true, name: "A11yAudit", version: "0.1.0" });
      } finally {
        await app.close();
      }
    });
  });

  it("allows the local web UI origin", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const response = await app.inject({
          headers: { origin: "http://localhost:5173" },
          method: "OPTIONS",
          url: "/api/projects"
        });

        expect(response.statusCode).toBe(204);
        expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
        expect(response.headers["access-control-allow-methods"]).toBe("GET,POST,OPTIONS");
      } finally {
        await app.close();
      }
    });
  });

  it("initializes SaaS auth and workspace tables", async () => {
    await withTempDb(async (dbPath) => {
      const dbClient = createDb(dbPath);
      initializeDb(dbClient.sqlite);
      const rows = dbClient.sqlite.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>;
      const names = rows.map((row) => row.name);
      expect(names).toContain("users");
      expect(names).toContain("workspaces");
      expect(names).toContain("workspace_members");
      expect(names).toContain("workspace_invitations");
      expect(names).toContain("sessions");
      dbClient.close();
    });
  });

  it("persists created projects and returns them in list order", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const created = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "City Services",
            url: "https://services.example.gov/accessibility"
          }
        });

        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          name: "City Services",
          domain: "services.example.gov"
        });

        const listed = await app.inject({ method: "GET", url: "/api/projects" });

        expect(listed.statusCode).toBe(200);
        expect(listed.json().data).toMatchObject([
          {
            id: created.json().id,
            name: "City Services",
            domain: "services.example.gov",
            openFindings: 0,
            lastScan: null
          }
        ]);
      } finally {
        await app.close();
      }
    });
  });

  it("validates scan creation input before persisting a queued run", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const project = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "Portal",
            url: "https://portal.example.gov"
          }
        });

        const invalid = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: project.json().id,
            url: "ftp://portal.example.gov"
          }
        });

        expect(invalid.statusCode).toBe(400);

        const created = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: project.json().id,
            url: "https://portal.example.gov/start",
            mode: "same_domain_crawl",
            maxPages: 75,
            maxDepth: 3,
            viewports: ["desktop"]
          }
        });

        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          projectId: project.json().id,
          url: "https://portal.example.gov/start",
          status: "queued",
          mode: "same_domain_crawl",
          maxPages: 75,
          maxDepth: 3,
          viewports: "desktop"
        });

        const listed = await app.inject({ method: "GET", url: "/api/scans" });
        expect(listed.json().data).toHaveLength(1);
        expect(listed.json().data[0]).toMatchObject({
          projectName: "Portal",
          maxPages: 75,
          maxDepth: 3,
          viewports: "desktop"
        });
      } finally {
        await app.close();
      }
    });
  });

  it("rejects unsafe private project targets", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath });
      try {
        const targets = [
          { url: "http://localhost:3000" },
          { url: "http://127.0.0.1" },
          { url: "http://192.168.1.10" },
          { url: "http://169.254.169.254/latest/meta-data" },
          { url: "http://[::1]" },
          { domain: "10.0.0.5" }
        ];

        for (const payload of targets) {
          const response = await app.inject({
            method: "POST",
            url: "/api/projects",
            payload
          });

          expect(response.statusCode).toBe(400);
        }

        const listed = await app.inject({ method: "GET", url: "/api/projects" });
        expect(listed.json().data).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects unsafe private scan targets before queueing", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath });
      try {
        const project = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "Portal",
            url: "https://portal.example.gov"
          }
        });

        const targets = [
          "http://localhost:3000",
          "http://127.0.0.1",
          "http://192.168.1.10",
          "http://169.254.169.254/latest/meta-data",
          "http://[::1]"
        ];

        for (const url of targets) {
          const response = await app.inject({
            method: "POST",
            url: "/api/scans",
            payload: {
              projectId: project.json().id,
              url
            }
          });

          expect(response.statusCode).toBe(400);
        }

        const listed = await app.inject({ method: "GET", url: "/api/scans" });
        expect(listed.json().data).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });

  it("counts grouped issues from the latest completed scan in project summaries", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Portal",
          url: "https://portal.example.gov"
        }
      });

      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://portal.example.gov/start"
        }
      });

      const now = new Date().toISOString();
      dbClient.sqlite.prepare("UPDATE scan_runs SET status = ?, created_at = ? WHERE id = ?").run("completed", now, scan.json().id);
      dbClient.db.insert(issues).values([
        issueFixture({
          id: "issue-new",
          projectId: project.json().id,
          scanRunId: scan.json().id,
          createdAt: now
        }),
        issueFixture({
          id: "issue-second",
          projectId: project.json().id,
          scanRunId: scan.json().id,
          issueKey: "axe:button-name:button",
          title: "Buttons must have discernible text",
          ruleId: "button-name",
          createdAt: now
        })
      ]).run();

      const listed = await app.inject({ method: "GET", url: "/api/projects" });
      expect(listed.json().data[0].openFindings).toBe(2);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("marks persisted active scans as failed when the server restarts without a worker", async () => {
    const dbClient = createDb(":memory:");
    initializeInterruptedFixture(dbClient);

    const app = await buildServer({ dbClient, executeScans: false });
    try {
      const response = await app.inject({ method: "GET", url: "/api/scans" });

      expect(response.json().data).toMatchObject([
        {
          id: "run-interrupted",
          status: "failed",
          errorMessage: "Scan interrupted before completion"
        }
      ]);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  function initializeInterruptedFixture(dbClient: ReturnType<typeof createDb>): void {
    initializeDb(dbClient.sqlite);
    const now = new Date().toISOString();
    dbClient.db.insert(projects).values({
      id: "project-interrupted",
      workspaceId: "default-workspace",
      name: "Interrupted",
      url: "https://interrupted.example.gov",
      domain: "interrupted.example.gov",
      createdAt: now
    }).run();
    dbClient.db.insert(scanRuns).values({
      id: "run-interrupted",
      projectId: "project-interrupted",
      url: "https://interrupted.example.gov",
      status: "queued",
      mode: "single_url",
      maxPages: 1,
      maxDepth: 0,
      viewports: "desktop",
      pagesQueued: 0,
      pagesScanned: 0,
      findingsTotal: 0,
      score: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      errorMessage: null
    }).run();
  }

  it("executes queued scans and persists findings and downloadable reports", async () => {
    await withTempDb(async (dbPath) => {
      mockCompletedScan();
      const app = await buildServer({
        dbPath,
        storageRoot: join(dbPath, "..", "artifacts")
      });
      try {
        const project = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "Fixture",
            url: "https://fixture.example.com"
          }
        });

        expect(project.statusCode).toBe(201);

        const scan = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: project.json().id,
            url: "https://fixture.example.com",
            mode: "single_url",
            maxPages: 1,
            viewports: ["desktop"]
          }
        });

        expect(scan.statusCode).toBe(201);
        await waitForCompletedScan(app, scan.json().id);

        const findingsResponse = await app.inject({
          method: "GET",
          url: `/api/findings?scanRunId=${scan.json().id}`
        });
        expect(findingsResponse.statusCode).toBe(200);
        expect(findingsResponse.json().data.length).toBeGreaterThan(0);
        expect(JSON.parse(findingsResponse.json().data[0].evidence)).toMatchObject([
          { kind: "page_screenshot", mimeType: "image/png" },
          { kind: "html_snippet", mimeType: "text/plain" }
        ]);

        const reportsResponse = await app.inject({
          method: "GET",
          url: `/api/reports?scanRunId=${scan.json().id}`
        });
        expect(reportsResponse.statusCode).toBe(200);
        const pdfReport = reportsResponse.json().data.find((report: { kind: string }) => report.kind === "pdf");
        expect(pdfReport).toBeDefined();

        const download = await app.inject({
          method: "GET",
          url: `/api/reports/${pdfReport.id}/download`
        });
        expect(download.statusCode).toBe(200);
        expect(download.headers["content-type"]).toContain("application/pdf");

        const screenshotKey = JSON.parse(findingsResponse.json().data[0].evidence)[0].artifactKey;
        const screenshotDownload = await app.inject({
          method: "GET",
          url: `/api/artifacts/download?key=${encodeURIComponent(screenshotKey)}`
        });
        expect(screenshotDownload.statusCode).toBe(200);
        expect(screenshotDownload.headers["content-type"]).toContain("image/png");
      } finally {
        await app.close();
      }
    });
  });

  it("completes scans with report warnings and persists only generated reports", async () => {
    await withTempDb(async (dbPath) => {
      mockCompletedScanWithReportWarning();
      const app = await buildServer({
        dbPath,
        storageRoot: join(dbPath, "..", "artifacts")
      });
      try {
        const project = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "Fixture",
            url: "https://fixture.example.com"
          }
        });
        const scan = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: project.json().id,
            url: "https://fixture.example.com",
            mode: "single_url",
            maxPages: 1,
            viewports: ["desktop"]
          }
        });

        const completedScan = await waitForScan(app, scan.json().id, "completed");

        expect(completedScan.errorMessage).toContain(
          "PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"
        );

        const reportsResponse = await app.inject({
          method: "GET",
          url: `/api/reports?scanRunId=${scan.json().id}`
        });
        expect(reportsResponse.statusCode).toBe(200);
        expect(reportsResponse.json().data.map((report: { kind: string }) => report.kind)).toEqual(["html"]);
      } finally {
        await app.close();
      }
    });
  });

  it("persists grouped issues separately from raw finding occurrences", async () => {
    const dbClient = createDb(":memory:");
    mockGroupedIssueCompletedScan();
    const app = await buildServer({ dbClient });

    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Grouped Fixture",
          url: "https://grouped.example.com"
        }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://grouped.example.com/page",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop", "mobile"]
        }
      });

      await waitForCompletedScan(app, scan.json().id);

      const issueRows = dbClient.sqlite
        .prepare("SELECT * FROM issues WHERE scan_run_id = ?")
        .all(scan.json().id) as Array<Record<string, unknown>>;
      const findingRows = dbClient.sqlite
        .prepare("SELECT * FROM findings WHERE scan_run_id = ? ORDER BY fingerprint")
        .all(scan.json().id) as Array<Record<string, unknown>>;

      expect(issueRows).toHaveLength(1);
      expect(findingRows).toHaveLength(2);
      expect(issueRows[0]).toMatchObject({
        likely_scope: "single page",
        component_area: "aside",
        cms_hint: "Elementor widget button",
        affected_pages: 1,
        occurrences: 2,
        viewport_summary: "desktop,mobile"
      });
      expect(findingRows.map((finding) => finding.issue_id)).toEqual([issueRows[0]?.id, issueRows[0]?.id]);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns grouped issues with parsed sample URLs", async () => {
    await withTempDb(async (dbPath) => {
      mockCompletedScan();
      const app = await buildServer({
        dbPath,
        storageRoot: join(dbPath, "..", "artifacts")
      });

      try {
        const project = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "Fixture",
            url: "https://fixture.example.com"
          }
        });
        const scan = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: project.json().id,
            url: "https://fixture.example.com",
            mode: "single_url",
            maxPages: 1,
            viewports: ["desktop"]
          }
        });

        await waitForCompletedScan(app, scan.json().id);

        const response = await app.inject({
          method: "GET",
          url: `/api/issues?scanRunId=${scan.json().id}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data[0]).toMatchObject({
          scanRunId: scan.json().id,
          affectedPages: 1,
          occurrences: 1
        });
        expect(response.json().data[0].sampleUrls).toEqual(expect.any(Array));
      } finally {
        await app.close();
      }
    });
  });

  it("rejects unfiltered grouped issue requests", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: "Issue query requires a projectId or scanRunId filter" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("applies project filters for grouped issues", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const projectA = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project A",
          url: "https://project-a.example.com"
        }
      });
      const projectB = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project B",
          url: "https://project-b.example.com"
        }
      });
      const scanA = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: projectA.json().id,
          url: "https://project-a.example.com"
        }
      });
      const scanB = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: projectB.json().id,
          url: "https://project-b.example.com"
        }
      });

      dbClient.db.insert(issues).values([
        issueFixture({
          id: "issue-project-a",
          projectId: projectA.json().id,
          scanRunId: scanA.json().id,
          representativeUrl: "https://project-a.example.com",
          sampleUrls: JSON.stringify(["https://project-a.example.com"])
        }),
        issueFixture({
          id: "issue-project-b",
          projectId: projectB.json().id,
          scanRunId: scanB.json().id,
          representativeUrl: "https://project-b.example.com",
          sampleUrls: JSON.stringify(["https://project-b.example.com"])
        })
      ]).run();

      const response = await app.inject({
        method: "GET",
        url: `/api/issues?projectId=${projectA.json().id}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0]).toMatchObject({
        id: "issue-project-a",
        projectId: projectA.json().id
      });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("applies project and scan filters together for grouped issues", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const projectA = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project A",
          url: "https://project-a.example.com"
        }
      });
      const projectB = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project B",
          url: "https://project-b.example.com"
        }
      });
      const scanB = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: projectB.json().id,
          url: "https://project-b.example.com"
        }
      });

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-project-b",
        projectId: projectB.json().id,
        scanRunId: scanB.json().id,
        representativeUrl: "https://project-b.example.com",
        sampleUrls: JSON.stringify(["https://project-b.example.com"])
      })).run();

      const response = await app.inject({
        method: "GET",
        url: `/api/issues?projectId=${projectA.json().id}&scanRunId=${scanB.json().id}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([]);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("defaults malformed stored issue sample URLs to an empty array", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Malformed Fixture",
          url: "https://malformed.example.com"
        }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://malformed.example.com"
        }
      });

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-malformed-sample-urls",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        sampleUrls: "not-json"
      })).run();

      const listed = await app.inject({
        method: "GET",
        url: `/api/issues?scanRunId=${scan.json().id}`
      });
      const detail = await app.inject({
        method: "GET",
        url: "/api/issues/issue-malformed-sample-urls"
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json().data[0].sampleUrls).toEqual([]);
      expect(detail.statusCode).toBe(200);
      expect(detail.json().sampleUrls).toEqual([]);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("persists large scan results in chunks instead of failing SQLite variable limits", async () => {
    await withTempDb(async (dbPath) => {
      mockLargeCompletedScan(4200);
      const app = await buildServer({
        dbPath,
        storageRoot: join(dbPath, "..", "artifacts")
      });
      try {
        const project = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: {
            name: "Large Fixture",
            url: "https://large.example.com"
          }
        });
        const scan = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: project.json().id,
            url: "https://large.example.com",
            mode: "same_domain_crawl",
            maxPages: 250,
            viewports: ["desktop", "mobile"]
          }
        });

        await waitForCompletedScan(app, scan.json().id);

        const listed = await app.inject({ method: "GET", url: "/api/scans" });
        const completed = listed.json().data.find((row: { id: string }) => row.id === scan.json().id);
        expect(completed).toMatchObject({
          status: "completed",
          findingsTotal: 4200,
          errorMessage: null
        });
      } finally {
        await app.close();
      }
    });
  });

  it("does not download artifacts that are not referenced by reports or finding evidence", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({
      dbClient,
      executeScans: false,
      storageRoot: join(tmpdir(), "a11yaudit-unreferenced-artifacts")
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/artifacts/download?key=${encodeURIComponent("runs/run-1/screenshot/unreferenced.png")}`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Artifact not found" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns 404 when a report row exists but the artifact is missing", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({
      dbClient,
      executeScans: false,
      storageRoot: join(tmpdir(), "a11yaudit-missing-artifact")
    });

    try {
      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Portal",
          url: "https://portal.example.gov"
        }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://portal.example.gov/start"
        }
      });

      dbClient.db.insert(reports).values({
        id: "report-missing-artifact",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        kind: "pdf",
        artifactKey: "missing/report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        createdAt: new Date().toISOString()
      }).run();

      const response = await app.inject({
        method: "GET",
        url: "/api/reports/report-missing-artifact/download"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Report artifact not found" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("rolls back completion persistence when report insertion fails", async () => {
    const dbClient = createDb(":memory:");
    mockCompletedScan();
    const app = await buildServer({
      dbClient,
      storageRoot: join(tmpdir(), "a11yaudit-rollback-artifacts")
    });

    try {
      dbClient.sqlite.exec(`
        CREATE TRIGGER fail_report_insert
        BEFORE INSERT ON reports
        BEGIN
          SELECT RAISE(FAIL, 'report insert failed');
        END;
      `);

      const project = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Fixture",
          url: "https://fixture.example.com"
        }
      });
      const scan = await app.inject({
        method: "POST",
        url: "/api/scans",
        payload: {
          projectId: project.json().id,
          url: "https://fixture.example.com",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop"]
        }
      });

      const failedScan = await waitForScan(app, scan.json().id, "failed");

      expect(failedScan.errorMessage).toContain("report insert failed");
      expect(dbClient.db.select().from(findings).all()).toHaveLength(0);
      expect(dbClient.db.select().from(reports).all()).toHaveLength(0);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("does not listen as a side effect when imported", async () => {
    expect(typeof buildServer).toBe("function");
  });
});
