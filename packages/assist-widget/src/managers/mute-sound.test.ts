import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

async function evaluateManager<T>(page: Page, path: string, callback: string): Promise<T> {
  const source = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;

  return page.evaluate(
    async ({ callbackSource, source }) => {
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      try {
        const module = await new Function("url", "return import(url)")(url);
        return await new Function("module", `return (${callbackSource})(module);`)(module);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    { callbackSource: callback, source }
  ) as Promise<T>;
}

describe("MuteSoundManager", () => {
  it("mutes and pauses existing and newly added media, then restores original media state", async () => {
    const page = await browser.newPage();
    await page.setContent("<audio id='audio'></audio><video id='video'></video>");

    const result = await evaluateManager<{
      audioMuted: boolean;
      audioVolume: number;
      videoPaused: boolean;
      addedMuted: boolean;
      audioPlayed: boolean;
      restoredAudioMuted: boolean;
      restoredAudioVolume: number;
      restoredVideoMuted: boolean;
      restoredVideoVolume: number;
    }>(
      page,
      "packages/assist-widget/src/managers/mute-sound.ts",
      `(module) => {
        Object.defineProperty(HTMLMediaElement.prototype, "pause", {
          configurable: true,
          value() {
            this.dataset.pausedByTest = "true";
          }
        });
        Object.defineProperty(HTMLMediaElement.prototype, "play", {
          configurable: true,
          value() {
            this.dataset.playedByTest = "true";
            return Promise.resolve();
          }
        });
        window.AudioContext = class {
          suspend() {
            this.suspended = true;
            return Promise.resolve();
          }
        };

        const audio = document.getElementById("audio");
        const video = document.getElementById("video");
        Object.defineProperty(audio, "paused", {
          configurable: true,
          get() {
            return false;
          }
        });
        audio.muted = false;
        audio.volume = 0.7;
        video.muted = true;
        video.volume = 0.4;

        const manager = new module.MuteSoundManager();
        manager.enable();
        const added = document.createElement("video");
        added.volume = 0.5;
        document.body.append(added);

        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            const mutedState = {
              audioMuted: audio.muted,
              audioVolume: audio.volume,
              videoPaused: video.dataset.pausedByTest === "true",
              addedMuted: added.muted
            };
            manager.reset();
            resolve({
              ...mutedState,
              audioPlayed: audio.dataset.playedByTest === "true",
              restoredAudioMuted: audio.muted,
              restoredAudioVolume: audio.volume,
              restoredVideoMuted: video.muted,
              restoredVideoVolume: video.volume
            });
          });
        });
      }`
    );

    expect(result).toEqual({
      audioMuted: true,
      audioVolume: 0,
      videoPaused: true,
      addedMuted: true,
      audioPlayed: true,
      restoredAudioMuted: false,
      restoredAudioVolume: 0.7,
      restoredVideoMuted: true,
      restoredVideoVolume: 0.4
    });
    await page.close();
  });

  it("resumes managed AudioContexts and does not overwrite host repatches", async () => {
    const page = await browser.newPage();
    await page.setContent("<main></main>");

    const result = await evaluateManager<{
      suspended: boolean;
      resumed: boolean;
      hostPatchPreserved: boolean;
    }>(
      page,
      "packages/assist-widget/src/managers/mute-sound.ts",
      `(module) => {
        class OriginalAudioContext {
          suspend() {
            this.suspended = true;
            return Promise.resolve();
          }
          resume() {
            this.resumed = true;
            return Promise.resolve();
          }
        }
        class HostReplacementAudioContext {}
        window.AudioContext = OriginalAudioContext;

        const manager = new module.MuteSoundManager();
        manager.enable();
        const context = new window.AudioContext();
        window.AudioContext = HostReplacementAudioContext;
        manager.reset();

        return {
          suspended: context.suspended === true,
          resumed: context.resumed === true,
          hostPatchPreserved: window.AudioContext === HostReplacementAudioContext
        };
      }`
    );

    expect(result).toEqual({ suspended: true, resumed: true, hostPatchPreserved: true });
    await page.close();
  });

  it("mutes existing media without throwing when MutationObserver is unavailable", async () => {
    const page = await browser.newPage();
    await page.setContent("<audio id='audio'></audio>");

    const result = await evaluateManager<{
      muted: boolean;
      volume: number;
      restoredMuted: boolean;
      restoredVolume: number;
    }>(
      page,
      "packages/assist-widget/src/managers/mute-sound.ts",
      `(module) => {
        window.MutationObserver = undefined;
        Object.defineProperty(HTMLMediaElement.prototype, "pause", {
          configurable: true,
          value() {
            this.dataset.pausedByTest = "true";
          }
        });

        const audio = document.getElementById("audio");
        audio.muted = false;
        audio.volume = 0.6;

        const manager = new module.MuteSoundManager();
        manager.enable();
        const muted = audio.muted;
        const volume = audio.volume;
        manager.reset();

        return {
          muted,
          volume,
          restoredMuted: audio.muted,
          restoredVolume: audio.volume
        };
      }`
    );

    expect(result).toEqual({
      muted: true,
      volume: 0,
      restoredMuted: false,
      restoredVolume: 0.6
    });
    await page.close();
  });
});
