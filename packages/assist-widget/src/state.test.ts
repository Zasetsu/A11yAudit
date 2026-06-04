import { describe, expect, it } from "vitest";
import {
  createDefaultPreferences,
  cycleStepPreference,
  togglePreference,
  serializePreferences,
  deserializePreferences
} from "./state.js";

describe("assist widget preference state", () => {
  it("creates all MVP preferences in the off state", () => {
    const state = createDefaultPreferences();

    expect(state.content.lineHeight).toEqual({ enabled: false, step: 0 });
    expect(state.content.hideImages).toEqual({ enabled: false });
    expect(state.navigation.pageReader).toEqual({ enabled: false, step: 0 });
    expect(state.color.smartContrast).toEqual({ enabled: false, step: 0 });
  });

  it("cycles three-step preferences back to off", () => {
    let preference = { enabled: false, step: 0 as 0 | 1 | 2 | 3 };

    preference = cycleStepPreference(preference, 3);
    expect(preference).toEqual({ enabled: true, step: 1 });
    preference = cycleStepPreference(preference, 3);
    expect(preference).toEqual({ enabled: true, step: 2 });
    preference = cycleStepPreference(preference, 3);
    expect(preference).toEqual({ enabled: true, step: 3 });
    preference = cycleStepPreference(preference, 3);
    expect(preference).toEqual({ enabled: false, step: 0 });
  });

  it("round-trips persisted preferences with defaults for missing keys", () => {
    const state = createDefaultPreferences();
    state.content.textSize = { enabled: true, step: 2 };
    state.navigation.readingGuide = { enabled: true };

    const restored = deserializePreferences(serializePreferences(state));

    expect(restored.content.textSize).toEqual({ enabled: true, step: 2 });
    expect(restored.navigation.readingGuide).toEqual({ enabled: true });
    expect(restored.color.monochrome).toEqual({ enabled: false });
  });

  it("normalizes malformed persisted preferences", () => {
    const restored = deserializePreferences(
      JSON.stringify({
        content: {
          textSize: { enabled: true, step: 99 },
          largeCursor: { enabled: "yes" },
          fonts: { enabled: false, step: 2 }
        },
        navigation: {
          pageReader: { enabled: true, step: 3 },
          readingGuide: { enabled: true }
        },
        color: {
          contrast: { enabled: true, step: 3 },
          smartContrast: { enabled: true, step: 3 }
        }
      })
    );

    expect(restored.content.textSize).toEqual({ enabled: false, step: 0 });
    expect(restored.content.largeCursor).toEqual({ enabled: false });
    expect(restored.content.fonts).toEqual({ enabled: false, step: 0 });
    expect(restored.navigation.pageReader).toEqual({ enabled: true, step: 3 });
    expect(restored.navigation.readingGuide).toEqual({ enabled: true });
    expect(restored.color.contrast).toEqual({ enabled: false, step: 0 });
    expect(restored.color.smartContrast).toEqual({ enabled: true, step: 3 });
  });

  it("toggles boolean preferences", () => {
    expect(togglePreference({ enabled: false })).toEqual({ enabled: true });
    expect(togglePreference({ enabled: true })).toEqual({ enabled: false });
  });
});
