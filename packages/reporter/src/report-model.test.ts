import { describe, expect, it } from "vitest";
import type { ScanFinding } from "@a11yaudit/core";
import { buildReportProblems } from "./report-model.js";

function finding(over: Partial<ScanFinding>): ScanFinding {
  return {
    id: "f-1", title: "Buttons must have discernible text", severity: "critical",
    status: "new", source: "axe", certainty: "automatic_violation", origin: "unknown",
    wcagCriteria: ["4.1.2"], ruleId: "button-name", description: "d", recommendation: "r",
    pageUrl: "https://x/", viewport: "desktop", selector: "button.nav", htmlSnippet: "<button class=\"nav\"></button>",
    visibleText: null, helpUrl: null, fingerprint: "fp-1", evidence: [], instances: 1, ...over
  };
}

describe("buildReportProblems", () => {
  it("groups findings of the same rule into one problem with all elements", () => {
    const problems = buildReportProblems([
      finding({ id: "f-1", selector: "button.a", fingerprint: "a" }),
      finding({ id: "f-2", selector: "button.b", fingerprint: "b", pageUrl: "https://x/about" })
    ], "tr", new Map());

    expect(problems).toHaveLength(1);
    expect(problems[0].ruleId).toBe("button-name");
    expect(problems[0].elements).toHaveLength(2);
    expect(problems[0].occurrences).toBe(2);
    expect(problems[0].affectedPages).toBe(2);
    expect(problems[0].criterion?.id).toBe("4.1.2");
    expect(problems[0].criterion?.content.howToFix.length).toBeGreaterThan(0);
  });

  it("sorts problems by severity rank then occurrences", () => {
    const problems = buildReportProblems([
      finding({ ruleId: "minor-rule", severity: "minor", fingerprint: "m" }),
      finding({ ruleId: "crit-rule", severity: "critical", fingerprint: "c" })
    ], "en", new Map());
    expect(problems[0].ruleId).toBe("crit-rule");
  });

  it("embeds the element crop data uri and does NOT inline a page screenshot", () => {
    const cropped = finding({
      evidence: [{ kind: "element_screenshot", artifactKey: "crop1", mimeType: "image/png", sizeBytes: 1 }]
    });
    const pageOnly = finding({
      ruleId: "other-rule", fingerprint: "p",
      evidence: [{ kind: "page_screenshot", artifactKey: "k1", mimeType: "image/png", sizeBytes: 1 }]
    });
    const problems = buildReportProblems(
      [cropped, pageOnly],
      "tr",
      new Map([["crop1", "data:image/png;base64,CROP"], ["k1", "data:image/png;base64,PAGE"]])
    );
    const byRule = new Map(problems.map((p) => [p.ruleId, p]));
    expect(byRule.get("button-name")!.elements[0].screenshotDataUri).toBe("data:image/png;base64,CROP");
    // a page-screenshot-only finding is NOT inlined (would bloat the report)
    expect(byRule.get("other-rule")!.elements[0].screenshotDataUri).toBeNull();
  });
});
