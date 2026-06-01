import { describe, expect, it } from "vitest";
import {
  aggregateScanIssues,
  createIssueKey,
  inferCmsHint,
  inferComponentArea,
  inferUrlScope
} from "./issues.js";
import type { ScanFinding } from "./models.js";

function finding(overrides: Partial<ScanFinding>): ScanFinding {
  return {
    id: "finding-1",
    title: "Buttons must have discernible text",
    severity: "critical",
    status: "new",
    source: "axe",
    certainty: "automatic_violation",
    origin: "unknown",
    wcagCriteria: ["4.1.2"],
    ruleId: "button-name",
    description: "Ensures buttons have discernible text",
    recommendation: "Add an accessible name.",
    pageUrl: "https://example.com/haberler/a",
    viewport: "desktop",
    selector: "aside .elementor-widget-button a",
    htmlSnippet: '<aside><div class="elementor-widget-button"><a></a></div></aside>',
    visibleText: null,
    helpUrl: "https://dequeuniversity.com/rules/axe/button-name",
    fingerprint: "raw-fingerprint",
    evidence: [],
    instances: 1,
    ...overrides
  };
}

describe("issue inference", () => {
  it("infers first-segment URL groups", () => {
    expect(inferUrlScope("https://example.com/haberler/a", 5)).toEqual({
      scope: "URL group /haberler/*",
      groupKey: "/haberler/*"
    });
    expect(inferUrlScope("https://example.com/", 5)).toEqual({
      scope: "global",
      groupKey: "/"
    });
    expect(inferUrlScope("https://example.com/iletisim", 1)).toEqual({
      scope: "single page",
      groupKey: "/iletisim"
    });
  });

  it("infers component area from selector and html snippet", () => {
    expect(inferComponentArea("header nav button", "<button></button>")).toBe("header");
    expect(inferComponentArea(".sidebar a", "<aside><a></a></aside>")).toBe("aside");
    expect(inferComponentArea(".cta a", "<a></a>")).toBe("unknown");
  });

  it("infers Elementor and WordPress hints without requiring them", () => {
    expect(inferCmsHint(".elementor-widget-button a", "<a></a>")).toBe("Elementor widget button");
    expect(inferCmsHint(".content", '<body class="single-post post-template-default"></body>')).toBe(
      "WordPress single post"
    );
    expect(inferCmsHint(".content", "<main></main>")).toBe("none");
  });

  it("creates issue keys without full URL or viewport", () => {
    const desktop = createIssueKey({
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "aside .elementor-widget-button a",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button"
    });
    const mobile = createIssueKey({
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "aside .elementor-widget-button a",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button"
    });

    expect(desktop).toBe(mobile);
    expect(desktop).not.toContain("https://example.com/haberler/a");
    expect(desktop).not.toContain("desktop");
  });
});

describe("aggregateScanIssues", () => {
  it("groups repeated template occurrences into one issue", () => {
    const issues = aggregateScanIssues([
      finding({ id: "occurrence-1", pageUrl: "https://example.com/haberler/a", viewport: "desktop" }),
      finding({ id: "occurrence-2", pageUrl: "https://example.com/haberler/a", viewport: "mobile" }),
      finding({ id: "occurrence-3", pageUrl: "https://example.com/haberler/b", viewport: "desktop" }),
      finding({ id: "occurrence-4", pageUrl: "https://example.com/haberler/b", viewport: "mobile" })
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: "Buttons must have discernible text",
      likelyScope: "URL group /haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button",
      affectedPages: 2,
      occurrences: 4,
      viewportSummary: "desktop,mobile",
      confidence: "medium"
    });
    expect(issues[0]?.sampleUrls).toEqual([
      "https://example.com/haberler/a",
      "https://example.com/haberler/b"
    ]);
  });
});
