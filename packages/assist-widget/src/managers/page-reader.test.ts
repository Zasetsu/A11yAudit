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

describe("PageReaderManager", () => {
  it("reads clicked content, uses speed 2, and clears speech highlight on reset", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <div id="aa-assist-root"><button id="widget">Widget</button></div>
      <p id="copy">Readable paragraph</p>
      <input id="field" value="Typed value" placeholder="Placeholder value">
      <img id="image" alt="Product image">
    `);

    const result = await evaluateManager<{
      spokenTexts: string[];
      rates: number[];
      cancelCount: number;
      highlighted: boolean;
      resetRemovedHighlight: boolean;
    }>(
      page,
      "packages/assist-widget/src/managers/page-reader.ts",
      `(module) => {
        const spokenTexts = [];
        const rates = [];
        let cancelCount = 0;

        window.SpeechSynthesisUtterance = class {
          constructor(text) {
            this.text = text;
            this.rate = 1;
          }
        };
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: {
            speak(utterance) {
              spokenTexts.push(utterance.text);
              rates.push(utterance.rate);
            },
            cancel() {
              cancelCount += 1;
            }
          }
        });

        const manager = new module.PageReaderManager("en");
        manager.enable(2);
        document.getElementById("widget").click();
        document.getElementById("copy").click();
        const highlighted = document.getElementById("copy").hasAttribute("data-aa-assist-speech-highlight");
        document.getElementById("field").click();
        document.getElementById("image").click();
        manager.reset();

        return {
          spokenTexts,
          rates,
          cancelCount,
          highlighted,
          resetRemovedHighlight: document.querySelector("[data-aa-assist-speech-highlight]") === null
        };
      }`
    );

    expect(result).toEqual({
      spokenTexts: [
        "Page reader enabled. Click the text you want to read.",
        "Readable paragraph",
        "Typed value",
        "Product image"
      ],
      rates: [1, 1, 1, 1],
      cancelCount: 5,
      highlighted: true,
      resetRemovedHighlight: true
    });
    await page.close();
  });

  it("uses configured speech rates, fallback text, cleanup callbacks, and disable listener cleanup", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <p id="copy">Readable paragraph</p>
      <input id="placeholder" placeholder="Placeholder value">
      <img id="missing-alt">
    `);

    const result = await evaluateManager<{
      speedOneRate: number;
      speedThreeRate: number;
      fallbackTexts: string[];
      endCleaned: boolean;
      errorCleaned: boolean;
      disablePreventedRead: boolean;
    }>(
      page,
      "packages/assist-widget/src/managers/page-reader.ts",
      `(module) => {
        const spokenTexts = [];
        const utterances = [];

        window.SpeechSynthesisUtterance = class {
          constructor(text) {
            this.text = text;
            this.rate = 1;
          }
        };
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: {
            speak(utterance) {
              spokenTexts.push(utterance.text);
              utterances.push(utterance);
            },
            cancel() {}
          }
        });

        const manager = new module.PageReaderManager("en");
        manager.enable(1);
        const speedOneRate = utterances.at(-1).rate;
        manager.enable(3);
        const speedThreeRate = utterances.at(-1).rate;

        document.getElementById("placeholder").click();
        document.getElementById("missing-alt").click();
        const fallbackTexts = spokenTexts.slice(-2);

        document.getElementById("copy").click();
        const endUtterance = utterances.at(-1);
        endUtterance.onend();
        const endCleaned = !document.getElementById("copy").hasAttribute("data-aa-assist-speech-highlight");

        document.getElementById("copy").click();
        const errorUtterance = utterances.at(-1);
        errorUtterance.onerror();
        const errorCleaned = !document.getElementById("copy").hasAttribute("data-aa-assist-speech-highlight");

        const beforeDisableCount = spokenTexts.length;
        manager.disable();
        document.getElementById("copy").click();

        return {
          speedOneRate,
          speedThreeRate,
          fallbackTexts,
          endCleaned,
          errorCleaned,
          disablePreventedRead: spokenTexts.length === beforeDisableCount
        };
      }`
    );

    expect(result).toEqual({
      speedOneRate: 0.8,
      speedThreeRate: 1.2,
      fallbackTexts: ["Placeholder value", "Image"],
      endCleaned: true,
      errorCleaned: true,
      disablePreventedRead: true
    });
    await page.close();
  });

  it("does not let stale speech callbacks clear the latest highlight", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <p id="first">First paragraph</p>
      <p id="second">Second paragraph</p>
    `);

    const result = await evaluateManager<{ firstCleared: boolean; secondStillHighlighted: boolean }>(
      page,
      "packages/assist-widget/src/managers/page-reader.ts",
      `(module) => {
        const utterances = [];

        window.SpeechSynthesisUtterance = class {
          constructor(text) {
            this.text = text;
            this.rate = 1;
          }
        };
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: {
            speak(utterance) {
              utterances.push(utterance);
            },
            cancel() {}
          }
        });

        const manager = new module.PageReaderManager("en");
        manager.enable(2);
        document.getElementById("first").click();
        const firstUtterance = utterances.at(-1);
        document.getElementById("second").click();
        firstUtterance.onend();

        return {
          firstCleared: !document.getElementById("first").hasAttribute("data-aa-assist-speech-highlight"),
          secondStillHighlighted: document.getElementById("second").hasAttribute("data-aa-assist-speech-highlight")
        };
      }`
    );

    expect(result).toEqual({ firstCleared: true, secondStillHighlighted: true });
    await page.close();
  });
});
