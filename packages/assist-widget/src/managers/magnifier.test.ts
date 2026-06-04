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

describe("MagnifierManager", () => {
  it("shows text and image magnifier previews", async () => {
    const page = await browser.newPage();
    await page.setContent("<p id='copy'>Readable copy</p><img id='image' src='data:image/gif;base64,R0lGODlhAQABAAAAACw='>");

    const result = await evaluateManager<{ text: string | undefined; hasImage: boolean; removed: boolean }>(
      page,
      "packages/assist-widget/src/managers/magnifier.ts",
      `(module) => {
        const manager = new module.MagnifierManager();
        manager.enable();
        manager.showTextPreview(document.getElementById("copy"), "Readable copy", new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
        const text = document.querySelector(".aa-assist-magnifier")?.textContent;
        manager.showImagePreview(document.getElementById("image"), new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
        const imageStyle = document.querySelector(".aa-assist-magnifier").style.backgroundImage;
        manager.reset();
        return { text, hasImage: imageStyle.includes("data:image"), removed: document.querySelector(".aa-assist-magnifier") === null };
      }`
    );

    expect(result).toEqual({ text: "Readable copy", hasImage: true, removed: true });
    await page.close();
  });

  it("shows text and image previews from hover events", async () => {
    const page = await browser.newPage();
    await page.setContent("<p id='copy'>Readable copy</p><img id='image' src='data:image/gif;base64,R0lGODlhAQABAAAAACw='>");

    const result = await evaluateManager<{ text: string | undefined; hasImage: boolean }>(
      page,
      "packages/assist-widget/src/managers/magnifier.ts",
      `(module) => new Promise((resolve) => {
        const manager = new module.MagnifierManager();
        manager.enable();
        document.getElementById("copy").dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX: 10,
          clientY: 10
        }));
        requestAnimationFrame(() => {
          const text = document.querySelector(".aa-assist-magnifier")?.textContent;
          document.getElementById("image").dispatchEvent(new PointerEvent("pointermove", {
            bubbles: true,
            clientX: 20,
            clientY: 20
          }));
          requestAnimationFrame(() => {
            const imageStyle = document.querySelector(".aa-assist-magnifier").style.backgroundImage;
            resolve({ text, hasImage: imageStyle.includes("data:image") });
          });
        });
      })`
    );

    expect(result).toEqual({ text: "Readable copy", hasImage: true });
    await page.close();
  });

  it("clears stale preview styles when switching between image and text", async () => {
    const page = await browser.newPage();
    await page.setContent("<p id='copy'>Readable copy</p><img id='image' src='data:image/gif;base64,R0lGODlhAQABAAAAACw='>");

    const result = await evaluateManager<{
      textWidth: string;
      textHeight: string;
      imageMinWidth: string;
      imageFontSize: string;
    }>(
      page,
      "packages/assist-widget/src/managers/magnifier.ts",
      `(module) => {
        const manager = new module.MagnifierManager();
        const copy = document.getElementById("copy");
        const image = document.getElementById("image");
        manager.showImagePreview(image, new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
        manager.showTextPreview(copy, "Readable copy", new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
        const textPreview = document.querySelector(".aa-assist-magnifier");
        const textWidth = textPreview.style.width;
        const textHeight = textPreview.style.height;
        manager.showImagePreview(image, new MouseEvent("mousemove", { clientX: 30, clientY: 30 }));
        const imagePreview = document.querySelector(".aa-assist-magnifier");
        return {
          textWidth,
          textHeight,
          imageMinWidth: imagePreview.style.minWidth,
          imageFontSize: imagePreview.style.fontSize
        };
      }`
    );

    expect(result).toEqual({ textWidth: "", textHeight: "", imageMinWidth: "", imageFontSize: "" });
    await page.close();
  });

  it("removes magnifier and listeners on reset", async () => {
    const page = await browser.newPage();
    await page.setContent("<p id='copy'>Readable copy</p>");

    const result = await evaluateManager<{ removed: boolean; listenerCleaned: boolean }>(
      page,
      "packages/assist-widget/src/managers/magnifier.ts",
      `(module) => {
        const manager = new module.MagnifierManager();
        manager.enable();
        const copy = document.getElementById("copy");
        copy.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 10, clientY: 10 }));
        manager.reset();
        copy.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20, clientY: 20 }));
        return {
          removed: document.querySelector(".aa-assist-magnifier") === null,
          listenerCleaned: document.querySelector(".aa-assist-magnifier") === null
        };
      }`
    );

    expect(result).toEqual({ removed: true, listenerCleaned: true });
    await page.close();
  });

  it("ignores the assist widget root", async () => {
    const page = await browser.newPage();
    await page.setContent("<div id='aa-assist-root'><p id='copy'>Widget copy</p><img id='image' src='data:image/gif;base64,R0lGODlhAQABAAAAACw='></div>");

    const result = await evaluateManager<{ directIgnored: boolean; hoverIgnored: boolean; imageIgnored: boolean }>(
      page,
      "packages/assist-widget/src/managers/magnifier.ts",
      `(module) => {
        const manager = new module.MagnifierManager();
        manager.enable();
        const copy = document.getElementById("copy");
        const image = document.getElementById("image");
        manager.showTextPreview(copy, "Widget copy", new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
        const directIgnored = document.querySelector(".aa-assist-magnifier") === null;
        copy.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20, clientY: 20 }));
        const hoverIgnored = document.querySelector(".aa-assist-magnifier") === null;
        manager.showImagePreview(image, new MouseEvent("mousemove", { clientX: 30, clientY: 30 }));
        const imageIgnored = document.querySelector(".aa-assist-magnifier") === null;
        return { directIgnored, hoverIgnored, imageIgnored };
      }`
    );

    expect(result).toEqual({ directIgnored: true, hoverIgnored: true, imageIgnored: true });
    await page.close();
  });
});
