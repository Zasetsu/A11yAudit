import { describe, expect, it } from "vitest";
import { WIDGET_MESSAGES, WIDGET_CONTROL_KEYS } from "./messages.js";

describe("widget messages", () => {
  it("defines every control label in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      for (const key of WIDGET_CONTROL_KEYS) {
        expect(WIDGET_MESSAGES[locale].controls[key], `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it("has matching control key sets across locales", () => {
    expect(Object.keys(WIDGET_MESSAGES.tr.controls).sort()).toEqual(Object.keys(WIDGET_MESSAGES.en.controls).sort());
  });

  it("renders the Turkish title by default catalog", () => {
    expect(WIDGET_MESSAGES.tr.title).toBe("Erişilebilirlik Tercihleri");
    expect(WIDGET_MESSAGES.en.title).toBe("Accessibility Preferences");
  });
});
