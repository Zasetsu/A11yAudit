// @vitest-environment jsdom
import { describe, afterEach, expect, it } from "vitest";
import { parseLoaderOptions, resolveWidgetConfig } from "./loader.js";
import { DEFAULT_WIDGET_CONFIG, WIDGET_CONFIG_GLOBAL } from "./widget-config.js";

describe("parseLoaderOptions", () => {
  it("reads project, position, and language from script dataset", () => {
    const script = {
      dataset: {
        project: "project-123",
        position: "bottom-left",
        language: "en"
      }
    } as HTMLScriptElement;

    expect(parseLoaderOptions(script)).toEqual({
      projectId: "project-123",
      position: "bottom-left",
      language: "en",
      enabledSections: ["content", "navigation", "color"]
    });
  });

  it("resolves an explicit Turkish language", () => {
    const script = {
      dataset: {
        project: "project-123",
        language: "tr"
      }
    } as HTMLScriptElement;

    expect(parseLoaderOptions(script).language).toBe("tr");
  });

  it("uses safe defaults when optional dataset values are missing", () => {
    const script = { dataset: { project: "project-123" } } as HTMLScriptElement;

    expect(parseLoaderOptions(script)).toEqual({
      projectId: "project-123",
      position: "bottom-right",
      language: "tr",
      enabledSections: ["content", "navigation", "color"]
    });
  });

  it("parses enabled section allowlists", () => {
    const script = {
      dataset: {
        project: "project-123",
        enabledSections: "content,color,unknown,content"
      }
    } as HTMLScriptElement;

    expect(parseLoaderOptions(script).enabledSections).toEqual(["content", "color"]);
  });
});

describe("resolveWidgetConfig", () => {
  afterEach(() => { delete (window as Record<string, unknown>)[WIDGET_CONFIG_GLOBAL]; });

  it("prefers window.__AA_ASSIST_CONFIG__ when present (normalized)", () => {
    (window as Record<string, unknown>)[WIDGET_CONFIG_GLOBAL] = { position: "top-left", brand: { accent: "#abcdef" } };
    const config = resolveWidgetConfig(undefined);
    expect(config.position).toBe("top-left");
    expect(config.brand.accent).toBe("#abcdef");
  });

  it("falls back to data-* attributes when the global is absent", () => {
    const script = document.createElement("script");
    script.dataset.position = "bottom-left";
    script.dataset.language = "en";
    script.dataset.enabledSections = "content color";
    const config = resolveWidgetConfig(script);
    expect(config.position).toBe("bottom-left");
    expect(config.language).toBe("en");
    expect(config.enabledSections).toEqual(["content", "color"]);
  });

  it("returns defaults when neither is present", () => {
    expect(resolveWidgetConfig(undefined)).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});
