import { describe, expect, it } from "vitest";
import { buildAuditReportModel, renderReportHtml } from "./index.js";

describe("renderReportHtml", () => {
  it("renders report sections and disclaimer", () => {
    const html = renderReportHtml({
      projectName: "Example Portal",
      domain: "example.gov",
      score: 74,
      pagesAudited: 248,
      findingsTotal: 613,
      uniqueIssues: 0,
      totalOccurrences: 0,
      generatedAt: "2026-05-31T09:14:00.000Z",
      findings: [],
      issues: [],
      pages: [],
      targetUrl: "https://example.gov",
      mode: "same_domain_crawl"
    });

    expect(html).toContain("Accessibility Audit Report");
    expect(html).toContain("Example Portal");
    expect(html).toContain("does not certify legal compliance");
  });
});

describe("real report rendering", () => {
  it("renders executive summary, grouped issues, raw appendix, and honesty disclaimer", () => {
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
      generatedAt: "2026-05-31T00:00:00.000Z"
    });

    const html = renderReportHtml(report);
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Audit Scope");
    expect(html).toContain("Severity Summary");
    expect(html).toContain("Grouped Issues");
    expect(html).toContain("Raw Occurrence Appendix");
    expect(html).toContain("Evidence Appendix");
    expect(html).toContain("Manual Review Notice");
    expect(html).toContain("Images must have alternate text");
    expect(html).toContain("runs/run-1/snippets/finding-1.txt");
    expect(html).toContain("does not certify legal compliance");
  });

  it("renders grouped issues before raw occurrence details", () => {
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
      generatedAt: "2026-05-31T00:00:00.000Z"
    });

    const html = renderReportHtml(report);

    expect(html).toContain("Unique Issues");
    expect(html).toContain("Affected Pages");
    expect(html).toContain("Total Occurrences");
    expect(html).toContain("Issue");
    expect(html).toContain("Severity");
    expect(html).toContain("WCAG");
    expect(html).toContain("Likely Scope");
    expect(html).toContain("Component Area");
    expect(html).toContain("CMS Hint");
    expect(html).toContain("Occurrences");
    expect(html).toContain("Sample URLs");
    expect(html).toContain("Recommendation");
    expect(html).toContain("Elementor widget button");
    expect(html).toContain("single page (low)");
    expect(html.indexOf("Grouped Issues")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Raw Occurrence Appendix")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Grouped Issues")).toBeLessThan(html.indexOf("Raw Occurrence Appendix"));
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
      generatedAt: "2026-05-31T00:00:00.000Z"
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
      generatedAt: "2026-05-31T00:00:00.000Z"
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
      generatedAt: "2026-05-31T00:00:00.000Z"
    });

    const html = renderReportHtml(report);
    expect(html).toContain("found 1 unique issue across 2 occurrences");
    expect(html).toMatch(/<tr>\s*<td>1<\/td>\s*<td>0<\/td>\s*<td>0<\/td>\s*<td>0<\/td>\s*<\/tr>/);
  });

  it("renders grouped issue likely scope with confidence", () => {
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
      generatedAt: "2026-05-31T00:00:00.000Z"
    });

    const html = renderReportHtml(report);
    expect(html).toContain("URL group /haberler/* (medium)");
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
      generatedAt: "2026-05-31T00:00:00.000Z"
    });

    const html = renderReportHtml(report, {
      maxDetailedFindings: 10,
      maxEvidenceRows: 5
    });

    expect(html).toContain("found 25 unique issues across 25 occurrences");
    expect(html).toContain("Showing 10 of 25 grouped issues");
    expect(html).toContain("15 additional grouped issues are summarized in the issue totals");
    expect(html).toContain("Showing 10 of 25 raw occurrences");
    expect(html).toContain("15 additional raw occurrences are summarized in the issue and severity totals");
    expect(html).toContain("Showing 5 of 25 evidence artifacts");
    expect(html).toContain("Finding 9");
    expect(html).not.toContain("Finding 10");
    expect(html).toContain("runs/run-large/snippets/finding-4.txt");
    expect(html).not.toContain("runs/run-large/snippets/finding-5.txt");
  });
});
