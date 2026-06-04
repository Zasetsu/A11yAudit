import { describe, expect, it } from "vitest";
import { COLOR_CSS, colorClassForStep, type ColorStepFeature } from "./color-preferences.js";

describe("colorClassForStep", () => {
  it("maps contrast, brightness, saturation, and smart contrast steps", () => {
    expect(colorClassForStep("contrast", 1)).toBe("aa-assist-contrast-low");
    expect(colorClassForStep("contrast", 2)).toBe("aa-assist-contrast-high");
    expect(colorClassForStep("brightness", 1)).toBe("aa-assist-brightness-low");
    expect(colorClassForStep("saturation", 2)).toBe("aa-assist-saturation-high");
    expect(colorClassForStep("smartContrast", 3)).toBe("aa-assist-smart-contrast-light");
  });

  it("throws for an unsupported step on a two-step feature", () => {
    expect(() => colorClassForStep("contrast", 3)).toThrow("Invalid contrast step 3");
  });

  it("composes filter classes with custom properties", () => {
    expect(COLOR_CSS).toContain("--aa-assist-filter-grayscale");
    expect(COLOR_CSS).toContain("--aa-assist-filter-saturation");
    expect(COLOR_CSS).toContain("--aa-assist-filter-brightness");
    expect(COLOR_CSS).toContain("--aa-assist-filter-contrast");
    expect(COLOR_CSS).toContain("--aa-assist-filter-invert");
    expect(COLOR_CSS).toContain("filter: var(--aa-assist-filter-grayscale)");
    expect(COLOR_CSS).toContain(".aa-assist-saturation-high { --aa-assist-filter-saturation: saturate(2); }");
    expect(COLOR_CSS).toContain(".aa-assist-contrast-high { --aa-assist-filter-contrast: contrast(125%); }");
  });

  it("rejects unsupported color feature keys at runtime", () => {
    expect(() => colorClassForStep("unknown" as ColorStepFeature, 1)).toThrow();
  });
});
