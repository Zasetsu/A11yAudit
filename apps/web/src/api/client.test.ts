import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonDataResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
    status
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    status
  });
}

async function importClient(apiBaseUrl?: string) {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (apiBaseUrl !== undefined) {
    vi.stubEnv("VITE_A11YAUDIT_API_BASE_URL", apiBaseUrl);
  }

  return import("./client");
}

function sessionPayload() {
  return {
    user: {
      id: "user-1",
      fullName: "Ada Lovelace",
      email: "ada@example.test"
    },
    workspaces: [
      {
        id: "wrk-1",
        name: "Acme",
        slug: "acme",
        role: "owner"
      }
    ]
  };
}

function requestOptions(fetchMock: { mock: { calls: unknown[][] } }, callIndex = 0): RequestInit {
  return fetchMock.mock.calls[callIndex][1] as RequestInit;
}

function requestHeaders(fetchMock: { mock: { calls: unknown[][] } }, callIndex = 0): Headers {
  return requestOptions(fetchMock, callIndex).headers as Headers;
}

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getSession returns null when no API base URL is configured", async () => {
    const { getSession } = await importClient();

    await expect(getSession()).resolves.toBeNull();
  });

  it("getSession returns null for 401 and invalid responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonDataResponse({ user: null }));
    vi.stubGlobal("fetch", fetchMock);
    const { getSession } = await importClient("https://api.example.test/");

    await expect(getSession()).resolves.toBeNull();
    await expect(getSession()).resolves.toBeNull();
  });

  it("getSession maps a valid session and fetches with credentials", async () => {
    vi.stubGlobal("document", { cookie: "a11yaudit_csrf=csrf-token" });
    const fetchMock = vi.fn(async () => jsonDataResponse(sessionPayload()));
    vi.stubGlobal("fetch", fetchMock);
    const { getSession } = await importClient("https://api.example.test/");

    await expect(getSession()).resolves.toEqual(sessionPayload());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/auth/session",
      expect.objectContaining({ credentials: "include" })
    );
    expect(requestHeaders(fetchMock).get("Accept")).toBe("application/json");
    expect(requestHeaders(fetchMock).get("X-CSRF-Token")).toBeNull();
  });

  it("signup, login, and acceptInvite POST JSON to auth endpoints with credentials", async () => {
    const fetchMock = vi.fn(async () => jsonDataResponse(sessionPayload(), 201));
    vi.stubGlobal("fetch", fetchMock);
    const { acceptInvite, login, signup } = await importClient("https://api.example.test/");

    await expect(signup({
      fullName: "Ada Lovelace",
      email: "ada@example.test",
      password: "correct horse battery staple",
      workspaceName: "Acme"
    })).resolves.toEqual(sessionPayload());
    await expect(login({
      email: "ada@example.test",
      password: "correct horse battery staple"
    })).resolves.toEqual(sessionPayload());
    await expect(acceptInvite("invite-token", {
      fullName: "Ada Lovelace",
      email: "ada@example.test",
      password: "correct horse battery staple"
    })).resolves.toEqual(sessionPayload());

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/api/auth/signup",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/auth/login",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/api/invitations/invite-token/accept",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
    expect(requestOptions(fetchMock, 0).body).toBe(JSON.stringify({
      fullName: "Ada Lovelace",
      email: "ada@example.test",
      password: "correct horse battery staple",
      workspaceName: "Acme"
    }));
    expect(requestHeaders(fetchMock, 0).get("Content-Type")).toBe("application/json");
  });

  it("mutating auth methods throw when API is not configured or returns invalid data", async () => {
    const unconfigured = await importClient();
    await expect(unconfigured.login({ email: "ada@example.test", password: "password" })).rejects.toThrow(Error);

    const fetchMock = vi.fn(async () => jsonDataResponse({ user: null }));
    vi.stubGlobal("fetch", fetchMock);
    const configured = await importClient("https://api.example.test/");

    await expect(configured.signup({
      fullName: "Ada Lovelace",
      email: "ada@example.test",
      password: "correct horse battery staple",
      workspaceName: "Acme"
    })).rejects.toThrow(Error);
  });

  it("logout POSTs with credentials and CSRF header when cookie exists", async () => {
    vi.stubGlobal("document", { cookie: "a11yaudit_csrf=csrf-token" });
    const fetchMock = vi.fn(async () => jsonDataResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { logout } = await importClient("https://api.example.test/");

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/auth/logout",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
    expect(requestHeaders(fetchMock).get("X-CSRF-Token")).toBe("csrf-token");
  });

  it("uses demo reports and issues only when no API base URL is configured", async () => {
    const { fetchIssues, getReports } = await importClient();

    await expect(getReports("acme")).resolves.not.toHaveLength(0);
    await expect(fetchIssues("acme")).resolves.not.toHaveLength(0);
  });

  it("does not return demo data when configured API lists are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const { fetchIssues, getFindings, getProjects, getReports, getScans } = await importClient("https://api.example.test/");

    await expect(getProjects("acme")).resolves.toEqual([]);
    await expect(getScans("acme")).resolves.toEqual([]);
    await expect(getFindings("acme")).resolves.toEqual([]);
    await expect(getReports("acme")).resolves.toEqual([]);
    await expect(fetchIssues("acme")).resolves.toEqual([]);
  });

  it("list methods include workspace slug URLs and credentials", async () => {
    const fetchMock = vi.fn(async () => jsonDataResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchIssues, getFindings, getProjects, getReports, getScans } = await importClient("https://api.example.test/");

    await expect(getProjects("acme")).resolves.toEqual([]);
    await expect(getScans("acme")).resolves.toEqual([]);
    await expect(fetchIssues("acme", { projectId: "project-1", scanRunId: "run-1" })).resolves.toEqual([]);
    await expect(getFindings("acme")).resolves.toEqual([]);
    await expect(getReports("acme")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/api/workspaces/acme/projects",
      expect.objectContaining({ credentials: "include" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/workspaces/acme/scans",
      expect.objectContaining({ credentials: "include" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/api/workspaces/acme/issues?projectId=project-1&scanRunId=run-1",
      expect.objectContaining({ credentials: "include" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.test/api/workspaces/acme/findings",
      expect.objectContaining({ credentials: "include" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.example.test/api/workspaces/acme/reports",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("maps reports and builds scoped download URLs with explicit workspace slugs", async () => {
    const fetchMock = vi.fn(async () =>
      jsonDataResponse([
        {
          id: "report-1",
          projectId: "project-1",
          scanRunId: "run-1",
          kind: "pdf",
          artifactKey: "reports/report-1.pdf",
          mimeType: "application/pdf"
        }
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getArtifactDownloadUrl, getReportDownloadUrl, getReports } = await importClient("https://api.example.test/");

    await expect(getReports("acme")).resolves.toMatchObject([
      {
        id: "report-1",
        artifactKey: "reports/report-1.pdf",
        sizeBytes: 0,
        status: "ready"
      }
    ]);
    expect(getReportDownloadUrl("acme", "report-1")).toBe(
      "https://api.example.test/api/workspaces/acme/reports/report-1/download"
    );
    expect(getArtifactDownloadUrl("acme", "runs/run-1/screenshot/page.png")).toBe(
      "https://api.example.test/api/workspaces/acme/artifacts/download?key=runs%2Frun-1%2Fscreenshot%2Fpage.png"
    );
  });

  it("maps grouped issues from configured API", async () => {
    const fetchMock = vi.fn(async () =>
      jsonDataResponse([
        {
          id: "issue-1",
          projectId: "project-1",
          scanRunId: "run-1",
          issueKey: "button-name|4.1.2|aside button|/haberler/*|aside|Elementor widget button",
          title: "Buttons must have discernible text",
          severity: "critical",
          source: "axe",
          certainty: "automatic_violation",
          ruleId: "button-name",
          wcagCriteria: "4.1.2",
          description: "Description",
          recommendation: "Add an accessible name.",
          likelyScope: "URL group /haberler/*",
          urlScopeGroup: "/haberler/*",
          componentArea: "aside",
          cmsHint: "Elementor widget button",
          confidence: "medium",
          affectedPages: 183,
          occurrences: 366,
          viewportSummary: "desktop,mobile",
          representativeUrl: "https://example.com/haberler/a",
          representativeSelector: "aside .elementor-widget-button a",
          representativeHtmlSnippet: "<a></a>",
          sampleUrls: ["https://example.com/haberler/a"],
          createdAt: "2026-06-01T00:00:00.000Z"
        }
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchIssues } = await importClient("https://api.example.test/");

    await expect(fetchIssues("acme", { projectId: "project-1" })).resolves.toMatchObject([
      {
        id: "issue-1",
        affectedPages: 183,
        occurrences: 366,
        cmsHint: "Elementor widget button"
      }
    ]);
  });

  it("create methods include workspace slug, credentials, JSON body, and CSRF header", async () => {
    vi.stubGlobal("document", { cookie: "a11yaudit_csrf=csrf-token" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        id: "project-1",
        name: "Municipal Portal",
        url: "https://municipal.example.gov/",
        domain: "municipal.example.gov",
        createdAt: "2026-05-31T00:00:00.000Z",
        openFindings: 0,
        lastScan: null
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        id: "run-1",
        projectId: "project-1",
        url: "https://municipal.example.gov/",
        status: "queued",
        mode: "same_domain_crawl",
        maxPages: 75,
        maxDepth: 3,
        viewports: "desktop",
        pagesQueued: 0,
        pagesScanned: 0,
        findingsTotal: 0,
        createdAt: "2026-05-31T00:00:00.000Z"
      }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { createProject, createScan } = await importClient("https://api.example.test/");

    await expect(createProject("acme", { name: "Municipal Portal", url: "https://municipal.example.gov/" })).resolves.toMatchObject({
      id: "project-1",
      name: "Municipal Portal",
      domain: "municipal.example.gov"
    });
    await expect(createScan("acme", {
      projectId: "project-1",
      url: "https://municipal.example.gov/",
      mode: "same_domain_crawl",
      maxPages: 75,
      maxDepth: 3,
      viewports: ["desktop"]
    })).resolves.toMatchObject({
      id: "run-1",
      mode: "same_domain_crawl",
      maxPages: 75,
      maxDepth: 3,
      viewports: "Desktop"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/api/workspaces/acme/projects",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/workspaces/acme/scans",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
    expect(requestOptions(fetchMock, 0).body).toBe(JSON.stringify({ name: "Municipal Portal", url: "https://municipal.example.gov/" }));
    expect(requestHeaders(fetchMock, 0).get("Content-Type")).toBe("application/json");
    expect(requestHeaders(fetchMock, 0).get("X-CSRF-Token")).toBe("csrf-token");
  });

  it("maps finding evidence artifacts", async () => {
    const fetchMock = vi.fn(async () =>
      jsonDataResponse([
        {
          id: "finding-1",
          projectId: "project-1",
          scanRunId: "run-1",
          pageUrl: "https://municipal.example.gov/",
          ruleId: "button-name",
          title: "Buttons must have discernible text",
          severity: "critical",
          status: "new",
          wcagCriteria: "4.1.2",
          evidence: JSON.stringify([
            {
              kind: "page_screenshot",
              artifactKey: "runs/run-1/screenshot/page.png",
              mimeType: "image/png",
              sizeBytes: 2000
            }
          ])
        }
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getFindings } = await importClient("https://api.example.test/");

    await expect(getFindings("acme")).resolves.toMatchObject([
      {
        id: "finding-1",
        evidenceArtifacts: [
          {
            kind: "page_screenshot",
            artifactKey: "runs/run-1/screenshot/page.png",
            mimeType: "image/png",
            sizeBytes: 2000
          }
        ]
      }
    ]);
  });
});
