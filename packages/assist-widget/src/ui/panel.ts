import type { PageStructure } from "../managers/page-structure.js";
import type { AssistPreferences, StepPreference, TogglePreference } from "../state.js";
import type { AssistSection } from "../config.js";
import { widgetIcon } from "./icons.js";
import type { WidgetStrings } from "./messages.js";

type SectionName = "content" | "navigation" | "color";
type PreferenceName = string;

export type PreferencePath = `${SectionName}.${PreferenceName}`;

type StepValueKind = "step" | "pageReader" | "fonts" | "alignment";

export interface PanelOptions {
  preferences: AssistPreferences;
  pageStructure?: PageStructure | null;
  enabledSections?: ReadonlySet<AssistSection>;
  disabledFeatures?: readonly string[];
  strings: WidgetStrings;
  onToggle: (path: PreferencePath) => void;
  onStep: (path: PreferencePath) => void;
  onClear: () => void;
  onClose: () => void;
  onStructureJump: (id: string) => void;
}

type ToggleControl = {
  kind: "toggle";
  path: PreferencePath;
  preference: TogglePreference;
};

type StepControl = {
  kind: "step";
  path: PreferencePath;
  preference: StepPreference;
  valueKind: StepValueKind;
};

type Control = ToggleControl | StepControl;

function stepValue(control: StepControl, strings: WidgetStrings): string {
  const step = control.preference.step;
  if (step === 0) return strings.values.stepOff;
  switch (control.valueKind) {
    case "pageReader":
      return strings.values.pageReader[step - 1] ?? strings.values.step(step);
    case "fonts":
      return strings.values.fonts[step - 1] ?? strings.values.step(step);
    case "alignment":
      return strings.values.alignment[step - 1] ?? strings.values.step(step);
    default:
      return strings.values.step(step);
  }
}

function controlValue(control: Control, strings: WidgetStrings): string {
  if (control.kind === "step") return stepValue(control, strings);
  return control.preference.enabled ? strings.values.on : strings.values.off;
}

export function renderPanel(options: PanelOptions): HTMLElement {
  const { strings } = options;

  const panel = document.createElement("section");
  panel.className = "aa-assist-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "aa-assist-title");

  const header = document.createElement("div");
  header.className = "aa-assist-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "aa-assist-header-left";

  const badge = document.createElement("span");
  badge.className = "aa-assist-header-badge";
  badge.innerHTML = widgetIcon("header");

  const title = document.createElement("h2");
  title.id = "aa-assist-title";
  title.className = "aa-assist-title";
  title.textContent = strings.title;

  headerLeft.append(badge, title);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "aa-assist-close";
  close.setAttribute("aria-label", strings.closeAria);
  close.dataset.aaAssistAction = "close";
  const closeIcon = document.createElement("span");
  closeIcon.innerHTML = widgetIcon("close");
  close.append(closeIcon);
  close.addEventListener("click", options.onClose);

  header.append(headerLeft, close);
  panel.append(header);

  const body = document.createElement("div");
  body.className = "aa-assist-body";

  if (sectionEnabled(options, "content")) {
    appendSection(body, strings.sections.content, [
      step("content.lineHeight", options.preferences.content.lineHeight),
      step("content.textSize", options.preferences.content.textSize),
      toggle("content.largeCursor", options.preferences.content.largeCursor),
      toggle("content.hideImages", options.preferences.content.hideImages),
      toggle("content.stopAnimations", options.preferences.content.stopAnimations),
      toggle("content.hints", options.preferences.content.hints),
      step("content.fonts", options.preferences.content.fonts, "fonts"),
      step("content.textSpacing", options.preferences.content.textSpacing),
      step("content.textAlignment", options.preferences.content.textAlignment, "alignment"),
      toggle("content.magnifier", options.preferences.content.magnifier)
    ], options);
  }

  if (sectionEnabled(options, "navigation")) {
    appendSection(body, strings.sections.navigation, [
      step("navigation.pageReader", options.preferences.navigation.pageReader, "pageReader"),
      toggle("navigation.readingGuide", options.preferences.navigation.readingGuide),
      toggle("navigation.readingMask", options.preferences.navigation.readingMask),
      toggle("navigation.highlightLinks", options.preferences.navigation.highlightLinks),
      toggle("navigation.readingMode", options.preferences.navigation.readingMode),
      toggle("navigation.muteSound", options.preferences.navigation.muteSound),
      toggle("navigation.highlightFocus", options.preferences.navigation.highlightFocus),
      toggle("navigation.pageStructure", options.preferences.navigation.pageStructure)
    ], options);
  }

  if (sectionEnabled(options, "navigation") && options.preferences.navigation.pageStructure.enabled && options.pageStructure) {
    body.append(renderStructure(options.pageStructure, strings, options.onStructureJump));
  }

  if (sectionEnabled(options, "color")) {
    appendSection(body, strings.sections.color, [
      toggle("color.monochrome", options.preferences.color.monochrome),
      step("color.saturation", options.preferences.color.saturation),
      step("color.smartContrast", options.preferences.color.smartContrast),
      step("color.brightness", options.preferences.color.brightness),
      step("color.contrast", options.preferences.color.contrast)
    ], options);
  }

  panel.append(body);

  const footer = document.createElement("div");
  footer.className = "aa-assist-footer";

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "aa-assist-clear";
  clear.setAttribute("aria-label", strings.clear);
  clear.dataset.aaAssistAction = "clear";
  clear.textContent = strings.clear;
  clear.addEventListener("click", options.onClear);

  footer.append(clear);
  panel.append(footer);

  return panel;
}

function sectionEnabled(options: PanelOptions, section: AssistSection): boolean {
  return options.enabledSections?.has(section) ?? true;
}

function appendSection(container: HTMLElement, titleText: string, controls: Control[], options: PanelOptions): void {
  const disabled = options.disabledFeatures;
  const visibleControls = disabled?.length
    ? controls.filter((c) => !disabled.includes(c.path.split(".")[1] ?? ""))
    : controls;

  const section = document.createElement("section");
  section.className = "aa-assist-section";

  const title = document.createElement("h3");
  title.className = "aa-assist-section-title";
  title.textContent = titleText;

  const grid = document.createElement("div");
  grid.className = "aa-assist-grid";

  for (const control of visibleControls) {
    grid.append(renderControl(control, options));
  }

  section.append(title, grid);
  container.append(section);
}

function renderControl(control: Control, options: PanelOptions): HTMLButtonElement {
  const { strings } = options;
  const isPressed = control.preference.enabled;
  const value = controlValue(control, strings);
  const localizedLabel = strings.controls[control.path] ?? control.path;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "aa-assist-control";
  button.dataset.aaAssistPath = control.path;
  button.dataset.aaFeature = control.path.split(".")[1] ?? "";
  button.setAttribute("aria-pressed", String(isPressed));
  button.setAttribute("aria-label", `${localizedLabel} ${value}`);
  button.addEventListener("click", () => {
    if (control.kind === "step") {
      options.onStep(control.path);
    } else {
      options.onToggle(control.path);
    }
  });

  const top = document.createElement("div");
  top.className = "aa-assist-control-top";

  const chip = document.createElement("span");
  chip.className = "aa-assist-control-chip";
  chip.innerHTML = widgetIcon(control.path);

  const status = document.createElement("span");
  status.className = "aa-assist-control-value";
  status.textContent = value;

  top.append(chip, status);

  const label = document.createElement("span");
  label.className = "aa-assist-control-label";
  label.textContent = localizedLabel;

  button.append(top, label);
  return button;
}

function renderStructure(structure: PageStructure, strings: WidgetStrings, onStructureJump: (id: string) => void): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "aa-assist-structure";
  wrapper.setAttribute("aria-label", strings.structure.aria);

  appendStructureGroup(wrapper, strings.structure.headings, structure.headings, onStructureJump);
  appendStructureGroup(wrapper, strings.structure.links, structure.links, onStructureJump);
  appendStructureGroup(wrapper, strings.structure.landmarks, structure.landmarks, onStructureJump);

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

function toggle(path: PreferencePath, preference: TogglePreference): ToggleControl {
  return { kind: "toggle", path, preference };
}

function step(path: PreferencePath, preference: StepPreference, valueKind: StepValueKind = "step"): StepControl {
  return { kind: "step", path, preference, valueKind };
}
