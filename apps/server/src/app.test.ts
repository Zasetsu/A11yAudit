import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer, readServerDbPath } from "./app.js";
import { csrfCookieName, sessionCookieName } from "./auth/cookies.js";
import { createSession } from "./auth/session.js";
import { hashToken } from "./auth/tokens.js";
import { createDb, initializeDb } from "./db/client.js";
import { findings, issues, projects, reports, scanRuns, sessions, users, workspaceInvitations, workspaceMembers } from "./db/schema.js";
import { LocalJobRunner } from "./jobs/local-job-runner.js";

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

async function waitForCompletedScan(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  scanId: string,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastStatus = "queued";

  while (Date.now() < deadline) {
    const response = await listScans(app, signedIn, workspaceSlug);
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
  signedIn: SignedInResponse,
  scanId: string,
  terminalStatus: "completed" | "failed",
  workspaceSlug = primaryWorkspaceSlug(signedIn)
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 30_000;
  let lastScan: Record<string, unknown> | undefined;

  while (Date.now() < deadline) {
    const response = await listScans(app, signedIn, workspaceSlug);
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

function setCookieHeaders(response: { headers: Record<string, string | string[] | undefined> }): string[] {
  const setCookie = response.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie : setCookie === undefined ? [] : [setCookie];
}

function cookieValue(response: { headers: Record<string, string | string[] | undefined> }, name: string): string {
  const header = setCookieHeaders(response).find((cookie) => cookie.startsWith(`${name}=`));
  if (!header) {
    throw new Error(`Missing ${name} cookie`);
  }

  const [pair] = header.split(";");
  const [, value] = pair.split("=");
  return decodeURIComponent(value ?? "");
}

async function signup(
  app: Awaited<ReturnType<typeof buildServer>>,
  email: string,
  workspaceName: string,
  password = "password12345"
) {
  return app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: {
      fullName: "Owner",
      email,
      password,
      workspaceName
    }
  });
}

async function signupWithPublicSignup(
  app: Awaited<ReturnType<typeof buildServer>>,
  email: string,
  workspaceName: string,
  password = "password12345"
) {
  const originalPublicSignups = process.env.A11YAUDIT_PUBLIC_SIGNUPS;
  process.env.A11YAUDIT_PUBLIC_SIGNUPS = "true";
  try {
    return await signup(app, email, workspaceName, password);
  } finally {
    if (originalPublicSignups === undefined) {
      delete process.env.A11YAUDIT_PUBLIC_SIGNUPS;
    } else {
      process.env.A11YAUDIT_PUBLIC_SIGNUPS = originalPublicSignups;
    }
  }
}

function authCookies(response: { headers: Record<string, string | string[] | undefined> }): Record<string, string> {
  return {
    [sessionCookieName]: cookieValue(response, sessionCookieName),
    [csrfCookieName]: cookieValue(response, csrfCookieName)
  };
}

async function createWorkspaceInvite(
  app: Awaited<ReturnType<typeof buildServer>>,
  cookies: Record<string, string>,
  workspaceSlug: string,
  email: string
) {
  return app.inject({
    method: "POST",
    url: `/api/workspaces/${workspaceSlug}/invitations`,
    headers: { "x-csrf-token": cookies[csrfCookieName] },
    cookies,
    payload: { email }
  });
}

async function addWorkspaceMember(
  app: Awaited<ReturnType<typeof buildServer>>,
  ownerCookies: Record<string, string>,
  workspaceSlug: string,
  email: string,
  password = "password12345"
) {
  const invite = await createWorkspaceInvite(app, ownerCookies, workspaceSlug, email);
  const token = invite.json().data.inviteUrl.replace("/invite/", "");
  const accepted = await app.inject({
    method: "POST",
    url: `/api/invitations/${token}/accept`,
    payload: { fullName: "Member", email, password }
  });
  return {
    accepted,
    cookies: authCookies(accepted),
    userId: accepted.json().data.user.id as string
  };
}

interface SignedInResponse {
  headers: Record<string, string | string[] | undefined>;
  json: () => { data: { workspaces: Array<{ slug: string }> } };
}

function primaryWorkspaceSlug(response: SignedInResponse): string {
  const slug = response.json().data.workspaces[0]?.slug;
  if (!slug) {
    throw new Error("Missing primary workspace slug");
  }

  return slug;
}

async function createProject(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  name: string,
  url: string,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  const cookies = authCookies(signedIn);

  return app.inject({
    method: "POST",
    url: `/api/workspaces/${workspaceSlug}/projects`,
    headers: { "x-csrf-token": cookies[csrfCookieName] },
    cookies,
    payload: { name, url }
  });
}

async function createProjectWithPayload(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  payload: { name?: string; url?: string; domain?: string },
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  const cookies = authCookies(signedIn);

  return app.inject({
    method: "POST",
    url: `/api/workspaces/${workspaceSlug}/projects`,
    headers: { "x-csrf-token": cookies[csrfCookieName] },
    cookies,
    payload
  });
}

async function listProjects(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/projects`,
    cookies: authCookies(signedIn)
  });
}

async function deleteProject(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  projectId: string,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  const cookies = authCookies(signedIn);

  return app.inject({
    method: "DELETE",
    url: `/api/workspaces/${workspaceSlug}/projects/${projectId}`,
    headers: { "x-csrf-token": cookies[csrfCookieName] },
    cookies
  });
}

async function listScans(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/scans`,
    cookies: authCookies(signedIn)
  });
}

async function listIssues(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  query = "",
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/issues${query}`,
    cookies: authCookies(signedIn)
  });
}

async function getIssue(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  issueId: string,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/issues/${issueId}`,
    cookies: authCookies(signedIn)
  });
}

async function listFindings(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  query = "",
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/findings${query}`,
    cookies: authCookies(signedIn)
  });
}

async function listReports(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  query = "",
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/reports${query}`,
    cookies: authCookies(signedIn)
  });
}

async function downloadReport(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  reportId: string,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/reports/${reportId}/download`,
    cookies: authCookies(signedIn)
  });
}

async function downloadArtifact(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  key: string,
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  return app.inject({
    method: "GET",
    url: `/api/workspaces/${workspaceSlug}/artifacts/download?key=${encodeURIComponent(key)}`,
    cookies: authCookies(signedIn)
  });
}

async function startScan(
  app: Awaited<ReturnType<typeof buildServer>>,
  signedIn: SignedInResponse,
  projectId: string,
  payload: Partial<{
    url: string;
    mode: "single_url" | "same_domain_crawl";
    maxPages: number;
    maxDepth: number;
    viewports: Array<"desktop" | "mobile">;
  }> = {},
  workspaceSlug = primaryWorkspaceSlug(signedIn)
) {
  const cookies = authCookies(signedIn);

  return app.inject({
    method: "POST",
    url: `/api/workspaces/${workspaceSlug}/scans`,
    headers: { "x-csrf-token": cookies[csrfCookieName] },
    cookies,
    payload: {
      projectId,
      url: "https://portal.example.test/",
      ...payload
    }
  });
}

async function acceptWorkspaceInvite(
  app: Awaited<ReturnType<typeof buildServer>>,
  inviteResponse: { json: () => { data: { inviteUrl: string } } },
  email: string
) {
  const token = inviteResponse.json().data.inviteUrl.replace("/invite/", "");

  return app.inject({
    method: "POST",
    url: `/api/invitations/${token}/accept`,
    payload: {
      fullName: "Member",
      email,
      password: "password12345"
    }
  });
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

function findingFixture(overrides: Partial<typeof findings.$inferInsert> = {}): typeof findings.$inferInsert {
  return {
    id: "finding-fixture",
    projectId: "project-fixture",
    scanRunId: "run-fixture",
    issueId: null,
    pageUrl: "https://fixture.example.com",
    ruleId: "image-alt",
    title: "Image missing alternative text",
    severity: "serious",
    status: "new",
    viewport: "desktop",
    certainty: "automatic_violation",
    wcagCriteria: "1.1.1",
    selector: "img",
    description: "Image elements must have alternate text.",
    helpUrl: null,
    evidence: "[]",
    fingerprint: "fingerprint-fixture",
    instances: 1,
    createdAt: "2026-05-31T00:00:01.000Z",
    ...overrides
  };
}

function reportFixture(overrides: Partial<typeof reports.$inferInsert> = {}): typeof reports.$inferInsert {
  return {
    id: "report-fixture",
    projectId: "project-fixture",
    scanRunId: "run-fixture",
    kind: "pdf",
    artifactKey: "runs/run-fixture/report/audit-report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    createdAt: "2026-05-31T00:00:01.000Z",
    ...overrides
  };
}

async function writeStoredArtifact(storageRoot: string, key: string, body: Buffer | string): Promise<void> {
  const path = join(storageRoot, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

afterEach(() => {
  runScanMock.mockReset();
  vi.unstubAllEnvs();
});

describe("server", () => {
  it("reads the server database path from environment configuration", () => {
    vi.stubEnv("A11YAUDIT_DB_PATH", "/tmp/a11yaudit.db");

    expect(readServerDbPath()).toBe("/tmp/a11yaudit.db");

    vi.stubEnv("A11YAUDIT_DB_PATH", "");

    expect(readServerDbPath()).toBeUndefined();
  });

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

  it("limits local worker concurrency", async () => {
    let allowFirstToComplete!: () => void;
    const firstMayComplete = new Promise<void>((resolve) => {
      allowFirstToComplete = resolve;
    });
    const started: string[] = [];

    const runner = new LocalJobRunner<{ label: string }>({
      maxConcurrentJobs: 1,
      execute: async (job) => {
        started.push(job.id);
        if (job.id === "job-1") {
          await firstMayComplete;
        }
      }
    });

    runner.enqueue("job-1", { label: "first" });
    runner.enqueue("job-2", { label: "second" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(started).toEqual(["job-1"]);
    expect(runner.get("job-1")?.status).toBe("running");
    expect(runner.get("job-2")?.status).toBe("queued");

    allowFirstToComplete();
    await runner.waitForIdle();

    expect(started).toEqual(["job-1", "job-2"]);
    expect(runner.get("job-1")?.status).toBe("completed");
    expect(runner.get("job-2")?.status).toBe("completed");
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    0.5
  ])("normalizes invalid local worker concurrency %s", async (maxConcurrentJobs) => {
    const started: string[] = [];
    const runner = new LocalJobRunner<{ label: string }>({
      maxConcurrentJobs,
      execute: (job) => {
        started.push(job.id);
      }
    });

    runner.enqueue("job-1", { label: "fractional" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(started).toEqual(["job-1"]);
    expect(runner.get("job-1")?.status).toBe("completed");
  });

  it("continues draining queued local jobs after a failure", async () => {
    const started: string[] = [];
    const runner = new LocalJobRunner<{ label: string }>({
      maxConcurrentJobs: 1,
      execute: (job) => {
        started.push(job.id);
        if (job.id === "job-1") {
          throw new Error("first failed");
        }
      }
    });

    runner.enqueue("job-1", { label: "first" });
    runner.enqueue("job-2", { label: "second" });
    await runner.waitForIdle();

    expect(started).toEqual(["job-1", "job-2"]);
    expect(runner.get("job-1")).toMatchObject({ status: "failed", error: "first failed" });
    expect(runner.get("job-2")?.status).toBe("completed");
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
        expect(response.headers["access-control-allow-methods"]).toBe("GET,POST,PATCH,DELETE,OPTIONS");
        expect(response.headers["access-control-allow-headers"]).toContain("X-CSRF-Token");
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
      } finally {
        await app.close();
      }
    });
  });

  it("rejects unsafe authenticated requests without CSRF", async () => {
    await withTempDb(async (dbPath) => {
      const dbClient = createDb(dbPath);
      initializeDb(dbClient.sqlite);
      dbClient.db.insert(users).values({
        id: "user-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        passwordHash: "hash",
        createdAt: "2026-06-02T00:00:00.000Z"
      }).run();
      const session = createSession(dbClient.db, "user-1", new Date("2026-06-02T00:00:00.000Z"));
      dbClient.close();

      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/workspaces/default-workspace/projects",
          cookies: { [sessionCookieName]: session.sessionToken, [csrfCookieName]: session.csrfToken },
          payload: {
            name: "Portal",
            url: "https://portal.example.test/"
          }
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }

      const verificationDbClient = createDb(dbPath);
      try {
        expect(verificationDbClient.db.select().from(projects).all()).toHaveLength(0);
      } finally {
        verificationDbClient.close();
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
      expect(dbClient.sqlite.prepare("select id, name, slug from workspaces where id = ?").get("default-workspace")).toMatchObject({
        id: "default-workspace",
        name: "Default Workspace",
        slug: "default-workspace"
      });

      dbClient.sqlite
        .prepare("insert into projects (id, name, url, domain, created_at) values (?, ?, ?, ?, ?)")
        .run("project-default-workspace", "Defaulted Project", "https://default.example.com", "default.example.com", "2026-06-02T00:00:00.000Z");
      expect(dbClient.sqlite.prepare("select workspace_id from projects where id = ?").get("project-default-workspace")).toMatchObject({
        workspace_id: "default-workspace"
      });
      const insertScan = dbClient.sqlite.prepare(`
        insert into scan_runs (
          id, project_id, url, status, mode, max_pages, max_depth, viewports,
          pages_queued, pages_scanned, findings_total, created_at
        )
        values (?, 'project-default-workspace', 'https://default.example.com', ?, 'single_url', 1, 0, 'desktop', 0, 0, 0, ?)
      `);
      insertScan.run("run-active-1", "queued", "2026-06-02T00:00:00.000Z");
      expect(() => insertScan.run("run-active-2", "crawling", "2026-06-02T00:00:01.000Z"))
        .toThrow(/UNIQUE constraint failed/);
      dbClient.sqlite.prepare("update scan_runs set status = ? where id = ?").run("completed", "run-active-1");
      expect(() => insertScan.run("run-active-3", "queued", "2026-06-02T00:00:02.000Z")).not.toThrow();

      expect(() => dbClient.sqlite
        .prepare("insert into projects (id, workspace_id, name, url, domain, created_at) values (?, ?, ?, ?, ?, ?)")
        .run("project-missing-workspace", "missing-workspace", "Missing Workspace", "https://missing.example.com", "missing.example.com", "2026-06-02T00:00:00.000Z"))
        .toThrow(/FOREIGN KEY constraint failed/);
      expect(() => dbClient.sqlite
        .prepare("insert into projects (id, name, url, domain, created_at) values (?, ?, ?, ?, ?)")
        .run("project-duplicate-domain", "Duplicate Domain", "https://default.example.com", "default.example.com", "2026-06-02T00:00:00.000Z"))
        .toThrow(/UNIQUE constraint failed/);
      dbClient.close();
    });
  });

  it("allows first-user signup and creates an owner workspace", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/auth/signup",
          payload: {
            fullName: "Ada Lovelace",
            email: "ADA@EXAMPLE.COM ",
            password: "correct horse battery staple",
            workspaceName: "Acme Accessibility Team"
          }
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().data.user.email).toBe("ada@example.com");
        expect(response.json().data.workspaces[0]).toMatchObject({ slug: "acme-accessibility-team", role: "owner" });
        expect(response.headers["set-cookie"]).toBeDefined();
      } finally {
        await app.close();
      }
    });
  });

  it("allows only one concurrent first-user signup when public signup is disabled", async () => {
    await withTempDb(async (dbPath) => {
      const originalPublicSignups = process.env.A11YAUDIT_PUBLIC_SIGNUPS;
      delete process.env.A11YAUDIT_PUBLIC_SIGNUPS;
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const responses = await Promise.all([
          signup(app, "owner-a@example.com", "Owner A Workspace"),
          signup(app, "owner-b@example.com", "Owner B Workspace")
        ]);
        const statusCodes = responses.map((response) => response.statusCode).sort((left, right) => left - right);

        expect(statusCodes).toEqual([201, 403]);
      } finally {
        if (originalPublicSignups === undefined) {
          delete process.env.A11YAUDIT_PUBLIC_SIGNUPS;
        } else {
          process.env.A11YAUDIT_PUBLIC_SIGNUPS = originalPublicSignups;
        }
        await app.close();
      }

      const dbClient = createDb(dbPath);
      try {
        expect(dbClient.db.select().from(users).all()).toHaveLength(1);
      } finally {
        dbClient.close();
      }
    });
  });

  it("closes normal signup after first user when public signup is disabled", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "owner@example.com", "Owner Workspace");
        const response = await app.inject({
          method: "POST",
          url: "/api/auth/signup",
          payload: {
            fullName: "Member",
            email: "member@example.com",
            password: "password12345",
            workspaceName: "Member Workspace"
          }
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  it("logs in with normalized email and sets cookies", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "ada@example.com", "Ada Workspace", "correct horse battery staple");

        const response = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: " ADA@EXAMPLE.COM ",
            password: "correct horse battery staple"
          }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.user.email).toBe("ada@example.com");
        expect(response.json().data.workspaces[0]).toMatchObject({ slug: "ada-workspace", role: "owner" });
        expect(cookieValue(response, sessionCookieName)).not.toBe("");
        expect(cookieValue(response, csrfCookieName)).not.toBe("");
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${sessionCookieName}=`))).not.toContain("Domain=");
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${csrfCookieName}=`))).not.toContain("Domain=");
      } finally {
        await app.close();
      }
    });
  });

  it("sets the configured shared cookie domain on login auth cookies", async () => {
    vi.stubEnv("A11YAUDIT_COOKIE_DOMAIN", ".example.com");

    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "ada@example.com", "Ada Workspace", "correct horse battery staple");

        const response = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "ada@example.com",
            password: "correct horse battery staple"
          }
        });

        expect(response.statusCode).toBe(200);
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${sessionCookieName}=`))).toContain("Domain=.example.com");
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${csrfCookieName}=`))).toContain("Domain=.example.com");
      } finally {
        await app.close();
      }
    });
  });

  it("rejects wrong login passwords with a generic error", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "ada@example.com", "Ada Workspace", "correct horse battery staple");

        const response = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "ada@example.com",
            password: "wrong-password"
          }
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({ error: "Invalid email or password" });
      } finally {
        await app.close();
      }
    });
  });

  it("returns authenticated session workspaces", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const signedUp = await signup(app, "ada@example.com", "Ada Workspace");

        const response = await app.inject({
          method: "GET",
          url: "/api/auth/session",
          cookies: {
            [sessionCookieName]: cookieValue(signedUp, sessionCookieName),
            [csrfCookieName]: cookieValue(signedUp, csrfCookieName)
          }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data).toMatchObject({
          user: {
            fullName: "Owner",
            email: "ada@example.com"
          },
          workspaces: [
            {
              name: "Ada Workspace",
              slug: "ada-workspace",
              role: "owner"
            }
          ]
        });
      } finally {
        await app.close();
      }
    });
  });

  it("logs out with CSRF, revokes the session, and clears cookies", async () => {
    vi.stubEnv("A11YAUDIT_COOKIE_DOMAIN", ".example.com");

    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const signedUp = await signup(app, "ada@example.com", "Ada Workspace");
        const sessionToken = cookieValue(signedUp, sessionCookieName);
        const csrfToken = cookieValue(signedUp, csrfCookieName);

        const response = await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { "x-csrf-token": csrfToken },
          cookies: {
            [sessionCookieName]: sessionToken,
            [csrfCookieName]: csrfToken
          }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ data: { ok: true } });
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${sessionCookieName}=`))).toContain("Max-Age=0");
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${csrfCookieName}=`))).toContain("Max-Age=0");
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${sessionCookieName}=`))).toContain("Domain=.example.com");
        expect(setCookieHeaders(response).find((cookie) => cookie.startsWith(`${csrfCookieName}=`))).toContain("Domain=.example.com");

      } finally {
        await app.close();
      }

      const dbClient = createDb(dbPath);
      try {
        const sessionRows = dbClient.db.select().from(sessions).all();
        expect(sessionRows).toHaveLength(1);
        expect(sessionRows[0].revokedAt).not.toBeNull();
      } finally {
        dbClient.close();
      }
    });
  });

  it("allows public signup after first user when enabled", async () => {
    await withTempDb(async (dbPath) => {
      const originalPublicSignups = process.env.A11YAUDIT_PUBLIC_SIGNUPS;
      process.env.A11YAUDIT_PUBLIC_SIGNUPS = "true";
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "owner@example.com", "Owner Workspace");
        const response = await signup(app, "member@example.com", "Member Workspace");

        expect(response.statusCode).toBe(201);
        expect(response.json().data.workspaces[0]).toMatchObject({ slug: "member-workspace", role: "owner" });
      } finally {
        if (originalPublicSignups === undefined) {
          delete process.env.A11YAUDIT_PUBLIC_SIGNUPS;
        } else {
          process.env.A11YAUDIT_PUBLIC_SIGNUPS = originalPublicSignups;
        }
        await app.close();
      }
    });
  });

  it("suffixes workspace slugs on collision", async () => {
    await withTempDb(async (dbPath) => {
      const originalPublicSignups = process.env.A11YAUDIT_PUBLIC_SIGNUPS;
      process.env.A11YAUDIT_PUBLIC_SIGNUPS = "true";
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "owner@example.com", "Acme");
        const response = await signup(app, "member@example.com", "Acme");

        expect(response.statusCode).toBe(201);
        expect(response.json().data.workspaces[0]).toMatchObject({ slug: "acme-2", role: "owner" });
      } finally {
        if (originalPublicSignups === undefined) {
          delete process.env.A11YAUDIT_PUBLIC_SIGNUPS;
        } else {
          process.env.A11YAUDIT_PUBLIC_SIGNUPS = originalPublicSignups;
        }
        await app.close();
      }
    });
  });

  it("lists workspaces for the authenticated user", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces",
          cookies: authCookies(owner)
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.workspaces).toMatchObject([
          {
            name: "Owner Workspace",
            slug: "owner-workspace",
            role: "owner"
          }
        ]);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects unauthenticated workspace list and detail requests", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        await signup(app, "owner@example.com", "Owner Workspace");

        const list = await app.inject({
          method: "GET",
          url: "/api/workspaces"
        });
        const detail = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace"
        });

        expect(list.statusCode).toBe(401);
        expect(detail.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });
  });

  it("returns workspace detail with membership info", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace",
          cookies: authCookies(owner)
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.workspace).toMatchObject({
          name: "Owner Workspace",
          slug: "owner-workspace",
          role: "owner"
        });
      } finally {
        await app.close();
      }
    });
  });

  it("rejects workspace detail for non-members", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");

        const response = await app.inject({
          method: "GET",
          url: `/api/workspaces/${owner.json().data.workspaces[0].slug}`,
          cookies: authCookies(outsider)
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("lets an owner create an invite and stores only the token hash", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const cookies = authCookies(owner);
        const beforeCreate = Date.now();

        const response = await createWorkspaceInvite(app, cookies, "owner-workspace", " INVITEE@EXAMPLE.COM ");
        const afterCreate = Date.now();

        expect(response.statusCode).toBe(201);
        expect(response.json().data.invitation).toMatchObject({
          email: "invitee@example.com",
          role: "member"
        });
        const expiresAt = Date.parse(response.json().data.invitation.expiresAt);
        expect(expiresAt).toBeGreaterThanOrEqual(beforeCreate + 7 * 24 * 60 * 60 * 1000);
        expect(expiresAt).toBeLessThanOrEqual(afterCreate + 7 * 24 * 60 * 60 * 1000);
        const token = response.json().data.inviteUrl.replace("/invite/", "");
        expect(token).not.toBe("");

        const dbClient = createDb(dbPath);
        try {
          const invitations = dbClient.db.select().from(workspaceInvitations).all();
          expect(invitations).toHaveLength(1);
          expect(invitations[0].email).toBe("invitee@example.com");
          expect(invitations[0].tokenHash).toBe(hashToken(token));
          expect(invitations[0].tokenHash).not.toBe(token);
        } finally {
          dbClient.close();
        }
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invite creation with non-member roles", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const cookies = authCookies(owner);

        const response = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations",
          headers: { "x-csrf-token": cookies[csrfCookieName] },
          cookies,
          payload: { email: "invitee@example.com", role: "owner" }
        });

        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invite creation and revoke by non-members", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");
        const outsiderCookies = authCookies(outsider);
        const invite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");
        const invitationId = invite.json().data.invitation.id;

        const created = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations",
          headers: { "x-csrf-token": outsiderCookies[csrfCookieName] },
          cookies: outsiderCookies,
          payload: { email: "another@example.com" }
        });
        const revoked = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}`,
          headers: { "x-csrf-token": outsiderCookies[csrfCookieName] },
          cookies: outsiderCookies
        });

        expect(created.statusCode).toBe(404);
        expect(revoked.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invite creation by workspace members", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const invite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");
        const token = invite.json().data.inviteUrl.replace("/invite/", "");
        const accepted = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Member",
            email: "member@example.com",
            password: "password12345"
          }
        });
        const memberCookies = authCookies(accepted);

        const response = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations",
          headers: { "x-csrf-token": memberCookies[csrfCookieName] },
          cookies: memberCookies,
          payload: { email: "another@example.com" }
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invite revoke by workspace members", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const memberInvite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");
        const memberToken = memberInvite.json().data.inviteUrl.replace("/invite/", "");
        const accepted = await app.inject({
          method: "POST",
          url: `/api/invitations/${memberToken}/accept`,
          payload: {
            fullName: "Member",
            email: "member@example.com",
            password: "password12345"
          }
        });
        const memberCookies = authCookies(accepted);
        const targetInvite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "target@example.com");
        const invitationId = targetInvite.json().data.invitation.id;

        const response = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}`,
          headers: { "x-csrf-token": memberCookies[csrfCookieName] },
          cookies: memberCookies
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  it("lets an owner revoke an invite and rejects revoked invite acceptance", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const cookies = authCookies(owner);
        const invite = await createWorkspaceInvite(app, cookies, "owner-workspace", "invitee@example.com");
        const invitationId = invite.json().data.invitation.id;
        const token = invite.json().data.inviteUrl.replace("/invite/", "");

        const revoked = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}`,
          headers: { "x-csrf-token": cookies[csrfCookieName] },
          cookies
        });
        expect(revoked.statusCode).toBe(200);
        expect(revoked.json()).toEqual({ data: { ok: true } });

        const dbClient = createDb(dbPath);
        try {
          const row = dbClient.sqlite
            .prepare("select revoked_at from workspace_invitations where id = ?")
            .get(invitationId) as { revoked_at: string | null };
          expect(row.revoked_at).not.toBeNull();
        } finally {
          dbClient.close();
        }

        const accepted = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Invitee",
            email: "invitee@example.com",
            password: "password12345"
          }
        });

        expect(accepted.statusCode).toBe(410);
      } finally {
        await app.close();
      }
    });
  });

  it("accepts an invite by creating a member user and session while public signup is disabled", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const cookies = authCookies(owner);
        const invite = await createWorkspaceInvite(app, cookies, "owner-workspace", "member@example.com");
        const invitationId = invite.json().data.invitation.id;
        const token = invite.json().data.inviteUrl.replace("/invite/", "");

        const response = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Member User",
            email: " MEMBER@EXAMPLE.COM ",
            password: "password12345"
          }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.user).toMatchObject({
          fullName: "Member User",
          email: "member@example.com"
        });
        expect(response.json().data.workspaces).toMatchObject([
          {
            name: "Owner Workspace",
            slug: "owner-workspace",
            role: "member"
          }
        ]);
        expect(cookieValue(response, sessionCookieName)).not.toBe("");
        expect(cookieValue(response, csrfCookieName)).not.toBe("");

        const dbClient = createDb(dbPath);
        try {
          const row = dbClient.sqlite
            .prepare("select accepted_at from workspace_invitations where id = ?")
            .get(invitationId) as { accepted_at: string | null };
          expect(row.accepted_at).not.toBeNull();
        } finally {
          dbClient.close();
        }

        const secondAcceptance = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Member User",
            email: "member@example.com",
            password: "password12345"
          }
        });

        expect(secondAcceptance.statusCode).toBe(410);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects expired invite acceptance", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const cookies = authCookies(owner);
        const invite = await createWorkspaceInvite(app, cookies, "owner-workspace", "expired@example.com");
        const invitationId = invite.json().data.invitation.id;
        const token = invite.json().data.inviteUrl.replace("/invite/", "");

        const dbClient = createDb(dbPath);
        try {
          dbClient.sqlite
            .prepare("update workspace_invitations set expires_at = ? where id = ?")
            .run("2026-01-01T00:00:00.000Z", invitationId);
        } finally {
          dbClient.close();
        }

        const response = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Expired User",
            email: "expired@example.com",
            password: "password12345"
          }
        });

        expect(response.statusCode).toBe(410);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invite acceptance with a mismatched email", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const cookies = authCookies(owner);
        const invite = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations",
          headers: { "x-csrf-token": cookies[csrfCookieName] },
          cookies,
          payload: { email: "member@example.com" }
        });
        const token = invite.json().data.inviteUrl.replace("/invite/", "");

        const response = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Wrong User",
            email: "wrong@example.com",
            password: "password12345"
          }
        });

        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  it("accepts an invite for an existing user after password verification", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        await signupWithPublicSignup(app, "existing@example.com", "Existing Workspace", "correct horse battery staple");
        const cookies = authCookies(owner);
        const invite = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations",
          headers: { "x-csrf-token": cookies[csrfCookieName] },
          cookies,
          payload: { email: "existing@example.com" }
        });
        const token = invite.json().data.inviteUrl.replace("/invite/", "");

        const wrongPassword = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Existing User",
            email: "existing@example.com",
            password: "wrong-password"
          }
        });
        expect(wrongPassword.statusCode).toBe(401);

        const response = await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/accept`,
          payload: {
            fullName: "Existing User",
            email: "existing@example.com",
            password: "correct horse battery staple"
          }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.user.email).toBe("existing@example.com");
        expect(response.json().data.workspaces).toEqual(expect.arrayContaining([
          expect.objectContaining({ slug: "existing-workspace", role: "owner" }),
          expect.objectContaining({ slug: "owner-workspace", role: "member" })
        ]));
        expect(cookieValue(response, sessionCookieName)).not.toBe("");
        expect(cookieValue(response, csrfCookieName)).not.toBe("");
      } finally {
        await app.close();
      }
    });
  });

  it("allows only one concurrent accept for the same invitation token", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        await signupWithPublicSignup(app, "existing@example.com", "Existing Workspace", "correct horse battery staple");
        const ownerCookies = authCookies(owner);
        const invite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "existing@example.com");
        const token = invite.json().data.inviteUrl.replace("/invite/", "");

        const responses = await Promise.all([
          app.inject({
            method: "POST",
            url: `/api/invitations/${token}/accept`,
            payload: {
              fullName: "Existing User",
              email: "existing@example.com",
              password: "correct horse battery staple"
            }
          }),
          app.inject({
            method: "POST",
            url: `/api/invitations/${token}/accept`,
            payload: {
              fullName: "Existing User",
              email: "existing@example.com",
              password: "correct horse battery staple"
            }
          })
        ]);

        expect(responses.map((response) => response.statusCode).sort((left, right) => left - right)).toEqual([200, 410]);

        const dbClient = createDb(dbPath);
        try {
          const row = dbClient.sqlite
            .prepare(`
              select count(*) as membership_count
              from users
              inner join workspace_members on workspace_members.user_id = users.id
              inner join workspaces on workspaces.id = workspace_members.workspace_id
              where users.email = ? and workspaces.slug = ?
            `)
            .get("existing@example.com", "owner-workspace") as { membership_count: number };
          expect(row.membership_count).toBe(1);
        } finally {
          dbClient.close();
        }
      } finally {
        await app.close();
      }
    });
  });

  it("rejects creating a second invite for an email that has already accepted and joined", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const firstInvite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");
        const firstToken = firstInvite.json().data.inviteUrl.replace("/invite/", "");
        const accepted = await app.inject({
          method: "POST",
          url: `/api/invitations/${firstToken}/accept`,
          payload: {
            fullName: "Member User",
            email: "member@example.com",
            password: "password12345"
          }
        });
        expect(accepted.statusCode).toBe(200);

        const secondInvite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");

        expect(secondInvite.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });

  it("persists created projects and returns them in list order", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const created = await createProject(app, owner, "City Services", "https://services.example.gov/accessibility");

        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          name: "City Services",
          domain: "services.example.gov"
        });

        const listed = await listProjects(app, owner);

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

  it("lists only projects in the authenticated workspace", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const acme = await signup(app, "acme@example.com", "Acme");
        const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
        await createProject(app, acme, "Acme Portal", "https://acme.example.test/");
        await createProject(app, beta, "Beta Portal", "https://beta.example.test/");

        const response = await listProjects(app, acme);

        expect(response.statusCode).toBe(200);
        expect(response.json().data).toHaveLength(1);
        expect(response.json().data[0].domain).toBe("acme.example.test");
      } finally {
        await app.close();
      }
    });
  });

  it("rejects unauthenticated project list, create, and delete requests", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const list = await app.inject({ method: "GET", url: "/api/workspaces/acme/projects" });
        const created = await app.inject({
          method: "POST",
          url: "/api/workspaces/acme/projects",
          payload: { url: "https://acme.example.test/" }
        });
        const deleted = await app.inject({
          method: "DELETE",
          url: "/api/workspaces/acme/projects/project-1"
        });

        expect(list.statusCode).toBe(401);
        expect(created.statusCode).toBe(401);
        expect(deleted.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 for non-member project list, create, and delete requests", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");
        const project = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");
        const outsiderCookies = authCookies(outsider);

        const list = await listProjects(app, outsider, "owner-workspace");
        const created = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/projects",
          headers: { "x-csrf-token": outsiderCookies[csrfCookieName] },
          cookies: outsiderCookies,
          payload: { url: "https://blocked.example.test/" }
        });
        const deleted = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/projects/${project.json().id}`,
          headers: { "x-csrf-token": outsiderCookies[csrfCookieName] },
          cookies: outsiderCookies
        });

        expect(list.statusCode).toBe(404);
        expect(created.statusCode).toBe(404);
        expect(deleted.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("allows workspace members to read and scan but not create projects", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const project = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");
        const invite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");
        const member = await acceptWorkspaceInvite(app, invite, "member@example.com");
        const memberCookies = authCookies(member);

        const listed = await listProjects(app, member, "owner-workspace");
        const scanned = await startScan(app, member, project.json().id, {}, "owner-workspace");
        const created = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/projects",
          headers: { "x-csrf-token": memberCookies[csrfCookieName] },
          cookies: memberCookies,
          payload: { url: "https://member-create.example.test/" }
        });
        const deleted = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/projects/${project.json().id}`,
          headers: { "x-csrf-token": memberCookies[csrfCookieName] },
          cookies: memberCookies
        });

        expect(listed.statusCode).toBe(200);
        expect(listed.json().data).toHaveLength(1);
        expect(scanned.statusCode).toBe(201);
        expect(created.statusCode).toBe(403);
        expect(deleted.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  it("allows owners to create projects in their workspace", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const created = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");

        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          name: "Owner Portal",
          domain: "owner.example.test"
        });
      } finally {
        await app.close();
      }
    });
  });

  it("allows owners to delete projects in their workspace", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const created = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");

        const deleted = await deleteProject(app, owner, created.json().id);
        const listed = await listProjects(app, owner);

        expect(deleted.statusCode).toBe(200);
        expect(deleted.json()).toEqual({ data: { ok: true } });
        expect(listed.json().data).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 when an owner deletes a project outside the authorized workspace", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const acme = await signup(app, "acme@example.com", "Acme");
        const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
        const betaProject = await createProject(app, beta, "Beta Portal", "https://beta.example.test/");

        const deleted = await deleteProject(app, acme, betaProject.json().id);

        expect(deleted.statusCode).toBe(404);
        expect((await listProjects(app, beta)).json().data).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 409 for duplicate project domains in the same workspace", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        await createProject(app, owner, "Owner Portal", "https://duplicate.example.test/a");

        const duplicate = await createProject(app, owner, "Duplicate Portal", "https://duplicate.example.test/b");

        expect(duplicate.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });

  it("allows the same project domain in different workspaces", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const acme = await signup(app, "acme@example.com", "Acme");
        const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
        const acmeProject = await createProject(app, acme, "Shared", "https://shared.example.test/a");
        const betaProject = await createProject(app, beta, "Shared", "https://shared.example.test/b");

        expect(acmeProject.statusCode).toBe(201);
        expect(betaProject.statusCode).toBe(201);
        expect((await listProjects(app, acme)).json().data).toHaveLength(1);
        expect((await listProjects(app, beta)).json().data).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  });

  it("does not expose old global project list and create routes", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const listed = await app.inject({ method: "GET", url: "/api/projects" });
        const created = await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: { url: "https://global.example.test/" }
        });

        expect(listed.statusCode).toBe(404);
        expect(created.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("validates scan creation input before persisting a queued run", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Portal", "https://portal.example.gov");

        const invalid = await startScan(app, owner, project.json().id, {
          url: "ftp://portal.example.gov"
        });

        expect(invalid.statusCode).toBe(400);

        const created = await startScan(app, owner, project.json().id, {
          url: "https://portal.example.gov/start",
          mode: "same_domain_crawl",
          maxPages: 75,
          maxDepth: 3,
          viewports: ["desktop"]
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

        const listed = await listScans(app, owner);
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

  it("rejects unauthenticated scoped scan list and create requests", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const list = await app.inject({ method: "GET", url: "/api/workspaces/acme/scans" });
        const created = await app.inject({
          method: "POST",
          url: "/api/workspaces/acme/scans",
          payload: {
            projectId: "project-1",
            url: "https://portal.example.test/"
          }
        });

        expect(list.statusCode).toBe(401);
        expect(created.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 for non-member scoped scan list and create requests", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");
        const project = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");

        const list = await listScans(app, outsider, "owner-workspace");
        const created = await startScan(app, outsider, project.json().id, {}, "owner-workspace");

        expect(list.statusCode).toBe(404);
        expect(created.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("allows workspace members to list and create scans", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const project = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");
        const invite = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");
        const member = await acceptWorkspaceInvite(app, invite, "member@example.com");

        const created = await startScan(app, member, project.json().id, {}, "owner-workspace");
        const listed = await listScans(app, member, "owner-workspace");

        expect(created.statusCode).toBe(201);
        expect(listed.statusCode).toBe(200);
        expect(listed.json().data).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: created.json().id, projectName: "Owner Portal" })
        ]));
      } finally {
        await app.close();
      }
    });
  });

  it("allows workspace owners to list and create scans", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Owner Portal", "https://owner.example.test/");

        const created = await startScan(app, owner, project.json().id);
        const listed = await listScans(app, owner);

        expect(created.statusCode).toBe(201);
        expect(listed.statusCode).toBe(200);
        expect(listed.json().data).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: created.json().id, projectName: "Owner Portal" })
        ]));
      } finally {
        await app.close();
      }
    });
  });

  it("rejects scans for projects outside the current workspace even when using the foreign project URL", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const acme = await signup(app, "acme@example.com", "Acme");
        const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
        const betaUrl = "https://beta.example.test/";
        const betaProject = await createProject(app, beta, "Beta Portal", betaUrl);

        const created = await startScan(app, acme, betaProject.json().id, { url: betaUrl }, "acme");

        expect(created.statusCode).toBe(404);
        expect((await listScans(app, acme)).json().data).toHaveLength(0);
        expect((await listScans(app, beta)).json().data).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 for old global scan list and create routes", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const listed = await app.inject({ method: "GET", url: "/api/scans" });
        const created = await app.inject({
          method: "POST",
          url: "/api/scans",
          payload: {
            projectId: "project-1",
            url: "https://global.example.test/"
          }
        });

        expect(listed.statusCode).toBe(404);
        expect(created.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects starting a second active scan for the same project", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const auth = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, auth, "Portal", "https://portal.example.test/");
        const first = await startScan(app, auth, project.json().id);
        expect(first.statusCode).toBe(201);

        const second = await startScan(app, auth, project.json().id);
        expect(second.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });

  it("atomically rejects concurrent active scans for the same project", async () => {
    await withTempDb(async (dbPath) => {
      let releaseScan!: () => void;
      const scanMayComplete = new Promise<void>((resolve) => {
        releaseScan = resolve;
      });
      runScanMock.mockImplementation(async () => {
        await scanMayComplete;
        return {
          runId: "unused",
          projectId: null,
          targetUrl: "https://portal.example.test/",
          mode: "single_url",
          pages: [],
          findings: [],
          reports: [],
          score: 100,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString()
        };
      });
      const app = await buildServer({ dbPath });
      try {
        const auth = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, auth, "Portal", "https://portal.example.test/");

        const responses = await Promise.all([
          startScan(app, auth, project.json().id),
          startScan(app, auth, project.json().id)
        ]);
        const statusCodes = responses.map((response) => response.statusCode).sort((left, right) => left - right);

        expect(statusCodes).toEqual([201, 409]);
        expect((await listScans(app, auth)).json().data).toHaveLength(1);
      } finally {
        releaseScan();
        await app.close();
      }
    });
  });

  it("rejects unsafe private project targets", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const targets = [
          { url: "http://localhost:3000" },
          { url: "http://127.0.0.1" },
          { url: "http://192.168.1.10" },
          { url: "http://169.254.169.254/latest/meta-data" },
          { url: "http://[::1]" },
          { domain: "10.0.0.5" }
        ];

        for (const payload of targets) {
          const response = await createProjectWithPayload(app, owner, payload);

          expect(response.statusCode).toBe(400);
        }

        const listed = await listProjects(app, owner);
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
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Portal", "https://portal.example.gov");

        const targets = [
          "http://localhost:3000",
          "http://127.0.0.1",
          "http://192.168.1.10",
          "http://169.254.169.254/latest/meta-data",
          "http://[::1]"
        ];

        for (const url of targets) {
          const response = await startScan(app, owner, project.json().id, { url });

          expect(response.statusCode).toBe(400);
        }

        const listed = await listScans(app, owner);
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
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Portal", "https://portal.example.gov");

      const scan = await startScan(app, owner, project.json().id, {
        url: "https://portal.example.gov/start"
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

      const listed = await listProjects(app, owner);
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
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      dbClient.db.insert(workspaceMembers).values({
        id: "member-default-workspace",
        workspaceId: "default-workspace",
        userId: owner.json().data.user.id,
        role: "owner",
        createdAt: new Date().toISOString()
      }).run();
      const response = await listScans(app, owner, "default-workspace");

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
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Fixture", "https://fixture.example.com");

        expect(project.statusCode).toBe(201);

        const scan = await startScan(app, owner, project.json().id, {
          url: "https://fixture.example.com",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop"]
        });

        expect(scan.statusCode).toBe(201);
        await waitForCompletedScan(app, owner, scan.json().id);

        const findingsResponse = await listFindings(app, owner, `?scanRunId=${scan.json().id}`);
        expect(findingsResponse.statusCode).toBe(200);
        expect(findingsResponse.json().data.length).toBeGreaterThan(0);
        expect(JSON.parse(findingsResponse.json().data[0].evidence)).toMatchObject([
          { kind: "page_screenshot", mimeType: "image/png" },
          { kind: "html_snippet", mimeType: "text/plain" }
        ]);

        const reportsResponse = await listReports(app, owner, `?scanRunId=${scan.json().id}`);
        expect(reportsResponse.statusCode).toBe(200);
        const pdfReport = reportsResponse.json().data.find((report: { kind: string }) => report.kind === "pdf");
        expect(pdfReport).toBeDefined();

        const download = await downloadReport(app, owner, pdfReport.id);
        expect(download.statusCode).toBe(200);
        expect(download.headers["content-type"]).toContain("application/pdf");

        const screenshotKey = JSON.parse(findingsResponse.json().data[0].evidence)[0].artifactKey;
        const screenshotDownload = await downloadArtifact(app, owner, screenshotKey);
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
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Fixture", "https://fixture.example.com");
        const scan = await startScan(app, owner, project.json().id, {
          url: "https://fixture.example.com",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop"]
        });

        const completedScan = await waitForScan(app, owner, scan.json().id, "completed");

        expect(completedScan.errorMessage).toContain(
          "PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"
        );

        const reportsResponse = await listReports(app, owner, `?scanRunId=${scan.json().id}`);
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
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Grouped Fixture", "https://grouped.example.com");
      const scan = await startScan(app, owner, project.json().id, {
        url: "https://grouped.example.com/page",
        mode: "single_url",
        maxPages: 1,
        viewports: ["desktop", "mobile"]
      });

      await waitForCompletedScan(app, owner, scan.json().id);

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
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Fixture", "https://fixture.example.com");
        const scan = await startScan(app, owner, project.json().id, {
          url: "https://fixture.example.com",
          mode: "single_url",
          maxPages: 1,
          viewports: ["desktop"]
        });

        await waitForCompletedScan(app, owner, scan.json().id);

        const response = await listIssues(app, owner, `?scanRunId=${scan.json().id}`);

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

  it("returns 404 for old global issue and finding routes", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const issuesList = await app.inject({ method: "GET", url: "/api/issues" });
      const issueDetail = await app.inject({ method: "GET", url: "/api/issues/issue-fixture" });
      const findingsList = await app.inject({ method: "GET", url: "/api/findings" });

      expect(issuesList.statusCode).toBe(404);
      expect(issueDetail.statusCode).toBe(404);
      expect(findingsList.statusCode).toBe(404);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns 404 for old global report and artifact routes", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const reportsList = await app.inject({ method: "GET", url: "/api/reports" });
      const reportDownload = await app.inject({ method: "GET", url: "/api/reports/report-fixture/download" });
      const artifactDownload = await app.inject({
        method: "GET",
        url: `/api/artifacts/download?key=${encodeURIComponent("runs/run-1/screenshot/page.png")}`
      });

      expect(reportsList.statusCode).toBe(404);
      expect(reportDownload.statusCode).toBe(404);
      expect(artifactDownload.statusCode).toBe(404);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("requires authentication for scoped issue and finding routes", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const issuesList = await app.inject({ method: "GET", url: "/api/workspaces/acme/issues" });
      const issueDetail = await app.inject({ method: "GET", url: "/api/workspaces/acme/issues/issue-fixture" });
      const findingsList = await app.inject({ method: "GET", url: "/api/workspaces/acme/findings" });

      expect(issuesList.statusCode).toBe(401);
      expect(issueDetail.statusCode).toBe(401);
      expect(findingsList.statusCode).toBe(401);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("requires authentication for scoped report and artifact routes", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const reportsList = await app.inject({ method: "GET", url: "/api/workspaces/acme/reports" });
      const reportDownload = await app.inject({ method: "GET", url: "/api/workspaces/acme/reports/report-fixture/download" });
      const artifactDownload = await app.inject({
        method: "GET",
        url: `/api/workspaces/acme/artifacts/download?key=${encodeURIComponent("runs/run-1/screenshot/page.png")}`
      });

      expect(reportsList.statusCode).toBe(401);
      expect(reportDownload.statusCode).toBe(401);
      expect(artifactDownload.statusCode).toBe(401);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns 404 for nonmember scoped issue and finding routes", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const nonmember = await signupWithPublicSignup(app, "outsider@example.com", "Outsider Workspace");
      const workspaceSlug = primaryWorkspaceSlug(owner);

      const issuesList = await listIssues(app, nonmember, "", workspaceSlug);
      const issueDetail = await getIssue(app, nonmember, "issue-fixture", workspaceSlug);
      const findingsList = await listFindings(app, nonmember, "", workspaceSlug);

      expect(issuesList.statusCode).toBe(404);
      expect(issueDetail.statusCode).toBe(404);
      expect(findingsList.statusCode).toBe(404);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns 404 for nonmember scoped report and artifact routes", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const nonmember = await signupWithPublicSignup(app, "outsider@example.com", "Outsider Workspace");
      const workspaceSlug = primaryWorkspaceSlug(owner);

      const reportsList = await listReports(app, nonmember, "", workspaceSlug);
      const reportDownload = await downloadReport(app, nonmember, "report-fixture", workspaceSlug);
      const artifactDownload = await downloadArtifact(app, nonmember, "runs/run-1/screenshot/page.png", workspaceSlug);

      expect(reportsList.statusCode).toBe(404);
      expect(reportDownload.statusCode).toBe(404);
      expect(artifactDownload.statusCode).toBe(404);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("allows workspace members to read scoped issues and findings", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const workspaceSlug = primaryWorkspaceSlug(owner);
      const project = await createProject(app, owner, "Member Fixture", "https://member.example.com", workspaceSlug);
      const scan = await startScan(app, owner, project.json().id, { url: "https://member.example.com" }, workspaceSlug);
      const invite = await createWorkspaceInvite(app, authCookies(owner), workspaceSlug, "member@example.com");
      const member = await acceptWorkspaceInvite(app, invite, "member@example.com");

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-member-readable",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        representativeUrl: "https://member.example.com",
        sampleUrls: JSON.stringify(["https://member.example.com"])
      })).run();
      dbClient.db.insert(findings).values(findingFixture({
        id: "finding-member-readable",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        issueId: "issue-member-readable",
        pageUrl: "https://member.example.com"
      })).run();

      const issuesList = await listIssues(app, member, "", workspaceSlug);
      const issueDetail = await getIssue(app, member, "issue-member-readable", workspaceSlug);
      const findingsList = await listFindings(app, member, "", workspaceSlug);

      expect(issuesList.statusCode).toBe(200);
      expect(issuesList.json().data).toHaveLength(1);
      expect(issuesList.json().data[0]).toMatchObject({ id: "issue-member-readable" });
      expect(issueDetail.statusCode).toBe(200);
      expect(issueDetail.json()).toMatchObject({ id: "issue-member-readable", sampleUrls: ["https://member.example.com"] });
      expect(findingsList.statusCode).toBe(200);
      expect(findingsList.json().data).toHaveLength(1);
      expect(findingsList.json().data[0]).toMatchObject({ id: "finding-member-readable" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("applies project filters for grouped issues inside a workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const projectA = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const projectB = await createProject(app, owner, "Project B", "https://project-b.example.com");
      const scanA = await startScan(app, owner, projectA.json().id, {
        url: "https://project-a.example.com"
      });
      const scanB = await startScan(app, owner, projectB.json().id, {
        url: "https://project-b.example.com"
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

      const response = await listIssues(app, owner, `?projectId=${projectA.json().id}`);

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

  it("applies project and scan filters together for grouped issues inside a workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const projectA = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const projectB = await createProject(app, owner, "Project B", "https://project-b.example.com");
      const scanB = await startScan(app, owner, projectB.json().id, {
        url: "https://project-b.example.com"
      });

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-project-b",
        projectId: projectB.json().id,
        scanRunId: scanB.json().id,
        representativeUrl: "https://project-b.example.com",
        sampleUrls: JSON.stringify(["https://project-b.example.com"])
      })).run();

      const response = await listIssues(app, owner, `?projectId=${projectA.json().id}&scanRunId=${scanB.json().id}`);

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([]);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("allows unfiltered grouped issues inside a workspace without leaking other workspaces", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const otherOwner = await signupWithPublicSignup(app, "other@example.com", "Other Workspace");
      const project = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const otherProject = await createProject(app, otherOwner, "Project B", "https://project-b.example.com");
      const scan = await startScan(app, owner, project.json().id, { url: "https://project-a.example.com" });
      const otherScan = await startScan(app, otherOwner, otherProject.json().id, { url: "https://project-b.example.com" });

      dbClient.db.insert(issues).values([
        issueFixture({
          id: "issue-workspace-a",
          projectId: project.json().id,
          scanRunId: scan.json().id,
          representativeUrl: "https://project-a.example.com",
          sampleUrls: JSON.stringify(["https://project-a.example.com"])
        }),
        issueFixture({
          id: "issue-workspace-b",
          projectId: otherProject.json().id,
          scanRunId: otherScan.json().id,
          representativeUrl: "https://project-b.example.com",
          sampleUrls: JSON.stringify(["https://project-b.example.com"])
        })
      ]).run();

      const response = await listIssues(app, owner);

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0]).toMatchObject({ id: "issue-workspace-a" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("allows unfiltered findings inside a workspace without leaking other workspaces", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const otherOwner = await signupWithPublicSignup(app, "other@example.com", "Other Workspace");
      const project = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const otherProject = await createProject(app, otherOwner, "Project B", "https://project-b.example.com");
      const scan = await startScan(app, owner, project.json().id, { url: "https://project-a.example.com" });
      const otherScan = await startScan(app, otherOwner, otherProject.json().id, { url: "https://project-b.example.com" });

      dbClient.db.insert(findings).values([
        findingFixture({
          id: "finding-workspace-a",
          projectId: project.json().id,
          scanRunId: scan.json().id,
          pageUrl: "https://project-a.example.com",
          createdAt: "2026-05-31T00:00:02.000Z"
        }),
        findingFixture({
          id: "finding-workspace-b",
          projectId: otherProject.json().id,
          scanRunId: otherScan.json().id,
          pageUrl: "https://project-b.example.com",
          createdAt: "2026-05-31T00:00:01.000Z"
        })
      ]).run();

      const response = await listFindings(app, owner);

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0]).toMatchObject({ id: "finding-workspace-a" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns issue detail with parsed sample URLs inside a workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Detail Fixture", "https://detail.example.com");
      const scan = await startScan(app, owner, project.json().id, { url: "https://detail.example.com" });

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-detail",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        sampleUrls: JSON.stringify(["https://detail.example.com/a", "https://detail.example.com/b"])
      })).run();

      const detail = await getIssue(app, owner, "issue-detail");

      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toMatchObject({ id: "issue-detail", sampleUrls: ["https://detail.example.com/a", "https://detail.example.com/b"] });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("returns 404 for issue detail from another workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const otherOwner = await signupWithPublicSignup(app, "other@example.com", "Other Workspace");
      const project = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const otherProject = await createProject(app, otherOwner, "Project B", "https://project-b.example.com");
      await startScan(app, owner, project.json().id, { url: "https://project-a.example.com" });
      const otherScan = await startScan(app, otherOwner, otherProject.json().id, { url: "https://project-b.example.com" });

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-other-workspace",
        projectId: otherProject.json().id,
        scanRunId: otherScan.json().id,
        sampleUrls: JSON.stringify(["https://project-b.example.com"])
      })).run();

      const detail = await getIssue(app, owner, "issue-other-workspace");

      expect(detail.statusCode).toBe(404);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("applies project and scan filters together for findings inside a workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const projectA = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const projectB = await createProject(app, owner, "Project B", "https://project-b.example.com");
      const scanA = await startScan(app, owner, projectA.json().id, { url: "https://project-a.example.com" });
      const scanB = await startScan(app, owner, projectB.json().id, { url: "https://project-b.example.com" });

      dbClient.db.insert(findings).values([
        findingFixture({
          id: "finding-project-a",
          projectId: projectA.json().id,
          scanRunId: scanA.json().id,
          pageUrl: "https://project-a.example.com"
        }),
        findingFixture({
          id: "finding-project-b",
          projectId: projectB.json().id,
          scanRunId: scanB.json().id,
          pageUrl: "https://project-b.example.com"
        })
      ]).run();

      const mismatch = await listFindings(app, owner, `?projectId=${projectA.json().id}&scanRunId=${scanB.json().id}`);
      const match = await listFindings(app, owner, `?projectId=${projectA.json().id}&scanRunId=${scanA.json().id}`);

      expect(mismatch.statusCode).toBe(200);
      expect(mismatch.json().data).toEqual([]);
      expect(match.statusCode).toBe(200);
      expect(match.json().data).toHaveLength(1);
      expect(match.json().data[0]).toMatchObject({ id: "finding-project-a" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("applies project filters for findings inside a workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const projectA = await createProject(app, owner, "Project A", "https://project-a.example.com");
      const projectB = await createProject(app, owner, "Project B", "https://project-b.example.com");
      const scanA = await startScan(app, owner, projectA.json().id, { url: "https://project-a.example.com" });
      const scanB = await startScan(app, owner, projectB.json().id, { url: "https://project-b.example.com" });

      dbClient.db.insert(findings).values([
        findingFixture({
          id: "finding-project-a-filter",
          projectId: projectA.json().id,
          scanRunId: scanA.json().id,
          pageUrl: "https://project-a.example.com"
        }),
        findingFixture({
          id: "finding-project-b-filter",
          projectId: projectB.json().id,
          scanRunId: scanB.json().id,
          pageUrl: "https://project-b.example.com"
        })
      ]).run();

      const response = await listFindings(app, owner, `?projectId=${projectA.json().id}`);

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0]).toMatchObject({ id: "finding-project-a-filter" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("allows unfiltered reports inside a workspace without leaking other workspaces", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const otherOwner = await signupWithPublicSignup(app, "other@example.com", "Other Workspace");
      const project = await createProject(app, owner, "Project A", "https://report-a.example.com");
      const otherProject = await createProject(app, otherOwner, "Project B", "https://report-b.example.com");
      const scan = await startScan(app, owner, project.json().id, { url: "https://report-a.example.com" });
      const otherScan = await startScan(app, otherOwner, otherProject.json().id, { url: "https://report-b.example.com" });

      dbClient.db.insert(reports).values([
        reportFixture({
          id: "report-workspace-a",
          projectId: project.json().id,
          scanRunId: scan.json().id,
          artifactKey: "runs/report-workspace-a/report.pdf"
        }),
        reportFixture({
          id: "report-workspace-b",
          projectId: otherProject.json().id,
          scanRunId: otherScan.json().id,
          artifactKey: "runs/report-workspace-b/report.pdf"
        })
      ]).run();

      const response = await listReports(app, owner);

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0]).toMatchObject({
        id: "report-workspace-a",
        projectName: "Project A"
      });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("applies project and scan filters for reports inside a workspace", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const projectA = await createProject(app, owner, "Project A", "https://report-filter-a.example.com");
      const projectB = await createProject(app, owner, "Project B", "https://report-filter-b.example.com");
      const scanA = await startScan(app, owner, projectA.json().id, { url: "https://report-filter-a.example.com" });
      const scanB = await startScan(app, owner, projectB.json().id, { url: "https://report-filter-b.example.com" });

      dbClient.db.insert(reports).values([
        reportFixture({
          id: "report-project-a",
          projectId: projectA.json().id,
          scanRunId: scanA.json().id,
          artifactKey: "runs/report-project-a/report.pdf"
        }),
        reportFixture({
          id: "report-project-b",
          projectId: projectB.json().id,
          scanRunId: scanB.json().id,
          artifactKey: "runs/report-project-b/report.pdf"
        })
      ]).run();

      const projectOnly = await listReports(app, owner, `?projectId=${projectA.json().id}`);
      const match = await listReports(app, owner, `?projectId=${projectA.json().id}&scanRunId=${scanA.json().id}`);
      const mismatch = await listReports(app, owner, `?projectId=${projectA.json().id}&scanRunId=${scanB.json().id}`);

      expect(projectOnly.statusCode).toBe(200);
      expect(projectOnly.json().data).toHaveLength(1);
      expect(projectOnly.json().data[0]).toMatchObject({ id: "report-project-a" });
      expect(match.statusCode).toBe(200);
      expect(match.json().data).toHaveLength(1);
      expect(match.json().data[0]).toMatchObject({ id: "report-project-a" });
      expect(mismatch.statusCode).toBe(200);
      expect(mismatch.json().data).toEqual([]);
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("allows workspace owners and members to list and download reports and artifacts", async () => {
    const dbClient = createDb(":memory:");
    const storageRoot = join(tmpdir(), "a11yaudit-scoped-artifacts-readable");
    const app = await buildServer({ dbClient, executeScans: false, storageRoot });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const workspaceSlug = primaryWorkspaceSlug(owner);
      const project = await createProject(app, owner, "Readable", "https://readable.example.com", workspaceSlug);
      const scan = await startScan(app, owner, project.json().id, { url: "https://readable.example.com" }, workspaceSlug);
      const invite = await createWorkspaceInvite(app, authCookies(owner), workspaceSlug, "member@example.com");
      const member = await acceptWorkspaceInvite(app, invite, "member@example.com");

      await writeStoredArtifact(storageRoot, "runs/readable/report.pdf", "%PDF-1.4\n");
      await writeStoredArtifact(storageRoot, "runs/readable/screenshot.png", "png");
      await writeStoredArtifact(storageRoot, "runs/readable/snippet.txt", "snippet");
      await writeStoredArtifact(storageRoot, "runs/readable/blob", "html");
      dbClient.db.insert(reports).values(reportFixture({
        id: "report-readable",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        artifactKey: "runs/readable/report.pdf",
        sizeBytes: 9
      })).run();
      dbClient.db.insert(findings).values(findingFixture({
        id: "finding-readable",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        evidence: JSON.stringify([
          { kind: "page_screenshot", artifactKey: "runs/readable/screenshot.png", mimeType: "image/png" },
          { kind: "html_snippet", artifactKey: "runs/readable/snippet.txt", mimeType: "text/plain" },
          { kind: "html_snippet", artifactKey: "runs/readable/blob", mimeType: "text/html" }
        ])
      })).run();

      const ownerList = await listReports(app, owner, "", workspaceSlug);
      const memberList = await listReports(app, member, "", workspaceSlug);
      const reportDownload = await downloadReport(app, member, "report-readable", workspaceSlug);
      const reportArtifactDownload = await downloadArtifact(app, member, "runs/readable/report.pdf", workspaceSlug);
      const screenshotDownload = await downloadArtifact(app, member, "runs/readable/screenshot.png", workspaceSlug);
      const snippetDownload = await downloadArtifact(app, owner, "runs/readable/snippet.txt", workspaceSlug);
      const htmlBlobDownload = await downloadArtifact(app, owner, "runs/readable/blob", workspaceSlug);

      expect(ownerList.statusCode).toBe(200);
      expect(ownerList.json().data).toHaveLength(1);
      expect(memberList.statusCode).toBe(200);
      expect(memberList.json().data).toHaveLength(1);
      expect(reportDownload.statusCode).toBe(200);
      expect(reportDownload.headers["content-type"]).toContain("application/pdf");
      expect(reportArtifactDownload.statusCode).toBe(200);
      expect(reportArtifactDownload.headers["content-type"]).toContain("application/pdf");
      expect(screenshotDownload.statusCode).toBe(200);
      expect(screenshotDownload.headers["content-type"]).toContain("image/png");
      expect(snippetDownload.statusCode).toBe(200);
      expect(snippetDownload.headers["content-type"]).toContain("text/plain");
      expect(htmlBlobDownload.statusCode).toBe(200);
      expect(htmlBlobDownload.headers["content-type"]).toContain("text/html");
    } finally {
      await app.close();
      dbClient.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it("returns 404 for report downloads outside the current workspace", async () => {
    const dbClient = createDb(":memory:");
    const storageRoot = join(tmpdir(), "a11yaudit-report-cross-workspace");
    const app = await buildServer({ dbClient, executeScans: false, storageRoot });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const otherOwner = await signupWithPublicSignup(app, "other@example.com", "Other Workspace");
      const project = await createProject(app, owner, "Project A", "https://report-current.example.com");
      const otherProject = await createProject(app, otherOwner, "Project B", "https://report-other.example.com");
      await startScan(app, owner, project.json().id, { url: "https://report-current.example.com" });
      const otherScan = await startScan(app, otherOwner, otherProject.json().id, { url: "https://report-other.example.com" });
      await writeStoredArtifact(storageRoot, "runs/other/report.pdf", "%PDF-1.4\n");
      dbClient.db.insert(reports).values(reportFixture({
        id: "report-other-workspace",
        projectId: otherProject.json().id,
        scanRunId: otherScan.json().id,
        artifactKey: "runs/other/report.pdf"
      })).run();

      const response = await downloadReport(app, owner, "report-other-workspace");

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Report not found" });
    } finally {
      await app.close();
      dbClient.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it("returns 404 for artifact downloads outside the current workspace", async () => {
    const dbClient = createDb(":memory:");
    const storageRoot = join(tmpdir(), "a11yaudit-artifact-cross-workspace");
    const app = await buildServer({ dbClient, executeScans: false, storageRoot });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const otherOwner = await signupWithPublicSignup(app, "other@example.com", "Other Workspace");
      const project = await createProject(app, owner, "Project A", "https://artifact-current.example.com");
      const otherProject = await createProject(app, otherOwner, "Project B", "https://artifact-other.example.com");
      const scan = await startScan(app, owner, project.json().id, { url: "https://artifact-current.example.com" });
      const otherScan = await startScan(app, otherOwner, otherProject.json().id, { url: "https://artifact-other.example.com" });
      await writeStoredArtifact(storageRoot, "runs/other/screenshot.png", "png");
      dbClient.db.insert(findings).values([
        findingFixture({
          id: "finding-malformed-evidence",
          projectId: project.json().id,
          scanRunId: scan.json().id,
          evidence: "not-json"
        }),
        findingFixture({
          id: "finding-other-artifact",
          projectId: otherProject.json().id,
          scanRunId: otherScan.json().id,
          evidence: JSON.stringify([{ artifactKey: "runs/other/screenshot.png" }])
        })
      ]).run();

      const response = await downloadArtifact(app, owner, "runs/other/screenshot.png");

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Artifact not found" });
    } finally {
      await app.close();
      dbClient.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it("returns 404 for unreferenced and missing scoped artifacts", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({
      dbClient,
      executeScans: false,
      storageRoot: join(tmpdir(), "a11yaudit-scoped-unreferenced-artifacts")
    });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Portal", "https://portal-artifacts.example.gov");
      const scan = await startScan(app, owner, project.json().id, { url: "https://portal-artifacts.example.gov/start" });
      dbClient.db.insert(findings).values(findingFixture({
        id: "finding-missing-artifact",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        evidence: JSON.stringify([{ artifactKey: "missing/evidence.png" }])
      })).run();

      const unreferenced = await downloadArtifact(app, owner, "runs/run-1/screenshot/unreferenced.png");
      const missing = await downloadArtifact(app, owner, "missing/evidence.png");

      expect(unreferenced.statusCode).toBe(404);
      expect(unreferenced.json()).toEqual({ error: "Artifact not found" });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: "Artifact not found" });
    } finally {
      await app.close();
      dbClient.close();
    }
  });

  it("defaults malformed stored issue sample URLs to an empty array in list and detail", async () => {
    const dbClient = createDb(":memory:");
    const app = await buildServer({ dbClient, executeScans: false });

    try {
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Malformed Fixture", "https://malformed.example.com");
      const scan = await startScan(app, owner, project.json().id, {
        url: "https://malformed.example.com"
      });

      dbClient.db.insert(issues).values(issueFixture({
        id: "issue-malformed-sample-urls",
        projectId: project.json().id,
        scanRunId: scan.json().id,
        sampleUrls: "not-json"
      })).run();

      const listed = await listIssues(app, owner, `?scanRunId=${scan.json().id}`);
      const detail = await getIssue(app, owner, "issue-malformed-sample-urls");

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
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const project = await createProject(app, owner, "Large Fixture", "https://large.example.com");
        const scan = await startScan(app, owner, project.json().id, {
          url: "https://large.example.com",
          mode: "same_domain_crawl",
          maxPages: 250,
          viewports: ["desktop", "mobile"]
        });

        await waitForCompletedScan(app, owner, scan.json().id);

        const listed = await listScans(app, owner);
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
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const response = await downloadArtifact(app, owner, "runs/run-1/screenshot/unreferenced.png");

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
      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Portal", "https://portal.example.gov");
      const scan = await startScan(app, owner, project.json().id, {
        url: "https://portal.example.gov/start"
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

      const response = await downloadReport(app, owner, "report-missing-artifact");

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

      const owner = await signup(app, "owner@example.com", "Owner Workspace");
      const project = await createProject(app, owner, "Fixture", "https://fixture.example.com");
      const scan = await startScan(app, owner, project.json().id, {
        url: "https://fixture.example.com",
        mode: "single_url",
        maxPages: 1,
        viewports: ["desktop"]
      });

      const failedScan = await waitForScan(app, owner, scan.json().id, "failed");

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

  describe("workspace members", () => {
    it("lets an owner list workspace members with roles", async () => {
      await withTempDb(async (dbPath) => {
        const app = await buildServer({ dbPath, executeScans: false });
        try {
          const owner = await signup(app, "owner@example.com", "Owner Workspace");
          const ownerCookies = authCookies(owner);
          await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

          const response = await app.inject({
            method: "GET",
            url: "/api/workspaces/owner-workspace/members",
            cookies: ownerCookies
          });

          expect(response.statusCode).toBe(200);
          const members = response.json().data.members as Array<{ email: string; role: string }>;
          expect(members).toHaveLength(2);
          expect(members.map((m) => `${m.email}:${m.role}`).sort()).toEqual([
            "member@example.com:member",
            "owner@example.com:owner"
          ]);
        } finally {
          await app.close();
        }
      });
    });

    it("rejects member listing by non-owners", async () => {
      await withTempDb(async (dbPath) => {
        const app = await buildServer({ dbPath, executeScans: false });
        try {
          const owner = await signup(app, "owner@example.com", "Owner Workspace");
          const ownerCookies = authCookies(owner);
          const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");
          const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");

          const asMember = await app.inject({
            method: "GET",
            url: "/api/workspaces/owner-workspace/members",
            cookies: member.cookies
          });
          const asOutsider = await app.inject({
            method: "GET",
            url: "/api/workspaces/owner-workspace/members",
            cookies: authCookies(outsider)
          });

          expect(asMember.statusCode).toBe(403);
          expect(asOutsider.statusCode).toBe(404);
        } finally {
          await app.close();
        }
      });
    });

  it("lets an owner promote a member to owner", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${member.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "owner" }
        });

        expect(response.statusCode).toBe(200);
        const list = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: ownerCookies
        });
        const promoted = list.json().data.members.find((m: { email: string }) => m.email === "member@example.com");
        expect(promoted.role).toBe("owner");
      } finally {
        await app.close();
      }
    });
  });

  it("rejects an owner changing their own role", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const ownerUserId = owner.json().data.user.id;

        const response = await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${ownerUserId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "member" }
        });

        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  it("lets an owner demote a second owner back to member when others remain", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const second = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "second@example.com");

        await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${second.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "owner" }
        });

        const response = await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${second.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "member" }
        });

        expect(response.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 when changing the role of a non-member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);

        const response = await app.inject({
          method: "PATCH",
          url: "/api/workspaces/owner-workspace/members/user-not-a-member",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "owner" }
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("lets an owner remove a member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/members/${member.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(200);
        const list = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: ownerCookies
        });
        expect(list.json().data.members).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects an owner removing themselves", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const ownerUserId = owner.json().data.user.id;

        const response = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/members/${ownerUserId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 when removing a user who is not a member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);

        const response = await app.inject({
          method: "DELETE",
          url: "/api/workspaces/owner-workspace/members/user-does-not-exist",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects inviting an email that already belongs to a member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");

        expect(response.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects a second pending invite for the same email", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const first = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");
        expect(first.statusCode).toBe(201);

        const second = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");

        expect(second.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });

  it("lists only pending invitations for owners", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const pending = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "pending@example.com");
        const revoked = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "revoked@example.com");
        await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/invitations/${revoked.json().data.invitation.id}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/invitations",
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(200);
        const invitations = response.json().data.invitations as Array<{ id: string; email: string }>;
        expect(invitations).toHaveLength(1);
        expect(invitations[0].email).toBe("pending@example.com");
        expect(invitations[0].id).toBe(pending.json().data.invitation.id);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invitation listing by non-owners", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/invitations",
          cookies: member.cookies
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  it("regenerates an invite token so the old link stops working", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const created = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");
        const invitationId = created.json().data.invitation.id;
        const oldToken = created.json().data.inviteUrl.replace("/invite/", "");

        const regenerated = await app.inject({
          method: "POST",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}/regenerate`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(regenerated.statusCode).toBe(200);
        const newToken = regenerated.json().data.inviteUrl.replace("/invite/", "");
        expect(newToken).not.toBe(oldToken);

        const acceptOld = await app.inject({
          method: "POST",
          url: `/api/invitations/${oldToken}/accept`,
          payload: { fullName: "Member", email: "invitee@example.com", password: "password12345" }
        });
        expect(acceptOld.statusCode).toBe(404);

        const acceptNew = await app.inject({
          method: "POST",
          url: `/api/invitations/${newToken}/accept`,
          payload: { fullName: "Member", email: "invitee@example.com", password: "password12345" }
        });
        expect(acceptNew.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects regenerating an unknown invitation", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);

        const response = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations/winv-missing/regenerate",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects regenerating a revoked invitation", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const created = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");
        const invitationId = created.json().data.invitation.id;

        await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        const response = await app.inject({
          method: "POST",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}/regenerate`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });
  });
});
