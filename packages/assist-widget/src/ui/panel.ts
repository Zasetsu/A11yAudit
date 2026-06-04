import type { PageStructure } from "../managers/page-structure.js";
import type { AssistPreferences, StepPreference, TogglePreference } from "../state.js";
import type { AssistSection } from "../config.js";

type SectionName = "content" | "navigation" | "color";
type PreferenceName = string;

export type PreferencePath = `${SectionName}.${PreferenceName}`;

export interface PanelOptions {
  preferences: AssistPreferences;
  pageStructure?: PageStructure | null;
  enabledSections?: ReadonlySet<AssistSection>;
  onToggle: (path: PreferencePath) => void;
  onStep: (path: PreferencePath) => void;
  onClear: () => void;
  onClose: () => void;
  onStructureJump: (id: string) => void;
}

type ToggleControl = {
  kind: "toggle";
  label: string;
  path: PreferencePath;
  preference: TogglePreference;
};

type StepControl = {
  kind: "step";
  label: string;
  path: PreferencePath;
  preference: StepPreference;
  valueLabel?: (step: StepPreference["step"]) => string;
};

type Control = ToggleControl | StepControl;

const defaultStepLabel = (step: StepPreference["step"]): string => (step === 0 ? "off" : `step ${step}`);

const pageReaderLabel = (step: StepPreference["step"]): string => {
  if (step === 1) return "slow";
  if (step === 2) return "normal";
  if (step === 3) return "fast";
  return "off";
};

const fontLabel = (step: StepPreference["step"]): string => {
  if (step === 1) return "dyslexia";
  if (step === 2) return "readable";
  if (step === 3) return "bionic";
  return "off";
};

const alignmentLabel = (step: StepPreference["step"]): string => {
  if (step === 1) return "start";
  if (step === 2) return "center";
  if (step === 3) return "end";
  return "off";
};

export function renderPanel(options: PanelOptions): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "aa-assist-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "aa-assist-title");

  const header = document.createElement("div");
  header.className = "aa-assist-header";

  const title = document.createElement("h2");
  title.id = "aa-assist-title";
  title.className = "aa-assist-title";
  title.textContent = "Accessibility Preferences";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "aa-assist-close";
  close.setAttribute("aria-label", "Close accessibility preferences");
  close.textContent = "x";
  close.dataset.aaAssistAction = "close";
  close.addEventListener("click", options.onClose);

  header.append(title, close);
  panel.append(header);

  if (sectionEnabled(options, "content")) {
    appendSection(panel, "Content Settings", [
      step("Line Height", "content.lineHeight", options.preferences.content.lineHeight),
      step("Text Size", "content.textSize", options.preferences.content.textSize),
      toggle("Large Cursor", "content.largeCursor", options.preferences.content.largeCursor),
      toggle("Hide Images", "content.hideImages", options.preferences.content.hideImages),
      toggle("Stop Animations", "content.stopAnimations", options.preferences.content.stopAnimations),
      toggle("Hints", "content.hints", options.preferences.content.hints),
      step("Fonts", "content.fonts", options.preferences.content.fonts, fontLabel),
      step("Text Spacing", "content.textSpacing", options.preferences.content.textSpacing),
      step("Text Alignment", "content.textAlignment", options.preferences.content.textAlignment, alignmentLabel),
      toggle("Magnifier", "content.magnifier", options.preferences.content.magnifier)
    ], options);
  }

  if (sectionEnabled(options, "navigation")) {
    appendSection(panel, "Reading and Navigation", [
      step("Page Reader", "navigation.pageReader", options.preferences.navigation.pageReader, pageReaderLabel),
      toggle("Reading Guide", "navigation.readingGuide", options.preferences.navigation.readingGuide),
      toggle("Reading Mask", "navigation.readingMask", options.preferences.navigation.readingMask),
      toggle("Highlight Links", "navigation.highlightLinks", options.preferences.navigation.highlightLinks),
      toggle("Reading Mode", "navigation.readingMode", options.preferences.navigation.readingMode),
      toggle("Mute Sound", "navigation.muteSound", options.preferences.navigation.muteSound),
      toggle("Highlight Focus", "navigation.highlightFocus", options.preferences.navigation.highlightFocus),
      toggle("Page Structure", "navigation.pageStructure", options.preferences.navigation.pageStructure)
    ], options);
  }

  if (sectionEnabled(options, "navigation") && options.preferences.navigation.pageStructure.enabled && options.pageStructure) {
    panel.append(renderStructure(options.pageStructure, options.onStructureJump));
  }

  if (sectionEnabled(options, "color")) {
    appendSection(panel, "Color", [
      toggle("Monochrome", "color.monochrome", options.preferences.color.monochrome),
      step("Saturation", "color.saturation", options.preferences.color.saturation),
      step("Smart Contrast", "color.smartContrast", options.preferences.color.smartContrast),
      step("Brightness", "color.brightness", options.preferences.color.brightness),
      step("Contrast", "color.contrast", options.preferences.color.contrast)
    ], options);
  }

  const footer = document.createElement("div");
  footer.className = "aa-assist-footer";

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "aa-assist-clear";
  clear.setAttribute("aria-label", "Clear Preferences");
  clear.dataset.aaAssistAction = "clear";
  clear.textContent = "Clear Preferences";
  clear.addEventListener("click", options.onClear);

  footer.append(clear);
  panel.append(footer);

  return panel;
}

function sectionEnabled(options: PanelOptions, section: AssistSection): boolean {
  return options.enabledSections?.has(section) ?? true;
}

function appendSection(panel: HTMLElement, titleText: string, controls: Control[], options: PanelOptions): void {
  const section = document.createElement("section");
  section.className = "aa-assist-section";

  const title = document.createElement("h3");
  title.className = "aa-assist-section-title";
  title.textContent = titleText;

  const grid = document.createElement("div");
  grid.className = "aa-assist-grid";

  for (const control of controls) {
    grid.append(renderControl(control, options));
  }

  section.append(title, grid);
  panel.append(section);
}

function renderControl(control: Control, options: PanelOptions): HTMLButtonElement {
  const isPressed = control.preference.enabled;
  const value = control.kind === "step" ? (control.valueLabel ?? defaultStepLabel)(control.preference.step) : isPressed ? "on" : "off";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "aa-assist-control";
  button.dataset.aaAssistPath = control.path;
  button.setAttribute("aria-pressed", String(isPressed));
  button.setAttribute("aria-label", `${control.label} ${value}`);
  button.addEventListener("click", () => {
    if (control.kind === "step") {
      options.onStep(control.path);
    } else {
      options.onToggle(control.path);
    }
  });

  const label = document.createElement("span");
  label.className = "aa-assist-control-label";
  label.textContent = control.label;

  const status = document.createElement("span");
  status.className = "aa-assist-control-value";
  status.textContent = value;

  button.append(label, status);
  return button;
}

function renderStructure(structure: PageStructure, onStructureJump: (id: string) => void): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "aa-assist-structure";
  wrapper.setAttribute("aria-label", "Page Structure");

  appendStructureGroup(wrapper, "Headings", structure.headings, onStructureJump);
  appendStructureGroup(wrapper, "Links", structure.links, onStructureJump);
  appendStructureGroup(wrapper, "Landmarks", structure.landmarks, onStructureJump);

  return wrapper;
}

function appendStructureGroup(
  wrapper: HTMLElement,
  titleText: string,
  items: PageStructure[keyof PageStructure],
  onStructureJump: (id: string) => void
): void {
  if (items.length === 0) return;

  const group = document.createElement("div");
  group.className = "aa-assist-structure-group";

  const title = document.createElement("h4");
  title.className = "aa-assist-structure-title";
  title.textContent = titleText;

  const list = document.createElement("div");
  list.className = "aa-assist-structure-list";

  for (const item of items.slice(0, 8)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aa-assist-structure-item";
    button.textContent = item.level ? `H${item.level} ${item.text}` : item.text;
    button.addEventListener("click", () => onStructureJump(item.id));
    list.append(button);
  }

  group.append(title, list);
  wrapper.append(group);
}

function toggle(label: string, path: PreferencePath, preference: TogglePreference): ToggleControl {
  return { kind: "toggle", label, path, preference };
}

function step(
  label: string,
  path: PreferencePath,
  preference: StepPreference,
  valueLabel?: (step: StepPreference["step"]) => string
): StepControl {
  return { kind: "step", label, path, preference, valueLabel };
}
