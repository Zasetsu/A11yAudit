import { describe, expect, it } from "vitest";
import { normalizeAxeImpact, wcagTagsToCriteria } from "./index";

describe("axe normalization", () => {
  it("maps axe impact to A11yAudit severity", () => {
    expect(normalizeAxeImpact("critical")).toBe("critical");
    expect(normalizeAxeImpact("serious")).toBe("serious");
    expect(normalizeAxeImpact("moderate")).toBe("moderate");
    expect(normalizeAxeImpact("minor")).toBe("minor");
    expect(normalizeAxeImpact(null)).toBe("minor");
  });

  it("extracts WCAG criteria from axe tags", () => {
    expect(wcagTagsToCriteria(["wcag412", "cat.name-role-value"])).toEqual(["4.1.2"]);
  });

  it("deduplicates tags, ignores unknown tags, and supports multi-digit criteria", () => {
    expect(wcagTagsToCriteria(["wcag1412", "wcag258", "cat.foo", "wcag1412"])).toEqual(["1.4.12", "2.5.8"]);
  });

  it("sorts criteria numerically by segment", () => {
    expect(wcagTagsToCriteria(["wcag1412", "wcag143", "wcag211"])).toEqual(["1.4.3", "1.4.12", "2.1.1"]);
  });
});
