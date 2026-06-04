import { ASSIST_SECTIONS, CONTENT_FEATURES, NAVIGATION_FEATURES, COLOR_FEATURES, WIDGET_LOCALES, type AssistSection, type WidgetLocale } from "./config.js";
import type { WidgetPosition } from "./loader.js";

export const WIDGET_CONFIG_GLOBAL = "__AA_ASSIST_CONFIG__";
export const WIDGET_CONFIG_CSS_MAX_BYTES = 50_000;

const CSS_ENCODER = new TextEncoder();

export type WidgetTheme = "light" | "dark" | "auto";

export interface WidgetBrand {
  accent: string;            // #rrggbb
  theme: WidgetTheme;
  launcherLabel?: string;
  launcherIcon: "default" | string; // "default" or an inline <svg> string
}

export interface WidgetConfig {
  enabledSections: AssistSection[];
  disabledFeatures: string[];
  position: WidgetPosition;
  language: WidgetLocale;
  brand: WidgetBrand;
  customCss: string;
}

const POSITIONS: WidgetPosition[] = ["bottom-right", "bottom-left", "top-right", "top-left"];
const THEMES: WidgetTheme[] = ["light", "dark", "auto"];
const KNOWN_FEATURES = new Set<string>([...CONTENT_FEATURES, ...NAVIGATION_FEATURES, ...COLOR_FEATURES]);
const KNOWN_SECTIONS = new Set<string>(ASSIST_SECTIONS);

export const DEFAULT_WIDGET_CONFIG: Readonly<WidgetConfig> = Object.freeze({
  enabledSections: Object.freeze([...ASSIST_SECTIONS]) as unknown as AssistSection[],
  disabledFeatures: Object.freeze([]) as unknown as string[],
  position: "bottom-right" as WidgetPosition,
  language: "tr" as WidgetLocale,
  brand: Object.freeze({ accent: "#2b56b0", theme: "light" as WidgetTheme, launcherIcon: "default" }),
  customCss: ""
});

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function trimToByteLength(css: string, maxBytes: number): string {
  if (CSS_ENCODER.encode(css).length <= maxBytes) return css;
  let lo = 0;
  let hi = css.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (CSS_ENCODER.encode(css.slice(0, mid)).length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return css.slice(0, lo);
}

function sanitizeCss(value: unknown): string {
  if (typeof value !== "string") return "";
  let css = value.replace(/<\/style/gi, "").replace(/@import\b[^;\n]*;?/gi, "");
  css = trimToByteLength(css, WIDGET_CONFIG_CSS_MAX_BYTES);
  return css;
}

function sanitizeLauncherIcon(value: unknown): "default" | string {
  if (typeof value !== "string" || value === "default") return "default";
  const trimmed = value.trim();
  if (!/^<svg[\s>][\s\S]*<\/svg>\s*$/i.test(trimmed)) return "default";
  if (trimmed.length > 20000) return "default";
  if (/<script/i.test(trimmed)) return "default";
  if (/\son\w+\s*=/i.test(trimmed)) return "default";
  if (/javascript:/i.test(trimmed)) return "default";
  return trimmed;
}

export function normalizeWidgetConfig(input: unknown): WidgetConfig {
  const raw = asRecord(input);
  const brand = asRecord(raw.brand);

  const enabledSections = Array.isArray(raw.enabledSections)
    ? raw.enabledSections.filter((s): s is AssistSection => typeof s === "string" && KNOWN_SECTIONS.has(s))
    : [...DEFAULT_WIDGET_CONFIG.enabledSections];

  const disabledFeatures = Array.isArray(raw.disabledFeatures)
    ? raw.disabledFeatures.filter((f): f is string => typeof f === "string" && KNOWN_FEATURES.has(f))
    : [];

  const accent = typeof brand.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(brand.accent)
    ? brand.accent
    : DEFAULT_WIDGET_CONFIG.brand.accent;

  return {
    enabledSections: enabledSections.length > 0 ? Array.from(new Set(enabledSections)) : [...DEFAULT_WIDGET_CONFIG.enabledSections],
    disabledFeatures: Array.from(new Set(disabledFeatures)),
    position: POSITIONS.includes(raw.position as WidgetPosition) ? (raw.position as WidgetPosition) : DEFAULT_WIDGET_CONFIG.position,
    language: WIDGET_LOCALES.includes(raw.language as WidgetLocale) ? (raw.language as WidgetLocale) : DEFAULT_WIDGET_CONFIG.language,
    brand: {
      accent,
      theme: THEMES.includes(brand.theme as WidgetTheme) ? (brand.theme as WidgetTheme) : DEFAULT_WIDGET_CONFIG.brand.theme,
      launcherLabel: typeof brand.launcherLabel === "string" && brand.launcherLabel.trim() !== "" ? brand.launcherLabel.trim().slice(0, 60) : undefined,
      launcherIcon: sanitizeLauncherIcon(brand.launcherIcon)
    },
    customCss: sanitizeCss(raw.customCss)
  };
}
