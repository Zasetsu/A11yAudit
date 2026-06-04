import { mountAssistWidget, type AssistWidgetInstance, type AssistWidgetOptions } from "./widget.js";
import { ASSIST_SECTIONS, DEFAULT_WIDGET_LOCALE, type AssistSection, type WidgetLocale } from "./config.js";
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, WIDGET_CONFIG_GLOBAL, type WidgetConfig } from "./widget-config.js";

export type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface LoaderOptions {
  projectId: string;
  position: WidgetPosition;
  language: WidgetLocale;
  enabledSections: AssistSection[];
}

declare global {
  interface Window {
    __A11Y_AUDIT_ASSIST__?: AssistWidgetInstance;
  }
}

const POSITIONS = new Set<WidgetPosition>(["bottom-right", "bottom-left", "top-right", "top-left"]);
const SECTIONS = new Set<AssistSection>(ASSIST_SECTIONS);

export function parseLoaderOptions(script: HTMLScriptElement): LoaderOptions {
  const projectId = script.dataset.project ?? "";
  const rawPosition = script.dataset.position as WidgetPosition | undefined;

  return {
    projectId,
    position: rawPosition && POSITIONS.has(rawPosition) ? rawPosition : "bottom-right",
    language: resolveLanguage(script),
    enabledSections: parseEnabledSections(script.dataset.enabledSections)
  };
}

/** The effective config: the inlined per-project global wins; otherwise build one from the legacy data-* attributes; otherwise defaults. */
export function resolveWidgetConfig(script: HTMLScriptElement | undefined): WidgetConfig {
  const injected = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>)[WIDGET_CONFIG_GLOBAL] : undefined;
  if (injected !== undefined) return normalizeWidgetConfig(injected);
  if (!script) return DEFAULT_WIDGET_CONFIG;
  const opts = parseLoaderOptions(script);
  return normalizeWidgetConfig({ enabledSections: opts.enabledSections, position: opts.position, language: opts.language });
}

function resolveLanguage(script: HTMLScriptElement): WidgetLocale {
  const explicit = script.dataset.language;
  if (explicit === "tr" || explicit === "en") return explicit;
  const htmlLang = (typeof document !== "undefined" ? document.documentElement.lang : "").toLowerCase();
  if (htmlLang.startsWith("en")) return "en";
  return DEFAULT_WIDGET_LOCALE;
}

export function initAssistWidget(options: Partial<LoaderOptions> & AssistWidgetOptions = {}): AssistWidgetInstance | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") return undefined;
  if (window.__A11Y_AUDIT_ASSIST__ && hasMountedAssistWidget()) return window.__A11Y_AUDIT_ASSIST__;
  if (window.__A11Y_AUDIT_ASSIST__) delete window.__A11Y_AUDIT_ASSIST__;

  const config = options.config;
  const mountedInstance = mountAssistWidget({
    projectId: options.projectId,
    position: config?.position ?? options.position,
    language: config?.language ?? options.language ?? DEFAULT_WIDGET_LOCALE,
    enabledSections: config?.enabledSections ?? options.enabledSections,
    config
  });
  const instance: AssistWidgetInstance = {
    clearPreferences: () => mountedInstance.clearPreferences(),
    unmount: () => {
      mountedInstance.unmount();
      if (window.__A11Y_AUDIT_ASSIST__ === instance) {
        delete window.__A11Y_AUDIT_ASSIST__;
      }
    }
  };

  window.__A11Y_AUDIT_ASSIST__ = instance;
  return instance;
}

function parseEnabledSections(value: string | undefined): AssistSection[] {
  if (!value) return [...ASSIST_SECTIONS];

  const parsed = value
    .split(/[\s,]+/)
    .map((section) => section.trim())
    .filter((section): section is AssistSection => SECTIONS.has(section as AssistSection));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...ASSIST_SECTIONS];
}

function hasMountedAssistWidget(): boolean {
  const root = document.getElementById("aa-assist-root");
  return Boolean(root?.shadowRoot?.querySelector(".aa-assist-launcher"));
}

if (typeof document !== "undefined") {
  const currentScript = document.currentScript;
  const script = currentScript instanceof HTMLScriptElement ? currentScript : undefined;
  if (script) {
    initAssistWidget({ ...parseLoaderOptions(script), config: resolveWidgetConfig(script) });
  }
}
