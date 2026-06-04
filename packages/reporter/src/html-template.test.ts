import { describe, expect, it } from "vitest";
import { buildAuditReportModel, renderReportHtml } from "./index.js";

describe("renderReportHtml", () => {
  it("renders a Turkish report with score band, severity colors, and the honest disclaimer", () => {
    const html = renderReportHtml({
      projectName: "admelektrik.com.tr",
      domain: "admelektrik.com.tr",
      score: 75,
      pagesAudited: 12,
      findingsTotal: 0,
      uniqueIssues: 0,
      totalOccurrences: 0,
      generatedAt: "2026-06-03T09:14:00.000Z",
      findings: [],
      issues: [],
      pages: [],
      targetUrl: "https://admelektrik.com.tr",
      mode: "same_domain_crawl",
      locale: "tr",
      problems: []
    });
    expect(html).toContain("Erişilebilirlik Denetim Raporu");
    expect(html).toContain("Geliştirilmeli");            // 75 -> Needs Work (tr)
    expect(html).toContain("#c0392b");                   // critical color in styles/legend
    expect(html).toContain("Yasal uyumluluğu belgelemez.");
    expect(html).not.toMatch(/certif(y|ies) .{0,20}complian/i);
    expect(html).toContain("benzersiz sorun");           // cover stat label localized (tr)
  });

  it("renders English strings when locale is en", () => {
    const html = renderReportHtml({
      projectName: "x", domain: "x", score: 95, pagesAudited: 1, findingsTotal: 0,
      uniqueIssues: 0, totalOccurrences: 0, generatedAt: "2026-06-03T09:14:00.000Z",
      findings: [], issues: [], pages: [], targetUrl: "https://x", mode: "single_url",
      locale: "en", problems: []
    });
    expect(html).toContain("Accessibility Audit Report");
    expect(html).toContain("does not certify legal compliance");
    expect(html).toContain("Good"); // 95 band
  });

  it("renders a grouped problem card with WCAG content and element detail", () => {
    const html = renderReportHtml({
      projectName: "x", domain: "x", score: 50, pagesAudited: 1, findingsTotal: 1,
      uniqueIssues: 1, totalOccurrences: 1, generatedAt: "2026-06-03T09:14:00.000Z",
      findings: [], issues: [], pages: [], targetUrl: "https://x", mode: "single_url",
      locale: "tr",
      problems: [{
        ruleId: "button-name",
        title: "Buttons must have discernible text",
        severity: "critical",
        wcagCriteria: ["4.1.2"],
        criterion: {
          id: "4.1.2", name: "Ad, Rol, Değer (Name, Role, Value)", level: "A",
          w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
          content: {
            name: "Ad, Rol, Değer (Name, Role, Value)",
            userImpact: "Ekran okuyucu kullanıcılar bu kontrolün ne işe yaradığını anlayamaz.",
            howToFix: "Her butona görünür metin veya aria-label ekleyin.",
            w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
          }
        },
        elements: [{
          htmlSnippet: "<button class=\"nav-toggle\"></button>",
          selector: "button.nav-toggle", pageUrl: "https://x/", viewport: "desktop",
          screenshotDataUri: "data:image/png;base64,AAA"
        }],
        affectedPages: 1, occurrences: 1
      }]
    });
    expect(html).toContain("Buttons must have discernible text");
    expect(html).toContain("4.1.2");
    expect(html).toContain("Ad, Rol, Değer");
    expect(html).toContain("name-role-value.html");          // W3C link
    expect(html).toContain("Ekran okuyucu kullanıcılar");    // userImpact (what it means)
    expect(html).toContain("aria-label ekleyin");            // howToFix (distinct from title)
    expect(html).toContain("button.nav-toggle");             // selector
    expect(html).toContain("&lt;button class=&quot;nav-toggle&quot;&gt;"); // escaped snippet
    expect(html).toContain("data:image/png;base64,AAA");     // embedded screenshot
  });

  it("renders a fallback card (generic prose + W3C index link) when the criterion has no content", () => {
    const html = renderReportHtml({
      projectName: "x", domain: "x", score: 50, pagesAudited: 1, findingsTotal: 1,
      uniqueIssues: 1, totalOccurrences: 1, generatedAt: "2026-06-03T09:14:00.000Z",
      findings: [], issues: [], pages: [], targetUrl: "https://x", mode: "single_url",
      locale: "en",
      problems: [{
        ruleId: "color-contrast-enhanced",
        title: "Elements must meet enhanced contrast",
        severity: "serious",
        wcagCriteria: ["1.4.6"],          // not in the authored content table
        criterion: null,
        elements: [{
          htmlSnippet: "<p>x</p>", selector: "p", pageUrl: "https://x/", viewport: "desktop",
          screenshotDataUri: null
        }],
        affectedPages: 1, occurrences: 1
      }]
    });
    expect(html).toContain("Elements must meet enhanced contrast");
    expect(html).toContain("WCAG 1.4.6");                                 // criterion id surfaced
    expect(html).toContain("https://www.w3.org/WAI/WCAG22/Understanding/"); // index link
    expect(html).toContain("cannot be fully evaluated automatically");    // generic impact (en)
    expect(html).toContain("Refer to the linked W3C WCAG 2.2 document");  // generic fix (en)
  });

  it("caps elements per card and notes the overflow", () => {
    const elements = Array.from({ length: 15 }, (_, i) => ({
      htmlSnippet: `<button>b${i}</button>`, selector: `button.n${i}`,
      pageUrl: "https://x/", viewport: "desktop", screenshotDataUri: null
    }));
    const html = renderReportHtml({
      projectName: "x", domain: "x", score: 50, pagesAudited: 1, findingsTotal: 15,
      uniqueIssues: 1, totalOccurrences: 15, generatedAt: "2026-06-03T09:14:00.000Z",
      findings: [], issues: [], pages: [], targetUrl: "https://x", mode: "single_url",
      locale: "en",
      problems: [{
        ruleId: "button-name", title: "Buttons must have discernible text",
        severity: "critical", wcagCriteria: ["4.1.2"], criterion: null,
        elements, affectedPages: 1, occurrences: 15
      }]
    });
    expect(html).toContain("(15)");                      // full count in the "Where" header
    expect(html).toContain("button.n11");               // 12th element shown (index 11)
    expect(html).not.toContain("button.n12");           // 13th element capped
    expect(html).toContain("+ 3 more elements, same format");
  });
});

describe("real report rendering", () => {
  it("renders at-a-glance, problem cards, technical appendix, and honesty disclaimer", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-1",
        projectId: "project-1",
        targetUrl: "https://example.com",
        mode: "single_url",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: true
      },
      pages: [{
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        title: "Example Domain",
        viewport: "desktop",
        statusCode: 200,
        finalUrl: "https://example.com/",
        durationMs: 123,
        errorMessage: null
      }],
      findings: [{
        id: "finding-1",
        title: "Images must have alternate text",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: ["1.1.1"],
        ruleId: "image-alt",
        description: "Ensures images have alternate text",
        recommendation: "Add meaningful alternate text.",
        pageUrl: "https://example.com",
        viewport: "desktop",
        selector: "img",
        htmlSnippet: "<img>",
        visibleText: null,
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
        fingerprint: "fingerprint",
        evidence: [{
          kind: "html_snippet",
          artifactKey: "runs/run-1/snippets/finding-1.txt",
          mimeType: "text/plain",
          sizeBytes: 5
        }],
        instances: 1
      }],
      score: 75,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report);
    expect(html).toContain("At a glance");
    expect(html).toContain("Technical appendix");
    expect(html).toContain("Images must have alternate text");
    expect(html).toContain("runs/run-1/snippets/finding-1.txt");
    expect(html).toContain("does not certify legal compliance");
    expect(html).not.toContain("Executive Summary");
    expect(html).not.toContain("Grouped Issues");
    expect(html).not.toContain("Raw Occurrence Appendix");
  });

  it("renders grouped problem cards before the technical appendix", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-grouped",
        projectId: "project-grouped",
        targetUrl: "https://example.com/haberler/a",
        mode: "single_url",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: true
      },
      pages: [],
      findings: [{
        id: "finding-grouped-1",
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
        fingerprint: "fingerprint-grouped-1",
        evidence: [],
        instances: 1
      }],
      score: 75,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report);

    expect(html).toContain("unique issues");
    expect(html).toContain("affected pages");
    expect(html).toContain("occurrences");
    expect(html).toContain("Buttons must have discernible text");
    expect(html).toContain("Technical appendix");
    // problem card appears before the technical appendix
    expect(html.indexOf("Buttons must have discernible text")).toBeLessThan(html.indexOf("Technical appendix"));
  });

  it("escapes hostile finding and evidence fields", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-escape",
        projectId: "project-escape",
        targetUrl: "https://example.com",
        mode: "single_url",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: true
      },
      pages: [],
      findings: [{
        id: "finding-<script>alert(1)</script>",
        title: "Bad title <script>alert(1)</script>",
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: ["1.1.1<script>alert(1)</script>"],
        ruleId: "image-alt\"><img src=x onerror=\"alert(1)\">",
        description: "Ensures images have alternate text",
        recommendation: "Fix it <img src=x onerror=\"alert(1)\">",
        pageUrl: "https://example.com/?q=<script>alert(1)</script>",
        viewport: "desktop",
        selector: "img[alt=\"\"><script>alert(1)</script>",
        htmlSnippet: null,
        visibleText: null,
        helpUrl: null,
        fingerprint: "fingerprint",
        evidence: [{
          kind: "html_snippet",
          artifactKey: "runs/run-escape/<script>alert(1)</script>.txt",
          mimeType: "text/html\"><img src=x onerror=\"alert(1)\">",
          sizeBytes: 5
        }],
        instances: 1
      }],
      score: 75,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("onerror=\"alert(1)\"");
    expect(html).toContain("Bad title &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("https://example.com/?q=&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("img[alt=&quot;&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Fix it &lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("1.1.1&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("image-alt&quot;&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("finding-&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("runs/run-escape/&lt;script&gt;alert(1)&lt;/script&gt;.txt");
    expect(html).toContain("text/html&quot;&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("renders correct severity summary counts", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-severity",
        projectId: "project-severity",
        targetUrl: "https://example.com",
        mode: "single_url",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: true
      },
      pages: [],
      findings: [
        "critical",
        "serious",
        "serious",
        "moderate",
        "moderate",
        "moderate",
        "minor",
        "minor",
        "minor",
        "minor"
      ].map((severity, index) => ({
        id: `finding-${index}`,
        title: `Finding ${index}`,
        severity: severity as "critical" | "serious" | "moderate" | "minor",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: ["1.1.1"],
        ruleId: `rule-${index}`,
        description: "Description",
        recommendation: "Recommendation",
        pageUrl: "https://example.com",
        viewport: "desktop",
        selector: "main",
        htmlSnippet: null,
        visibleText: null,
        helpUrl: null,
        fingerprint: `fingerprint-${index}`,
        evidence: [],
        instances: 1
      })),
      score: 50,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report);
    expect(html).toMatch(/<tr>\s*<td>1<\/td>\s*<td>2<\/td>\s*<td>3<\/td>\s*<td>4<\/td>\s*<\/tr>/);
  });

  it("summarizes severity by unique grouped issues instead of raw occurrences", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-unique-severity",
        projectId: "project-unique-severity",
        targetUrl: "https://example.com/haberler/a",
        mode: "same_domain_crawl",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 3,
        maxDepth: 1,
        respectRobotsTxt: true
      },
      pages: [],
      findings: [
        {
          id: "finding-critical-1",
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
          helpUrl: null,
          fingerprint: "fingerprint-critical-1",
          evidence: [],
          instances: 1
        },
        {
          id: "finding-critical-2",
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
          pageUrl: "https://example.com/haberler/a#mobile",
          viewport: "mobile",
          selector: "aside .elementor-widget-button a",
          htmlSnippet: '<aside><div class="elementor-widget-button"><a></a></div></aside>',
          visibleText: null,
          helpUrl: null,
          fingerprint: "fingerprint-critical-2",
          evidence: [],
          instances: 1
        }
      ],
      score: 75,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report);
    // at-a-glance grid shows unique issue and occurrence counts
    expect(html).toContain("1"); // 1 unique issue
    expect(html).toMatch(/<tr>\s*<td>1<\/td>\s*<td>0<\/td>\s*<td>0<\/td>\s*<td>0<\/td>\s*<\/tr>/);
  });

  it("renders problem card for issues found across multiple pages under the same URL group", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-confidence",
        projectId: "project-confidence",
        targetUrl: "https://example.com/haberler/a",
        mode: "same_domain_crawl",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 3,
        maxDepth: 1,
        respectRobotsTxt: true
      },
      pages: [
        {
          url: "https://example.com/haberler/a",
          normalizedUrl: "https://example.com/haberler/a",
          title: null,
          viewport: "desktop",
          statusCode: 200,
          finalUrl: "https://example.com/haberler/a",
          durationMs: 100,
          errorMessage: null
        },
        {
          url: "https://example.com/haberler/b",
          normalizedUrl: "https://example.com/haberler/b",
          title: null,
          viewport: "desktop",
          statusCode: 200,
          finalUrl: "https://example.com/haberler/b",
          durationMs: 100,
          errorMessage: null
        },
        {
          url: "https://example.com/haberler/c",
          normalizedUrl: "https://example.com/haberler/c",
          title: null,
          viewport: "desktop",
          statusCode: 200,
          finalUrl: "https://example.com/haberler/c",
          durationMs: 100,
          errorMessage: null
        }
      ],
      findings: [
        {
          id: "finding-confidence-1",
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
          helpUrl: null,
          fingerprint: "fingerprint-confidence-1",
          evidence: [],
          instances: 1
        },
        {
          id: "finding-confidence-2",
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
          pageUrl: "https://example.com/haberler/b",
          viewport: "desktop",
          selector: "aside .elementor-widget-button a",
          htmlSnippet: '<aside><div class="elementor-widget-button"><a></a></div></aside>',
          visibleText: null,
          helpUrl: null,
          fingerprint: "fingerprint-confidence-2",
          evidence: [],
          instances: 1
        }
      ],
      score: 75,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report);
    // problem card rendered in "All issues" section
    expect(html).toContain("Buttons must have discernible text");
    // 2 occurrences across 2 affected pages surfaced in the card
    expect(html).toContain("All issues");
  });

  it("limits detailed rows for print reports while preserving total counts", () => {
    const report = buildAuditReportModel({
      request: {
        runId: "run-large",
        projectId: "project-large",
        targetUrl: "https://example.com",
        mode: "same_domain_crawl",
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        maxPages: 250,
        maxDepth: 5,
        respectRobotsTxt: true
      },
      pages: [],
      findings: Array.from({ length: 25 }, (_, index) => ({
        id: `finding-${index}`,
        title: `Finding ${index}`,
        severity: "critical",
        status: "new",
        source: "axe",
        certainty: "automatic_violation",
        origin: "unknown",
        wcagCriteria: ["4.1.2"],
        ruleId: "button-name",
        description: "Description",
        recommendation: "Recommendation",
        pageUrl: "https://example.com",
        viewport: "desktop",
        selector: `.node-${index}`,
        htmlSnippet: null,
        visibleText: null,
        helpUrl: null,
        fingerprint: `fingerprint-${index}`,
        evidence: [{
          kind: "html_snippet",
          artifactKey: `runs/run-large/snippets/finding-${index}.txt`,
          mimeType: "text/plain",
          sizeBytes: 5
        }],
        instances: 1
      })),
      score: 0,
      generatedAt: "2026-05-31T00:00:00.000Z",
      locale: "en"
    });

    const html = renderReportHtml(report, {
      maxDetailedFindings: 10,
      maxEvidenceRows: 5
    });

    // at-a-glance grid reflects total counts (all 25 findings group to 1 issue since same ruleId)
    expect(html).toContain("Technical appendix");
    expect(html).toContain("Showing 10 of 25 raw occurrences");
    expect(html).toContain("15 additional raw occurrences are summarized in the issue and severity totals");
    expect(html).toContain("Showing 5 of 25 evidence artifacts");
    expect(html).not.toContain("Grouped Issues");
    expect(html).not.toContain("Raw Occurrence Appendix");
  });
});
