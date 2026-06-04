import { describe, expect, it } from "vitest";
import { parseLoaderOptions } from "./loader.js";

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

  it("uses safe defaults when optional dataset values are missing", () => {
    const script = { dataset: { project: "project-123" } } as HTMLScriptElement;

    expect(parseLoaderOptions(script)).toEqual({
      projectId: "project-123",
      position: "bottom-right",
      language: "en",
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
