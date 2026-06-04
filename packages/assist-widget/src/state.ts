export interface TogglePreference {
  enabled: boolean;
}

export interface StepPreference {
  enabled: boolean;
  step: 0 | 1 | 2 | 3;
}

export interface AssistPreferences {
  content: {
    lineHeight: StepPreference;
    textSize: StepPreference;
    largeCursor: TogglePreference;
    hideImages: TogglePreference;
    stopAnimations: TogglePreference;
    hints: TogglePreference;
    fonts: StepPreference;
    textSpacing: StepPreference;
    textAlignment: StepPreference;
    magnifier: TogglePreference;
  };
  navigation: {
    pageReader: StepPreference;
    readingGuide: TogglePreference;
    readingMask: TogglePreference;
    highlightLinks: TogglePreference;
    readingMode: TogglePreference;
    muteSound: TogglePreference;
    highlightFocus: TogglePreference;
    pageStructure: TogglePreference;
  };
  color: {
    monochrome: TogglePreference;
    saturation: StepPreference;
    smartContrast: StepPreference;
    brightness: StepPreference;
    contrast: StepPreference;
  };
}

const offToggle = (): TogglePreference => ({ enabled: false });
const offStep = (): StepPreference => ({ enabled: false, step: 0 });
const STEP_LIMITS = {
  content: {
    lineHeight: 3,
    textSize: 3,
    fonts: 3,
    textSpacing: 3,
    textAlignment: 3
  },
  navigation: {
    pageReader: 3
  },
  color: {
    saturation: 2,
    smartContrast: 3,
    brightness: 2,
    contrast: 2
  }
} as const satisfies {
  content: Partial<Record<keyof AssistPreferences["content"], 2 | 3>>;
  navigation: Partial<Record<keyof AssistPreferences["navigation"], 2 | 3>>;
  color: Partial<Record<keyof AssistPreferences["color"], 2 | 3>>;
};

export function createDefaultPreferences(): AssistPreferences {
  return {
    content: {
      lineHeight: offStep(),
      textSize: offStep(),
      largeCursor: offToggle(),
      hideImages: offToggle(),
      stopAnimations: offToggle(),
      hints: offToggle(),
      fonts: offStep(),
      textSpacing: offStep(),
      textAlignment: offStep(),
      magnifier: offToggle()
    },
    navigation: {
      pageReader: offStep(),
      readingGuide: offToggle(),
      readingMask: offToggle(),
      highlightLinks: offToggle(),
      readingMode: offToggle(),
      muteSound: offToggle(),
      highlightFocus: offToggle(),
      pageStructure: offToggle()
    },
    color: {
      monochrome: offToggle(),
      saturation: offStep(),
      smartContrast: offStep(),
      brightness: offStep(),
      contrast: offStep()
    }
  };
}

export function togglePreference(preference: TogglePreference): TogglePreference {
  return { enabled: !preference.enabled };
}

export function cycleStepPreference(preference: StepPreference, maxStep: 2 | 3): StepPreference {
  const nextStep = preference.step >= maxStep ? 0 : ((preference.step + 1) as 0 | 1 | 2 | 3);
  return { enabled: nextStep > 0, step: nextStep };
}

export function serializePreferences(preferences: AssistPreferences): string {
  return JSON.stringify(preferences);
}

export function deserializePreferences(serialized: string | null): AssistPreferences {
  const defaults = createDefaultPreferences();
  if (!serialized) return defaults;

  try {
    const parsed = JSON.parse(serialized);
    return {
      content: {
        lineHeight: normalizeStepPreference(parsed?.content?.lineHeight, STEP_LIMITS.content.lineHeight),
        textSize: normalizeStepPreference(parsed?.content?.textSize, STEP_LIMITS.content.textSize),
        largeCursor: normalizeTogglePreference(parsed?.content?.largeCursor),
        hideImages: normalizeTogglePreference(parsed?.content?.hideImages),
        stopAnimations: normalizeTogglePreference(parsed?.content?.stopAnimations),
        hints: normalizeTogglePreference(parsed?.content?.hints),
        fonts: normalizeStepPreference(parsed?.content?.fonts, STEP_LIMITS.content.fonts),
        textSpacing: normalizeStepPreference(parsed?.content?.textSpacing, STEP_LIMITS.content.textSpacing),
        textAlignment: normalizeStepPreference(parsed?.content?.textAlignment, STEP_LIMITS.content.textAlignment),
        magnifier: normalizeTogglePreference(parsed?.content?.magnifier)
      },
      navigation: {
        pageReader: normalizeStepPreference(parsed?.navigation?.pageReader, STEP_LIMITS.navigation.pageReader),
        readingGuide: normalizeTogglePreference(parsed?.navigation?.readingGuide),
        readingMask: normalizeTogglePreference(parsed?.navigation?.readingMask),
        highlightLinks: normalizeTogglePreference(parsed?.navigation?.highlightLinks),
        readingMode: normalizeTogglePreference(parsed?.navigation?.readingMode),
        muteSound: normalizeTogglePreference(parsed?.navigation?.muteSound),
        highlightFocus: normalizeTogglePreference(parsed?.navigation?.highlightFocus),
        pageStructure: normalizeTogglePreference(parsed?.navigation?.pageStructure)
      },
      color: {
        monochrome: normalizeTogglePreference(parsed?.color?.monochrome),
        saturation: normalizeStepPreference(parsed?.color?.saturation, STEP_LIMITS.color.saturation),
        smartContrast: normalizeStepPreference(parsed?.color?.smartContrast, STEP_LIMITS.color.smartContrast),
        brightness: normalizeStepPreference(parsed?.color?.brightness, STEP_LIMITS.color.brightness),
        contrast: normalizeStepPreference(parsed?.color?.contrast, STEP_LIMITS.color.contrast)
      }
    };
  } catch {
    return defaults;
  }
}

function normalizeTogglePreference(value: unknown): TogglePreference {
  if (!isRecord(value) || typeof value.enabled !== "boolean") return offToggle();
  return { enabled: value.enabled };
}

function normalizeStepPreference(value: unknown, maxStep: 2 | 3): StepPreference {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || typeof value.step !== "number") return offStep();
  if (!Number.isInteger(value.step) || value.step < 0 || value.step > maxStep) return offStep();

  const step = value.enabled && value.step > 0 ? (value.step as StepPreference["step"]) : 0;
  return { enabled: step > 0, step };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
