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

describe("HintsManager", () => {
  it("shows existing alt, aria-label, title, aria-description, and describedby text only", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <img id="image" alt="Product photo">
      <button id="button" aria-label="Open menu"></button>
      <span id="title" title="More details"></span>
      <span id="description" aria-description="Inline help"></span>
      <span id="describedby" aria-describedby="hint-one hint-two"></span>
      <span id="hint-one">First hint</span>
      <span id="hint-two">Second hint</span>
      <span id="empty"></span>
    `);

    const result = await evaluateManager<Array<string | null>>(
      page,
      "packages/assist-widget/src/managers/hints.ts",
      `(module) => {
        const manager = new module.HintsManager();
        manager.enable();
        const values = ["image", "button", "title", "description", "describedby", "empty"]
          .map((id) => manager.getHintText(document.getElementById(id)));
        manager.reset();
        return values;
      }`
    );

    expect(result).toEqual(["Product photo", "Open menu", "More details", "Inline help", "First hint Second hint", null]);
    await page.close();
  });

  it("shows and positions a pointer-driven tooltip without unowned attributes", async () => {
    const page = await browser.newPage();
    await page.setContent("<button id='button' aria-label='Open menu'></button>");

    const result = await evaluateManager<{
      text: string | undefined;
      left: string;
      top: string;
      role: string | null;
      background: string;
      border: string;
      padding: string;
      zIndex: string;
    }>(
      page,
      "packages/assist-widget/src/managers/hints.ts",
      `(module) => {
        const manager = new module.HintsManager();
        manager.enable();
        document.getElementById("button").dispatchEvent(new PointerEvent("pointerover", {
          bubbles: true,
          clientX: 20,
          clientY: 30
        }));
        const tooltip = document.querySelector(".aa-assist-hint-tooltip");
        return {
          text: tooltip?.textContent,
          left: tooltip.style.left,
          top: tooltip.style.top,
          role: tooltip.getAttribute("role"),
          background: tooltip.style.background,
          border: tooltip.style.border,
          padding: tooltip.style.padding,
          zIndex: tooltip.style.zIndex
        };
      }`
    );

    expect(result).toEqual({
      text: "Open menu",
      left: "32px",
      top: "42px",
      role: null,
      background: "rgba(255, 255, 255, 0.96)",
      border: "1px solid rgba(17, 24, 39, 0.22)",
      padding: "8px 10px",
      zIndex: "2147483647"
    });
    await page.close();
  });

  it("removes tooltip and listeners on reset", async () => {
    const page = await browser.newPage();
    await page.setContent("<button id='button' aria-label='Open menu'></button>");

    const result = await evaluateManager<{ removed: boolean; listenerCleaned: boolean }>(
      page,
      "packages/assist-widget/src/managers/hints.ts",
      `(module) => {
        const manager = new module.HintsManager();
        manager.enable();
        const button = document.getElementById("button");
        button.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 20, clientY: 30 }));
        manager.reset();
        button.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 40, clientY: 50 }));
        return {
          removed: document.querySelector(".aa-assist-hint-tooltip") === null,
          listenerCleaned: document.querySelector(".aa-assist-hint-tooltip") === null
        };
      }`
    );

    expect(result).toEqual({ removed: true, listenerCleaned: true });
    await page.close();
  });

  it("ignores the assist widget root", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='aa-assist-root'><button id='button' aria-label='Widget control'></button></div>");

    const result = await evaluateManager<{ hint: string | null; tooltip: string | undefined }>(
      page,
      "packages/assist-widget/src/managers/hints.ts",
      `(module) => {
        const manager = new module.HintsManager();
        manager.enable();
        const button = document.getElementById("button");
        button.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 20, clientY: 30 }));
        return {
          hint: manager.getHintText(button),
          tooltip: document.querySelector(".aa-assist-hint-tooltip")?.textContent
        };
      }`
    );

    expect(result).toEqual({ hint: null, tooltip: undefined });
    await page.close();
  });
});
