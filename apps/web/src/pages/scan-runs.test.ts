import { describe, expect, it } from "vitest";
import { scanProgressLabel, scanProgressTone, scanProgressValue, scanRunMessage, scanRunMessageClass } from "./scan-runs";
import { MESSAGES } from "../i18n/messages.js";
import type { ScanRun } from "../data";

const t = (<K extends keyof typeof MESSAGES.en>(key: K) => MESSAGES.en[key]);

function scan(overrides: Partial<ScanRun>): ScanRun {
  return {
    id: "run-1",
    projectId: "project-1",
    projectName: "Project",
    url: "https://example.com",
    status: "completed",
    mode: "single_url",
    maxPages: 1,
    maxDepth: 0,
    viewports: "Desktop + mobile",
    trigger: "Manual",
    pagesQueued: 10,
    pagesScanned: 10,
    findingsTotal: 0,
    score: 100,
    createdAt: "2026-05-31T00:00:00.000Z",
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:01:00.000Z",
    errorMessage: null,
    ...overrides
  };
}

describe("scan run presentation", () => {
  it("shows failed scan progress as failed instead of completed", () => {
    const failed = scan({
      status: "failed",
      pagesQueued: 102,
      pagesScanned: 102,
      errorMessage: "too many SQL variables"
    });

    expect(scanProgressValue(failed)).toBe(100);
    expect(scanProgressTone(failed)).toBe("var(--critical)");
    expect(scanProgressLabel(failed, t)).toBe("Failed after 102/102 pages");
    expect(scanRunMessageClass(failed)).toBe("error-text");
    expect(scanRunMessage(failed)).toBe("too many SQL variables");
  });

  it("shows completed report generation warnings without marking progress failed", () => {
    const completedWithWarning = scan({
      status: "completed",
      errorMessage: "PDF report failed: page.pdf: Protocol error (Page.printToPDF): Printing failed"
    });

    expect(scanProgressValue(completedWithWarning)).toBe(100);
    expect(scanProgressTone(completedWithWarning)).toBe("var(--accent)");
    expect(scanProgressLabel(completedWithWarning, t)).toBe("10/10 pages");
    expect(scanRunMessageClass(completedWithWarning)).toBe("warning-text");
    expect(scanRunMessage(completedWithWarning)).toContain("PDF report failed");
  });
});
