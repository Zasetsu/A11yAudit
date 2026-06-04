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

describe("StopAnimationsManager", () => {
  it("neutralizes and restores inline animation styles", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='box' style='transition: opacity 1s; transform: translateX(10px)'></div>");

    const result = await evaluateManager<{ disabled: boolean; restored: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        const styles = getComputedStyle(box);
        const disabled = styles.animationName === "none"
          && styles.transitionProperty === "none"
          && styles.transform === "none"
          && box.dataset.aaAssistOriginalStyle !== undefined;
        manager.reset();
        return { disabled, restored: box.getAttribute("style") };
      }`
    );

    expect(result.disabled).toBe(true);
    expect(result.restored).toContain("transition: opacity 1s");
    expect(result.restored).toContain("transform: translateX(10px)");
    await page.close();
  });

  it("neutralizes newly added animated elements through MutationObserver", async () => {
    const page = await browser.newPage();
    await page.setContent("<main id='root'></main>");

    const result = await evaluateManager<{ disabled: boolean; restored: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => new Promise((resolve) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.createElement("div");
        box.id = "new-box";
        box.style.transition = "opacity 1s";
        box.style.transform = "scale(1.2)";
        document.getElementById("root").append(box);
        requestAnimationFrame(() => {
          const styles = getComputedStyle(box);
          const disabled = styles.transitionProperty === "none"
            && styles.transform === "none"
            && box.dataset.aaAssistOriginalStyle !== undefined;
          manager.reset();
          resolve({ disabled, restored: box.getAttribute("style") });
        });
      })`
    );

    expect(result.disabled).toBe(true);
    expect(result.restored).toContain("transition: opacity 1s");
    expect(result.restored).toContain("transform: scale(1.2)");
    await page.close();
  });

  it("neutralizes existing elements without throwing when MutationObserver is unavailable", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='box' style='transition: opacity 1s; transform: translateX(10px)'></div>");

    const result = await evaluateManager<{ disabled: boolean; restored: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => {
        window.MutationObserver = undefined;
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        const styles = getComputedStyle(box);
        const disabled = styles.transitionProperty === "none"
          && styles.transform === "none"
          && box.dataset.aaAssistOriginalStyle !== undefined;
        manager.reset();
        return { disabled, restored: box.getAttribute("style") };
      }`
    );

    expect(result.disabled).toBe(true);
    expect(result.restored).toContain("transition: opacity 1s");
    expect(result.restored).toContain("transform: translateX(10px)");
    await page.close();
  });

  it("preserves host inline style changes made while enabled", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='box' style='transition: opacity 1s; transform: translateX(10px)'></div>");

    const result = await evaluateManager<{ disabled: boolean; restored: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => new Promise((resolve) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        box.style.backgroundColor = "rgb(255, 0, 0)";
        requestAnimationFrame(() => {
          const styles = getComputedStyle(box);
          const disabled = styles.transitionProperty === "none"
            && styles.transform === "none";
          manager.reset();
          resolve({ disabled, restored: box.getAttribute("style") });
        });
      })`
    );

    expect(result.disabled).toBe(true);
    expect(result.restored).toContain("transition: opacity 1s");
    expect(result.restored).toContain("transform: translateX(10px)");
    expect(result.restored).toContain("background-color: rgb(255, 0, 0)");
    await page.close();
  });

  it("preserves host changes to managed animation properties while enabled", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='box' style='transition: opacity 1s; transform: translateX(10px)'></div>");

    const result = await evaluateManager<{ disabled: boolean; restored: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => new Promise((resolve) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        box.style.transform = "translateX(20px)";
        requestAnimationFrame(() => {
          const disabled = getComputedStyle(box).transform === "none";
          manager.reset();
          resolve({ disabled, restored: box.getAttribute("style") });
        });
      })`
    );

    expect(result.disabled).toBe(true);
    expect(result.restored).toContain("transition: opacity 1s");
    expect(result.restored).toContain("transform: translateX(20px)");
    await page.close();
  });

  it("preserves same-turn host changes to managed properties during reset", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='box' style='transition: opacity 1s; transform: translateX(10px)'></div>");

    const result = await evaluateManager<{ restored: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        box.style.transform = "translateX(20px)";
        manager.reset();
        return { restored: box.getAttribute("style") };
      }`
    );

    expect(result.restored).toContain("transition: opacity 1s");
    expect(result.restored).toContain("transform: translateX(20px)");
    await page.close();
  });

  it("restores inline animation priorities", async () => {
    const page = await browser.newPage();
    await page.setContent(
      "<div id='box' style='transition: opacity 1s !important; transform: translateX(10px) !important'></div>"
    );

    const result = await evaluateManager<{
      transitionPriority: string;
      transformPriority: string;
      restored: string | null;
    }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        manager.reset();
        return {
          transitionPriority: box.style.getPropertyPriority("transition"),
          transformPriority: box.style.getPropertyPriority("transform"),
          restored: box.getAttribute("style")
        };
      }`
    );

    expect(result.transitionPriority).toBe("important");
    expect(result.transformPriority).toBe("important");
    expect(result.restored).toContain("transition: opacity 1s !important");
    expect(result.restored).toContain("transform: translateX(10px) !important");
    await page.close();
  });

  it("ignores the assist widget root", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='aa-assist-root'><div id='box' style='transition: opacity 1s; transform: translateX(10px)'></div></div>");

    const result = await evaluateManager<{ changed: boolean; dataAttribute: string | null }>(
      page,
      "packages/assist-widget/src/managers/animations.ts",
      `(module) => {
        const manager = new module.StopAnimationsManager();
        manager.enable();
        const box = document.getElementById("box");
        return {
          changed: box.style.transitionProperty === "none" || box.style.transform === "none",
          dataAttribute: box.getAttribute("data-aa-assist-original-style")
        };
      }`
    );

    expect(result).toEqual({ changed: false, dataAttribute: null });
    await page.close();
  });
});
