import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, WIDGET_CONFIG_CSS_MAX_BYTES } from "./widget-config.js";

describe("normalizeWidgetConfig", () => {
  it("returns defaults for undefined/empty input", () => {
    expect(normalizeWidgetConfig(undefined)).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(normalizeWidgetConfig({})).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("keeps valid fields and drops invalid ones", () => {
    const result = normalizeWidgetConfig({
      enabledSections: ["content", "color", "bogus"],
      disabledFeatures: ["magnifier", "not-a-feature"],
      position: "top-left",
      language: "en",
      brand: { accent: "#abcdef", theme: "dark", launcherLabel: "Help", launcherIcon: "default" },
      customCss: ".x{color:red}"
    });
    expect(result.enabledSections).toEqual(["content", "color"]);
    expect(result.disabledFeatures).toEqual(["magnifier"]);
    expect(result.position).toBe("top-left");
    expect(result.language).toBe("en");
    expect(result.brand.accent).toBe("#abcdef");
    expect(result.brand.theme).toBe("dark");
    expect(result.customCss).toBe(".x{color:red}");
  });

  it("falls back invalid scalars to defaults", () => {
    const result = normalizeWidgetConfig({ position: "middle", language: "fr", brand: { accent: "red", theme: "neon" } });
    expect(result.position).toBe(DEFAULT_WIDGET_CONFIG.position);
    expect(result.language).toBe(DEFAULT_WIDGET_CONFIG.language);
    expect(result.brand.accent).toBe(DEFAULT_WIDGET_CONFIG.brand.accent);
    expect(result.brand.theme).toBe(DEFAULT_WIDGET_CONFIG.brand.theme);
  });

  it("strips </style> and @import from customCss and enforces the byte cap", () => {
    const result = normalizeWidgetConfig({ customCss: '@import url(x); a{}</style><script>' });
    expect(result.customCss).not.toMatch(/@import/i);
    expect(result.customCss.toLowerCase()).not.toContain("</style");
    const big = normalizeWidgetConfig({ customCss: "a".repeat(WIDGET_CONFIG_CSS_MAX_BYTES + 100) });
    expect(big.customCss.length).toBeLessThanOrEqual(WIDGET_CONFIG_CSS_MAX_BYTES);
  });

  it("resets a non-svg launcherIcon to default", () => {
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "alert('x')" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg></svg>" } }).brand.launcherIcon).toBe("<svg></svg>");
  });

  it("rejects an svg launcher icon with a script or event handler", () => {
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg><script>1</script></svg>" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg onload=\"x()\"></svg>" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg><a href=\"javascript:x\"></a></svg>" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg><path d=\"M0 0\"/></svg>" } }).brand.launcherIcon).toBe("<svg><path d=\"M0 0\"/></svg>");
  });

  it("rejects an svg launcher icon with href/xlink:href or a data: uri", () => {
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg><a xlink:href=\"https://evil\"><text>x</text></a></svg>" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg><a href=\"https://evil\"></a></svg>" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg><image href=\"data:image/png;base64,x\"/></svg>" } }).brand.launcherIcon).toBe("default");
  });

  it("rejects an oversized svg launcher icon", () => {
    const huge = "<svg>" + "x".repeat(20001) + "</svg>";
    expect(normalizeWidgetConfig({ brand: { launcherIcon: huge } }).brand.launcherIcon).toBe("default");
  });

  it("strips @import without eating the following rule", () => {
    const css = "@import url(evil)\n.keep{color:red}";
    const out = normalizeWidgetConfig({ customCss: css }).customCss;
    expect(out).not.toMatch(/@import/i);
    expect(out).toContain(".keep{color:red}");
  });

  it("caps customCss by UTF-8 bytes, not characters", () => {
    // each "学" is 3 UTF-8 bytes; 20000 chars = 60000 bytes > 50000 cap
    const big = "学".repeat(20000);
    const out = normalizeWidgetConfig({ customCss: big }).customCss;
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(WIDGET_CONFIG_CSS_MAX_BYTES);
  });
});
