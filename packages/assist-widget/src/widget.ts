import { ASSIST_SECTIONS, DEFAULT_WIDGET_LOCALE, STORAGE_KEY, type AssistSection, type WidgetLocale } from "./config.js";
import type { WidgetConfig } from "./widget-config.js";
import { ClassManager } from "./effects/class-manager.js";
import { COLOR_CLASSES, COLOR_CSS, colorClassForStep, type ColorStepFeature } from "./effects/color-preferences.js";
import { FontPreferences } from "./effects/font-preferences.js";
import { ResetManager } from "./effects/reset-manager.js";
import { StyleManager } from "./effects/style-manager.js";
import {
  TEXT_ALIGNMENT_CSS,
  applyLineHeight,
  applyTextAlignment,
  applyTextSize,
  applyTextSpacing
} from "./effects/text-preferences.js";
import { StopAnimationsManager } from "./managers/animations.js";
import { HintsManager } from "./managers/hints.js";
import { MagnifierManager } from "./managers/magnifier.js";
import { MuteSoundManager } from "./managers/mute-sound.js";
import { PageReaderManager } from "./managers/page-reader.js";
import { PageStructureManager, type PageStructure } from "./managers/page-structure.js";
import { ReadingGuideManager } from "./managers/reading-guide.js";
import { ReadingMaskManager } from "./managers/reading-mask.js";
import {
  createDefaultPreferences,
  cycleStepPreference,
  deserializePreferences,
  serializePreferences,
  togglePreference,
  type AssistPreferences,
  type StepPreference,
  type TogglePreference
} from "./state.js";
import { widgetIcon } from "./ui/icons.js";
import { renderPanel, type PreferencePath } from "./ui/panel.js";
import { resolveWidgetStrings } from "./ui/messages.js";
import { PAGE_EFFECT_CSS, WIDGET_CSS } from "./ui/styles.js";

export type AssistWidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface AssistWidgetOptions {
  projectId?: string;
  position?: AssistWidgetPosition;
  language?: WidgetLocale;
  enabledSections?: readonly AssistSection[];
  config?: WidgetConfig;
}

export interface AssistWidgetInstance {
  unmount: () => void;
  clearPreferences: () => void;
}

const ROOT_ID = "aa-assist-root";
const PAGE_EFFECT_STYLE_ID = "aa-assist-page-effect-styles";
const BODY_CLASS_TOGGLES = {
  "content.largeCursor": "aa-assist-large-cursor",
  "content.hideImages": "aa-assist-hide-images",
  "navigation.highlightLinks": "aa-assist-highlight-links",
  "navigation.readingMode": "aa-assist-reading-mode",
  "navigation.highlightFocus": "aa-assist-highlight-focus"
} as const;
const STEP_LIMITS: Partial<Record<PreferencePath, 2 | 3>> = {
  "content.lineHeight": 3,
  "content.textSize": 3,
  "content.fonts": 3,
  "content.textSpacing": 3,
  "content.textAlignment": 3,
  "navigation.pageReader": 3,
  "color.saturation": 2,
  "color.smartContrast": 3,
  "color.brightness": 2,
  "color.contrast": 2
};
const COLOR_STEP_FEATURES = ["saturation", "smartContrast", "brightness", "contrast"] as const;

export function mountAssistWidget(options: AssistWidgetOptions = {}): AssistWidgetInstance {
  ensurePageEffectStyles();

  const locale: WidgetLocale = options.language ?? DEFAULT_WIDGET_LOCALE;
  const strings = resolveWidgetStrings(locale);

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.dataset.position = options.position ?? "bottom-right";
  const shadowRoot = root.attachShadow({ mode: "open" });
  const widgetStyle = document.createElement("style");
  widgetStyle.textContent = WIDGET_CSS;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "aa-assist-launcher";
  launcher.setAttribute("aria-label", strings.launcherOpen);
  launcher.setAttribute("aria-expanded", "false");
  const launcherIcon = document.createElement("span");
  launcherIcon.innerHTML = widgetIcon("launcher");
  launcher.append(launcherIcon);

  const styleManager = new StyleManager();
  const classManager = new ClassManager();
  const resetManager = new ResetManager();
  const stopAnimationsManager = new StopAnimationsManager();
  const hintsManager = new HintsManager();
  const fontPreferences = new FontPreferences(classManager);
  const magnifierManager = new MagnifierManager();
  const pageReaderManager = new PageReaderManager(locale);
  const readingGuideManager = new ReadingGuideManager();
  const readingMaskManager = new ReadingMaskManager();
  const muteSoundManager = new MuteSoundManager();
  const pageStructureManager = new PageStructureManager();

  resetManager.add(fontPreferences);
  resetManager.add(stopAnimationsManager);
  resetManager.add(hintsManager);
  resetManager.add(magnifierManager);
  resetManager.add(pageReaderManager);
  resetManager.add(readingGuideManager);
  resetManager.add(readingMaskManager);
  resetManager.add(muteSoundManager);
  resetManager.add(pageStructureManager);
  resetManager.add({ reset: () => classManager.clearOwnedClasses() });

  let preferences = loadPreferences();
  let panel: HTMLElement | null = null;
  let pageStructure: PageStructure | null = null;
  let isOpen = false;
  let mounted = true;
  const enabledSections = new Set(options.enabledSections?.length ? options.enabledSections : ASSIST_SECTIONS);

  launcher.addEventListener("click", () => {
    if (isOpen) {
      closePanel();
    } else {
      isOpen = true;
      render({ focusTarget: "close" });
    }
  });
  shadowRoot.addEventListener("keydown", (event) => handlePanelKeydown(event as KeyboardEvent));

  document.body.append(root);
  applyPreferences({ persist: false });
  render();

  function render({ focusTarget }: { focusTarget?: PreferencePath | "launcher" | "close" | "clear" } = {}): void {
    if (!mounted) return;

    panel?.remove();
    panel = null;
    launcher.setAttribute("aria-expanded", String(isOpen));
    launcher.tabIndex = isOpen ? -1 : 0;

    if (isOpen) {
      panel = renderPanel({
        preferences,
        pageStructure,
        enabledSections,
        strings,
        onToggle: updateToggle,
        onStep: updateStep,
        onClear: clearPreferences,
        onClose: closePanel,
        onStructureJump: (id) => pageStructureManager.jumpTo(id)
      });
      panel.setAttribute("lang", locale);
    }

    const children: Node[] = [widgetStyle];
    if (root.dataset.position?.startsWith("top")) {
      children.push(launcher);
      if (panel) children.push(panel);
    } else {
      if (panel) children.push(panel);
      children.push(launcher);
    }
    shadowRoot.replaceChildren(...children);
    restoreFocus(focusTarget);
  }

  function updateToggle(path: PreferencePath): void {
    const preference = getPreference(path);
    if (!isTogglePreference(preference)) return;

    setPreference(path, togglePreference(preference));
    applyPreferences();
    render({ focusTarget: path });
  }

  function updateStep(path: PreferencePath): void {
    const preference = getPreference(path);
    if (!isStepPreference(preference)) return;

    setPreference(path, cycleStepPreference(preference, STEP_LIMITS[path] ?? 3));
    applyPreferences();
    render({ focusTarget: path });
  }

  function applyPreferences({ persist = true }: { persist?: boolean } = {}): void {
    resetRuntimeEffects();

    if (sectionEnabled("content")) {
      applyLineHeight(styleManager, preferences.content.lineHeight.step);
      applyTextSize(styleManager, preferences.content.textSize.step);
      applyTextSpacing(styleManager, preferences.content.textSpacing.step);

      if (preferences.content.textAlignment.enabled) {
        styleManager.setSection("text-alignment", TEXT_ALIGNMENT_CSS);
        applyTextAlignment(classManager, preferences.content.textAlignment.step);
      }

      if (preferences.content.fonts.enabled) {
        fontPreferences.apply(preferences.content.fonts.step);
      }

      applyBodyClass("content.largeCursor", preferences.content.largeCursor);

      if (preferences.content.hideImages.enabled) {
        applyBodyClass("content.hideImages", preferences.content.hideImages);
      }

      if (preferences.content.stopAnimations.enabled) stopAnimationsManager.enable();
      if (preferences.content.hints.enabled) hintsManager.enable();
      if (preferences.content.magnifier.enabled) magnifierManager.enable();
    }

    if (sectionEnabled("navigation")) {
      applyBodyClass("navigation.highlightLinks", preferences.navigation.highlightLinks);
      applyBodyClass("navigation.readingMode", preferences.navigation.readingMode);
      applyBodyClass("navigation.highlightFocus", preferences.navigation.highlightFocus);

      if (preferences.navigation.pageReader.enabled) pageReaderManager.enable(preferences.navigation.pageReader.step);
      if (preferences.navigation.readingGuide.enabled) readingGuideManager.enable();
      if (preferences.navigation.readingMask.enabled) readingMaskManager.enable();
      if (preferences.navigation.muteSound.enabled) muteSoundManager.enable();

      if (preferences.navigation.pageStructure.enabled) {
        pageStructure = pageStructureManager.collect();
      }
    }

    if (sectionEnabled("color")) {
      applyColorPreferences();
    }

    if (persist) savePreferences(preferences);
  }

  function applyBodyClass(path: keyof typeof BODY_CLASS_TOGGLES, preference: TogglePreference): void {
    const className = BODY_CLASS_TOGGLES[path];
    if (preference.enabled) {
      classManager.addBodyClass(className);
    }
  }

  function applyColorPreferences(): void {
    const hasActiveColor =
      preferences.color.monochrome.enabled ||
      COLOR_STEP_FEATURES.some((feature) => preferences.color[feature].enabled);

    if (!hasActiveColor) return;

    styleManager.setSection("color", COLOR_CSS);

    if (preferences.color.monochrome.enabled) {
      classManager.addHtmlClass("aa-assist-monochrome");
    }

    for (const feature of COLOR_STEP_FEATURES) {
      applyColorStep(feature, preferences.color[feature]);
    }
  }

  function applyColorStep(feature: ColorStepFeature, preference: StepPreference): void {
    for (const className of COLOR_CLASSES[feature]) {
      classManager.removeHtmlClass(className);
    }

    if (preference.enabled && (preference.step === 1 || preference.step === 2 || preference.step === 3)) {
      classManager.addHtmlClass(colorClassForStep(feature, preference.step));
    }
  }

  function clearPreferences(): void {
    preferences = createDefaultPreferences();
    removeStoredPreferences();
    resetRuntimeEffects();
    render({ focusTarget: isOpen ? "clear" : undefined });
  }

  function sectionEnabled(section: AssistSection): boolean {
    return enabledSections.has(section);
  }

  function resetRuntimeEffects(): void {
    pageStructure = null;
    styleManager.clear();
    resetManager.resetAll();
  }

  function unmount(): void {
    if (!mounted) return;

    mounted = false;
    resetRuntimeEffects();
    root.remove();
    removePageEffectStylesIfUnused();
  }

  function closePanel(): void {
    isOpen = false;
    render({ focusTarget: "launcher" });
  }

  function restoreFocus(focusTarget: PreferencePath | "launcher" | "close" | "clear" | undefined): void {
    if (!focusTarget) return;

    let target: HTMLElement | null = null;
    if (focusTarget === "launcher") {
      target = launcher;
    } else if (focusTarget === "close") {
      target = shadowRoot.querySelector<HTMLElement>("[data-aa-assist-action='close']");
    } else if (focusTarget === "clear") {
      target = shadowRoot.querySelector<HTMLElement>("[data-aa-assist-action='clear']");
    } else {
      target = shadowRoot.querySelector<HTMLElement>(`[data-aa-assist-path='${focusTarget}']`);
    }
    target?.focus();
  }

  function handlePanelKeydown(event: KeyboardEvent): void {
    if (!isOpen || !panel) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getPanelFocusableElements();
    if (focusable.length === 0) return;

    const active = shadowRoot.activeElement;
    const activeIndex = active instanceof HTMLElement ? focusable.indexOf(active) : -1;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (activeIndex <= 0 || active === null)) {
      event.preventDefault();
      last?.focus();
      return;
    }

    if (!event.shiftKey && activeIndex === focusable.length - 1) {
      event.preventDefault();
      first?.focus();
    }
  }

  function getPanelFocusableElements(): HTMLElement[] {
    if (!panel) return [];

    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    ).filter((element) => element.offsetParent !== null || element === shadowRoot.activeElement);
  }

  function getPreference(path: PreferencePath): TogglePreference | StepPreference | undefined {
    const [section, feature] = path.split(".") as ["content" | "navigation" | "color", string];
    return (preferences[section] as Record<string, TogglePreference | StepPreference | undefined>)[feature];
  }

  function setPreference(path: PreferencePath, value: TogglePreference | StepPreference): void {
    const [section, feature] = path.split(".") as ["content" | "navigation" | "color", string];
    (preferences[section] as Record<string, TogglePreference | StepPreference>)[feature] = value;
  }

  return { unmount, clearPreferences };
}

function ensurePageEffectStyles(): void {
  if (document.getElementById(PAGE_EFFECT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PAGE_EFFECT_STYLE_ID;
  style.textContent = PAGE_EFFECT_CSS;
  document.head.append(style);
}

function removePageEffectStylesIfUnused(): void {
  if (document.getElementById(ROOT_ID)) return;
  document.getElementById(PAGE_EFFECT_STYLE_ID)?.remove();
}

function loadPreferences(): AssistPreferences {
  try {
    return deserializePreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createDefaultPreferences();
  }
}

function savePreferences(preferences: AssistPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializePreferences(preferences));
  } catch {
    // Storage can be unavailable for opaque origins or locked-down embeds.
  }
}

function removeStoredPreferences(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable for opaque origins or locked-down embeds.
  }
}

function isTogglePreference(preference: TogglePreference | StepPreference | undefined): preference is TogglePreference {
  return preference !== undefined && !("step" in preference);
}

function isStepPreference(preference: TogglePreference | StepPreference | undefined): preference is StepPreference {
  return preference !== undefined && "step" in preference;
}
