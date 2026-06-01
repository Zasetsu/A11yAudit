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

  it("prioritizes nav over aside, form, and main component areas", () => {
    expect(inferComponentArea("nav aside form main a", "<main><form><aside><nav></nav></aside></form></main>")).toBe(
      "nav"
    );
  });

  it("infers Elementor and WordPress hints without requiring them", () => {
    expect(inferCmsHint(".elementor-widget-button a", "<a></a>")).toBe("Elementor widget button");
    expect(inferCmsHint(".content", '<body class="single-post post-template-default"></body>')).toBe(
      "WordPress single post"
    );
    expect(inferCmsHint(".content", "<main></main>")).toBe("none");
  });

  it("uses spec CMS hint labels for nav menu, form, and archive category", () => {
    expect(inferCmsHint(".elementor-widget-nav-menu a", "<nav></nav>")).toBe("Elementor nav menu");
    expect(inferCmsHint(".elementor-widget-form input", "<form></form>")).toBe("Elementor form");
    expect(inferCmsHint(".content", '<body class="archive category category-news"></body>')).toBe(
      "WordPress archive/category"
    );
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

  it("normalizes element signatures in issue keys", () => {
    const first = createIssueKey({
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "Aside   .Elementor-Widget-Button   A",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button"
    });
    const second = createIssueKey({
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "aside .elementor-widget-button a",
      urlScopeGroup: "/haberler/*",
      componentArea: "aside",
      cmsHint: "Elementor widget button"
    });

    expect(first).toBe(second);
  });

  it("uses structured issue keys so delimiters in fields cannot collide", () => {
    const first = createIssueKey({
      ruleId: "rule|one",
      wcagCriteria: ["two"],
      elementSignature: "button",
      urlScopeGroup: "/haberler/*",
      componentArea: "unknown",
      cmsHint: "none"
    });
    const second = createIssueKey({
      ruleId: "rule",
      wcagCriteria: ["one|two"],
      elementSignature: "button",
      urlScopeGroup: "/haberler/*",
      componentArea: "unknown",
      cmsHint: "none"
    });

    expect(first).not.toBe(second);
  });
});

describe("aggregateScanIssues", () => {
  it("keeps desktop and mobile findings on one page scoped to that page", () => {
    const issues = aggregateScanIssues([
      finding({ id: "occurrence-1", pageUrl: "https://example.com/haberler/a#desktop", viewport: "desktop" }),
      finding({ id: "occurrence-2", pageUrl: "https://example.com/haberler/a#mobile", viewport: "mobile" })
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      likelyScope: "single page",
      urlScopeGroup: "/haberler/a",
      affectedPages: 1,
      occurrences: 2,
      viewportSummary: "desktop,mobile",
      confidence: "low"
    });
  });

  it("groups repeated template occurrences into one issue", () => {
    const issues = aggregateScanIssues([
      finding({
        id: "occurrence-1",
        pageUrl: "https://example.com/haberler/a",
        viewport: "desktop",
        fingerprint: "fingerprint-1"
      }),
      finding({
        id: "occurrence-2",
        pageUrl: "https://example.com/haberler/a",
        viewport: "mobile",
        fingerprint: "fingerprint-2"
      }),
      finding({
        id: "occurrence-3",
        pageUrl: "https://example.com/haberler/b",
        viewport: "desktop",
        fingerprint: "fingerprint-3"
      }),
      finding({
        id: "occurrence-4",
        pageUrl: "https://example.com/haberler/b",
        viewport: "mobile",
        fingerprint: "fingerprint-4"
      })
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
      confidence: "low"
    });
    expect(issues[0]).toMatchObject({
      representativeUrl: "https://example.com/haberler/a",
      representativeSelector: "aside .elementor-widget-button a",
      representativeHtmlSnippet: '<aside><div class="elementor-widget-button"><a></a></div></aside>',
      occurrenceFingerprints: ["fingerprint-1", "fingerprint-2", "fingerprint-3", "fingerprint-4"]
    });
    expect(issues[0]?.sampleUrls).toEqual([
      "https://example.com/haberler/a",
      "https://example.com/haberler/b"
    ]);
  });

  it("does not merge null-selector findings with different snippets", () => {
    const issues = aggregateScanIssues([
      finding({
        id: "occurrence-1",
        selector: null,
        htmlSnippet: '<button class="primary"></button>',
        fingerprint: "fingerprint-1"
      }),
      finding({
        id: "occurrence-2",
        selector: null,
        htmlSnippet: '<a class="primary"></a>',
        fingerprint: "fingerprint-2"
      })
    ]);

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.occurrenceFingerprints)).toEqual([["fingerprint-1"], ["fingerprint-2"]]);
  });

  it("does not merge matching path groups across origins", () => {
    const issues = aggregateScanIssues([
      finding({
        id: "occurrence-1",
        pageUrl: "https://example.com/haberler/a",
        fingerprint: "fingerprint-1"
      }),
      finding({
        id: "occurrence-2",
        pageUrl: "https://other.example/haberler/a",
        fingerprint: "fingerprint-2"
      })
    ]);

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.representativeUrl)).toEqual([
      "https://example.com/haberler/a",
      "https://other.example/haberler/a"
    ]);
    expect(issues.map((issue) => issue.urlScopeGroup)).toEqual(["/haberler/a", "/haberler/a"]);
  });
});
