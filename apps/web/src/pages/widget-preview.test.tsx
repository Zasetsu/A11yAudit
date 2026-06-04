import { describe, expect, it } from "vitest";
import { buildPreviewSrcdoc } from "./widget-preview.js";

const cfg = { enabledSections: ["content"], disabledFeatures: [], position: "bottom-right", language: "tr", brand: { accent: "#123456", theme: "light", launcherIcon: "default" }, customCss: ".x{}" } as any;

describe("buildPreviewSrcdoc", () => {
  it("inlines the draft config global and points at the shared bundle", () => {
    const html = buildPreviewSrcdoc(cfg, "https://app.example.com");
    expect(html).toContain("window.__AA_ASSIST_CONFIG__");
    expect(html).toContain('"accent":"#123456"');
    expect(html).toContain("https://app.example.com/assist/a11yaudit-assist.js");
    expect(html).not.toMatch(/assist\/p1\.js/);
  });

  it("escapes </script> in custom css to avoid breaking the srcdoc", () => {
    const html = buildPreviewSrcdoc({ ...cfg, customCss: "a{}</script>" }, "https://app.example.com");
    expect(html).not.toContain("</script><");
  });
});
