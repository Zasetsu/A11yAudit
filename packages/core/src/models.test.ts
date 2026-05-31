import { describe, expect, it } from "vitest";
import { createFindingFingerprint, DEFAULT_VIEWPORTS } from "./index";

describe("core models", () => {
  it("defines default desktop and mobile viewports", () => {
    expect(DEFAULT_VIEWPORTS).toEqual([
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 }
    ]);
  });

  it("creates stable finding fingerprints from normalized inputs", () => {
    const fingerprint = createFindingFingerprint({
      normalizedUrl: "https://example.gov/search",
      viewport: "mobile",
      ruleId: "button-name",
      wcagCriteria: ["4.1.2"],
      elementSignature: "button|menu-toggle|Open menu"
    });

    expect(fingerprint).toBe("https://example.gov/search|mobile|button-name|4.1.2|button|menu-toggle|Open menu");
  });
});
