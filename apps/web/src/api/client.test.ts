import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

async function importClient(apiBaseUrl?: string, workspaceSlug?: string) {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (apiBaseUrl !== undefined) {
    vi.stubEnv("VITE_A11YAUDIT_API_BASE_URL", apiBaseUrl);
  }
  if (workspaceSlug !== undefined) {
    vi.stubEnv("VITE_A11YAUDIT_WORKSPACE_SLUG", workspaceSlug);
  }

  return import("./client");
}

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses demo reports only when no API base URL is configured", async () => {
    const { getReports } = await importClient();

    await expect(getReports()).resolves.not.toHaveLength(0);
  });

  it("uses demo issues only when no API base URL is configured", async () => {
    const { fetchIssues } = await importClient();

    await expect(fetchIssues()).resolves.not.toHaveLength(0);
  });

  it("does not return demo reports when configured API reports are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { getReports } = await importClient("https://api.example.test/");

    await expect(getReports()).resolves.toEqual([]);
  });

  it("does not return demo dashboard data when configured API lists are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const { getFindings, getProjects, getScans } = await importClient("https://api.example.test/");

    await expect(getProjects()).resolves.toEqual([]);
    await expect(getScans()).resolves.toEqual([]);
    await expect(getFindings()).resolves.toEqual([]);
  });

  it("requests projects from the current workspace route", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { getProjects } = await importClient("https://api.example.test/", "owner-workspace");

    await expect(getProjects()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/workspaces/owner-workspace/projects",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("requests scans from the current workspace route", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { getScans } = await importClient("https://api.example.test/", "owner-workspace");

    await expect(getScans()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/workspaces/owner-workspace/scans",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("maps configured API reports when available", async () => {
    const fetchMock = vi.fn(async () =>
        jsonResponse([
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
    const { getReports } = await importClient("https://api.example.test/", "owner-workspace");

    await expect(getReports()).resolves.toMatchObject([
      {
        id: "report-1",
        artifactKey: "reports/report-1.pdf",
        sizeBytes: 0,
        status: "ready"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/workspaces/owner-workspace/reports",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("builds scoped report download URLs from the current workspace", async () => {
    const { getReportDownloadUrl } = await importClient("https://api.example.test/", "owner-workspace");

    expect(getReportDownloadUrl("report-1")).toBe(
      "https://api.example.test/api/workspaces/owner-workspace/reports/report-1/download"
    );
  });

  it("maps grouped issues from configured API", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([
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

    await expect(fetchIssues({ projectId: "project-1" })).resolves.toMatchObject([
      {
        id: "issue-1",
        affectedPages: 183,
        occurrences: 366,
        cmsHint: "Elementor widget button"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/issues?projectId=project-1",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("requests grouped issues with project and scan filters", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchIssues } = await importClient("https://api.example.test/");

    await expect(fetchIssues({ projectId: "project-1", scanRunId: "run-1" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/issues?projectId=project-1&scanRunId=run-1",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("requests grouped issues with scan filters", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchIssues } = await importClient("https://api.example.test/");

    await expect(fetchIssues({ scanRunId: "run-1" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/issues?scanRunId=run-1",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("does not fabricate required grouped issue fields for malformed API rows", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([{}])));
    const { fetchIssues } = await importClient("https://api.example.test/");

    await expect(fetchIssues({ projectId: "project-1" })).resolves.toEqual([]);
  });

  it("creates projects against the configured API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "project-1",
          name: "Municipal Portal",
          url: "https://municipal.example.gov/",
          domain: "municipal.example.gov",
          createdAt: "2026-05-31T00:00:00.000Z",
          openFindings: 0,
          lastScan: null
        }),
        { headers: { "content-type": "application/json" }, status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createProject } = await importClient("https://api.example.test/", "owner-workspace");

    await expect(createProject({ name: "Municipal Portal", url: "https://municipal.example.gov/" })).resolves.toMatchObject({
      id: "project-1",
      name: "Municipal Portal",
      domain: "municipal.example.gov"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/workspaces/owner-workspace/projects",
      expect.objectContaining({
        body: JSON.stringify({ name: "Municipal Portal", url: "https://municipal.example.gov/" }),
        method: "POST"
      })
    );
  });

  it("passes CLI-equivalent scan options to the configured API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
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
        }),
        { headers: { "content-type": "application/json" }, status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createScan } = await importClient("https://api.example.test/", "owner-workspace");

    await expect(
      createScan({
        projectId: "project-1",
        url: "https://municipal.example.gov/",
        mode: "same_domain_crawl",
        maxPages: 75,
        maxDepth: 3,
        viewports: ["desktop"]
      })
    ).resolves.toMatchObject({
      id: "run-1",
      mode: "same_domain_crawl",
      maxPages: 75,
      maxDepth: 3,
      viewports: "Desktop"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/workspaces/owner-workspace/scans",
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          url: "https://municipal.example.gov/",
          mode: "same_domain_crawl",
          maxPages: 75,
          maxDepth: 3,
          viewports: ["desktop"]
        }),
        method: "POST"
      })
    );
  });

  it("maps finding evidence artifacts and exposes artifact download URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
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
      )
    );
    const { getArtifactDownloadUrl, getFindings } = await importClient("https://api.example.test/", "owner-workspace");

    await expect(getFindings()).resolves.toMatchObject([
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
    expect(getArtifactDownloadUrl("runs/run-1/screenshot/page.png")).toBe(
      "https://api.example.test/api/workspaces/owner-workspace/artifacts/download?key=runs%2Frun-1%2Fscreenshot%2Fpage.png"
    );
  });
});
