import { describe, expect, it } from "vitest";
import { WIDGET_ICONS } from "./icons.js";
import { WIDGET_CONTROL_KEYS } from "./messages.js";

describe("widget icons", () => {
  it("provides an svg icon for every control", () => {
    for (const key of WIDGET_CONTROL_KEYS) {
      expect(WIDGET_ICONS[key], key).toMatch(/^<svg/);
    }
  });
  it("provides header/launcher/close icons", () => {
    for (const key of ["header", "launcher", "close"]) {
      expect(WIDGET_ICONS[key], key).toMatch(/^<svg/);
    }
  });
});
