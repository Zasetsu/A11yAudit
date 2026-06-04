import { describe, expect, it } from "vitest";
import { getCriterionContent } from "./wcag-content.js";
import { WCAG_22_CRITERIA } from "./wcag.js";

describe("wcag content", () => {
  it("returns Turkish and English content for every covered criterion", () => {
    for (const id of Object.keys(WCAG_22_CRITERIA)) {
      const tr = getCriterionContent(id, "tr");
      const en = getCriterionContent(id, "en");
      expect(tr, `tr content for ${id}`).not.toBeNull();
      expect(en, `en content for ${id}`).not.toBeNull();
      expect(tr!.userImpact.length).toBeGreaterThan(0);
      expect(tr!.howToFix.length).toBeGreaterThan(0);
      expect(tr!.w3cUrl).toMatch(/^https:\/\/www\.w3\.org\//);
    }
  });

  it("returns null for an unknown criterion", () => {
    expect(getCriterionContent("9.9.9", "tr")).toBeNull();
  });
});
