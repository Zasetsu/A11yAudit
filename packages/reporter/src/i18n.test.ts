import { describe, expect, it } from "vitest";
import { reportStrings, severityLabel, scoreBand, formatReportDate } from "./i18n.js";

describe("report i18n", () => {
  it("provides tr and en strings", () => {
    expect(reportStrings("tr").fixFirst).toBe("Önce bunları düzeltin");
    expect(reportStrings("en").fixFirst).toBe("Fix these first");
  });

  it("labels severity per locale", () => {
    expect(severityLabel("critical", "tr")).toBe("Kritik");
    expect(severityLabel("critical", "en")).toBe("Critical");
  });

  it("bands the score", () => {
    expect(scoreBand(95, "tr").label).toBe("İyi");
    expect(scoreBand(80, "en").label).toBe("Needs Work");
    expect(scoreBand(40, "tr").label).toBe("Zayıf");
  });

  it("formats the date for the locale", () => {
    expect(formatReportDate("2026-06-03T09:00:00.000Z", "tr")).toContain("2026");
  });
});
