import { ASSIST_SECTIONS, CONTENT_FEATURES, NAVIGATION_FEATURES, COLOR_FEATURES, type AssistSection, type WidgetLocale } from "./config.js";
import type { WidgetPosition } from "./loader.js";

export const WIDGET_CONFIG_GLOBAL = "__AA_ASSIST_CONFIG__";
export const WIDGET_CONFIG_CSS_MAX_BYTES = 50_000;

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

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  enabledSections: [...ASSIST_SECTIONS],
  disabledFeatures: [],
  position: "bottom-right",
  language: "tr",
  brand: { accent: "#2b56b0", theme: "light", launcherIcon: "default" },
  customCss: ""
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function sanitizeCss(value: unknown): string {
  if (typeof value !== "string") return "";
  let css = value.replace(/<\/style/gi, "").replace(/@import[^;]*;?/gi, "");
  if (css.length > WIDGET_CONFIG_CSS_MAX_BYTES) css = css.slice(0, WIDGET_CONFIG_CSS_MAX_BYTES);
  return css;
}

function sanitizeLauncherIcon(value: unknown): "default" | string {
  if (typeof value !== "string" || value === "default") return "default";
  const trimmed = value.trim();
  return /^<svg[\s>][\s\S]*<\/svg>\s*$/i.test(trimmed) ? trimmed : "default";
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
    language: raw.language === "tr" || raw.language === "en" ? raw.language : DEFAULT_WIDGET_CONFIG.language,
    brand: {
      accent,
      theme: THEMES.includes(brand.theme as WidgetTheme) ? (brand.theme as WidgetTheme) : DEFAULT_WIDGET_CONFIG.brand.theme,
      launcherLabel: typeof brand.launcherLabel === "string" && brand.launcherLabel.trim() !== "" ? brand.launcherLabel.trim().slice(0, 60) : undefined,
      launcherIcon: sanitizeLauncherIcon(brand.launcherIcon)
    },
    customCss: sanitizeCss(raw.customCss)
  };
}
