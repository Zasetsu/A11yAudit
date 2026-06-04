import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../data";
import { MESSAGES } from "../i18n/messages.js";

const t = <K extends keyof typeof MESSAGES.en>(key: K) => MESSAGES.en[key];

function report(overrides: Partial<Report>): Report {
  return {
    id: "report-html",
    projectId: "project-1",
    scanRunId: "run-1",
    kind: "html",
    artifactKey: "runs/run-1/report/audit-report.html",
    mimeType: "text/html",
    sizeBytes: 1024,
    createdAt: "2026-05-31T00:00:00.000Z",
    projectName: "Project",
    status: "ready",
    ...overrides
  };
}

describe("report presentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("allows ready HTML reports to use the normal report download endpoint", async () => {
    vi.stubEnv("VITE_A11YAUDIT_API_BASE_URL", "https://api.example.test/");
    vi.stubEnv("VITE_A11YAUDIT_WORKSPACE_SLUG", "owner-workspace");
    const { reportActionLabel, reportDownloadTitle, reportDownloadUrl } = await import("./reports");
    const html = report({ id: "report-html", kind: "html", mimeType: "text/html" });

    expect(reportActionLabel(html)).toBe("HTML");
    expect(reportDownloadUrl(html, "owner-workspace")).toBe("https://api.example.test/api/workspaces/owner-workspace/reports/report-html/download");
    expect(reportDownloadTitle(html, t)).toBe("Download HTML report");
  });

  it("keeps generating reports disabled", async () => {
    vi.stubEnv("VITE_A11YAUDIT_API_BASE_URL", "https://api.example.test/");
    const { reportDownloadTitle, reportDownloadUrl } = await import("./reports");
    const generating = report({ kind: "pdf", mimeType: "application/pdf", status: "generating" });

    expect(reportDownloadUrl(generating, "owner-workspace")).toBeNull();
    expect(reportDownloadTitle(generating, t)).toBe("PDF report is still generating");
  });
});
