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

async function evaluateManager<T>(page: Page, paths: string[], callback: string): Promise<T> {
  const sources = paths.map((path) =>
    ts.transpileModule(readFileSync(resolve(path), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText
  );

  return page.evaluate(
    async ({ callbackSource, sources }) => {
      const urls = sources.map((source) => URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
      try {
        const modules = [];
        for (const url of urls) {
          modules.push(await new Function("url", "return import(url)")(url));
        }
        return await new Function("modules", `return (${callbackSource})(...modules);`)(modules);
      } finally {
        for (const url of urls) URL.revokeObjectURL(url);
      }
    },
    { callbackSource: callback, sources }
  ) as Promise<T>;
}

describe("reading overlays", () => {
  it("positions the reading guide from pointer movement and removes it on reset", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });
    await page.setContent("<main><p>Readable copy</p></main>");

    const result = await evaluateManager<{ top: string; removed: boolean }>(
      page,
      ["packages/assist-widget/src/managers/reading-guide.ts"],
      `(guideModule) => new Promise((resolve) => {
        const manager = new guideModule.ReadingGuideManager();
        manager.enable();
        document.dispatchEvent(new MouseEvent("mousemove", { clientY: 140 }));
        requestAnimationFrame(() => {
          const top = document.querySelector(".aa-assist-reading-guide").style.top;
          manager.reset();
          resolve({
            top,
            removed: document.querySelector(".aa-assist-reading-guide") === null
          });
        });
      })`
    );

    expect(result).toEqual({ top: "134px", removed: true });
    await page.close();
  });

  it("leaves an 80px reading mask band and removes overlays on reset", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });
    await page.setContent("<main><p>Readable copy</p></main>");

    const result = await evaluateManager<{ topHeight: string; bottomTop: string; bottomHeight: string; removed: boolean }>(
      page,
      ["packages/assist-widget/src/managers/reading-mask.ts"],
      `(maskModule) => new Promise((resolve) => {
        const manager = new maskModule.ReadingMaskManager();
        manager.enable();
        document.dispatchEvent(new MouseEvent("mousemove", { clientY: 200 }));
        requestAnimationFrame(() => {
          const topMask = document.querySelector(".aa-assist-reading-mask-top");
          const bottomMask = document.querySelector(".aa-assist-reading-mask-bottom");
          manager.reset();
          resolve({
            topHeight: topMask.style.height,
            bottomTop: bottomMask.style.top,
            bottomHeight: bottomMask.style.height,
            removed: document.querySelector(".aa-assist-reading-mask-top, .aa-assist-reading-mask-bottom") === null
          });
        });
      })`
    );

    expect(result).toEqual({ topHeight: "160px", bottomTop: "240px", bottomHeight: "360px", removed: true });
    await page.close();
  });

  it("keeps the 80px reading mask band stable near the viewport bottom", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });
    await page.setContent("<main><p>Readable copy</p></main>");

    const result = await evaluateManager<{ topHeight: string; bottomTop: string; bottomHeight: string }>(
      page,
      ["packages/assist-widget/src/managers/reading-mask.ts"],
      `(maskModule) => new Promise((resolve) => {
        const manager = new maskModule.ReadingMaskManager();
        manager.enable();
        document.dispatchEvent(new MouseEvent("mousemove", { clientY: 590 }));
        requestAnimationFrame(() => {
          const topMask = document.querySelector(".aa-assist-reading-mask-top");
          const bottomMask = document.querySelector(".aa-assist-reading-mask-bottom");
          resolve({
            topHeight: topMask.style.height,
            bottomTop: bottomMask.style.top,
            bottomHeight: bottomMask.style.height
          });
        });
      })`
    );

    expect(result).toEqual({ topHeight: "520px", bottomTop: "600px", bottomHeight: "0px" });
    await page.close();
  });
});
