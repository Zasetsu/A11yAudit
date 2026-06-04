import { mountAssistWidget, type AssistWidgetInstance, type AssistWidgetOptions } from "./widget.js";
import { ASSIST_SECTIONS, type AssistSection } from "./config.js";

export type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface LoaderOptions {
  projectId: string;
  position: WidgetPosition;
  language: "en";
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
    language: "en",
    enabledSections: parseEnabledSections(script.dataset.enabledSections)
  };
}

export function initAssistWidget(options: Partial<LoaderOptions> & AssistWidgetOptions = {}): AssistWidgetInstance | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") return undefined;
  if (window.__A11Y_AUDIT_ASSIST__ && hasMountedAssistWidget()) return window.__A11Y_AUDIT_ASSIST__;
  if (window.__A11Y_AUDIT_ASSIST__) delete window.__A11Y_AUDIT_ASSIST__;

  const mountedInstance = mountAssistWidget({
    projectId: options.projectId,
    position: options.position,
    language: "en",
    enabledSections: options.enabledSections
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
  if (currentScript instanceof HTMLScriptElement) {
    initAssistWidget(parseLoaderOptions(currentScript));
  }
}
