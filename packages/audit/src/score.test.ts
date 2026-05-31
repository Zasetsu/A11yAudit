import { describe, expect, it } from "vitest";
import { calculateScore } from "./score.js";

describe("calculateScore", () => {
  it("returns 100 with no findings", () => {
    expect(calculateScore([])).toBe(100);
  });

  it("penalizes higher severity findings more heavily", () => {
    expect(calculateScore([{ severity: "critical" }, { severity: "minor" }])).toBeLessThan(calculateScore([{ severity: "minor" }]));
  });
});
