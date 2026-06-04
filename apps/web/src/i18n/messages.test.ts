import { describe, expect, it } from "vitest";
import { MESSAGES, LOCALES, DEFAULT_LOCALE } from "./messages.js";

describe("message catalog", () => {
  it("has identical key sets for every locale", () => {
    const trKeys = Object.keys(MESSAGES.tr).sort();
    const enKeys = Object.keys(MESSAGES.en).sort();
    expect(trKeys).toEqual(enKeys);
  });

  it("has a non-empty value for every key in every locale", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        if (typeof value === "string") {
          expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
        } else {
          expect(typeof value, `${locale}.${key}`).toBe("function");
        }
      }
    }
  });

  it("defaults to Turkish", () => {
    expect(DEFAULT_LOCALE).toBe("tr");
    expect(LOCALES).toEqual(["tr", "en"]);
  });
});
