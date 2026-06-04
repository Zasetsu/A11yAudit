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

function transpileSource(path: string): string {
  return ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
}

async function evaluateFontPreferences<T>(page: Page, callback: string): Promise<T> {
  const classManagerSource = transpileSource("packages/assist-widget/src/effects/class-manager.ts");
  const fontPreferencesSource = transpileSource("packages/assist-widget/src/effects/font-preferences.ts");

  return page.evaluate(
    async ({ callbackSource, classManagerSource, fontPreferencesSource }) => {
      const classManagerUrl = URL.createObjectURL(new Blob([classManagerSource], { type: "text/javascript" }));
      const fontPreferencesUrl = URL.createObjectURL(
        new Blob([fontPreferencesSource.replace("./class-manager.js", classManagerUrl)], { type: "text/javascript" })
      );

      try {
        const importModule = (url: string) => new Function("url", "return import(url)")(url);
        const classManagerModule = await importModule(classManagerUrl);
        const fontPreferencesModule = await importModule(fontPreferencesUrl);
        return await new Function(
          "fontPreferencesModule",
          "classManagerModule",
          `return (${callbackSource})(fontPreferencesModule, classManagerModule);`
        )(fontPreferencesModule, classManagerModule);
      } finally {
        URL.revokeObjectURL(classManagerUrl);
        URL.revokeObjectURL(fontPreferencesUrl);
      }
    },
    { callbackSource: callback, classManagerSource, fontPreferencesSource }
  ) as Promise<T>;
}

describe("FontPreferences", () => {
  it("applies readable and dyslexia classes", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p>Readable copy</p></main>");

    const result = await evaluateFontPreferences<{
      readable: boolean;
      dyslexia: boolean;
      readableCleared: boolean;
    }>(
      page,
      `(fontPreferencesModule, classManagerModule) => {
        const fonts = new fontPreferencesModule.FontPreferences(new classManagerModule.ClassManager());
        fonts.apply(2);
        const readable = document.body.classList.contains("aa-assist-readable-font");
        fonts.apply(1);
        return {
          readable,
          dyslexia: document.body.classList.contains("aa-assist-dyslexia-font"),
          readableCleared: !document.body.classList.contains("aa-assist-readable-font")
        };
      }`
    );

    expect(result).toEqual({ readable: true, dyslexia: true, readableCleared: true });
    await page.close();
  });

  it("restores bionic text rewrites", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p id='copy'>Testing readable words</p></main>");

    const result = await evaluateFontPreferences<{ wrapped: number; text: string | null }>(
      page,
      `(fontPreferencesModule, classManagerModule) => {
        const fonts = new fontPreferencesModule.FontPreferences(new classManagerModule.ClassManager());
        fonts.apply(3);
        const wrapped = document.querySelectorAll("[data-aa-assist-original-text]").length;
        fonts.reset();
        return { wrapped, text: document.getElementById("copy")?.textContent ?? null };
      }`
    );

    expect(result).toEqual({ wrapped: 1, text: "Testing readable words" });
    await page.close();
  });

  it("bolds the first 40 percent of each bionic word", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p id='copy'>Testing readable words</p></main>");

    const result = await evaluateFontPreferences<string[]>(
      page,
      `(fontPreferencesModule, classManagerModule) => {
        const fonts = new fontPreferencesModule.FontPreferences(new classManagerModule.ClassManager());
        fonts.apply(3);
        return Array.from(document.querySelectorAll(".aa-assist-bionic-prefix")).map((element) => element.textContent);
      }`
    );

    expect(result).toEqual(["Tes", "read", "wo"]);
    await page.close();
  });

  it("does not rewrite skipped elements or the assist root", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <main><p id="copy">Visible copy</p></main>
      <div id="aa-assist-root">Widget copy</div>
      <script>const skippedScript = "Script copy";</script>
      <style>.skipped::before { content: "Style copy"; }</style>
      <noscript>Noscript copy</noscript>
      <textarea id="textarea">Textarea copy</textarea>
      <select><option id="option">Option copy</option></select>
      <iframe srcdoc="Iframe copy"></iframe>
      <canvas>Canvas copy</canvas>
      <svg><text>Svg copy</text></svg>
      <math><mtext>Math copy</mtext></math>
    `);

    const result = await evaluateFontPreferences<{
      rewritten: number;
      rootText: string | null;
      skippedText: string[];
      textareaValue: string | undefined;
      optionText: string | undefined;
    }>(
      page,
      `(fontPreferencesModule, classManagerModule) => {
        const fonts = new fontPreferencesModule.FontPreferences(new classManagerModule.ClassManager());
        fonts.apply(3);
        const skippedText = ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "OPTION", "IFRAME", "CANVAS", "SVG", "MATH"].map((tag) => {
          const element = document.querySelector(tag);
          return element?.querySelector("[data-aa-assist-original-text]")?.textContent ?? null;
        });
        return {
          rewritten: document.querySelectorAll("main [data-aa-assist-original-text]").length,
          rootText: document.querySelector("#aa-assist-root [data-aa-assist-original-text]")?.textContent ?? null,
          skippedText,
          textareaValue: document.getElementById("textarea")?.value,
          optionText: document.getElementById("option")?.textContent
        };
      }`
    );

    expect(result).toEqual({
      rewritten: 1,
      rootText: null,
      skippedText: [null, null, null, null, null, null, null, null, null],
      textareaValue: "Textarea copy",
      optionText: "Option copy"
    });
    await page.close();
  });

  it("preserves literal markup characters while rewriting bionic text", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p id='copy'></p></main>");
    await page.locator("#copy").evaluate((element) => {
      element.textContent = "Use <strong> safely & visibly";
    });

    const result = await evaluateFontPreferences<{ html: string | undefined; text: string | null; scripts: number }>(
      page,
      `(fontPreferencesModule, classManagerModule) => {
        const fonts = new fontPreferencesModule.FontPreferences(new classManagerModule.ClassManager());
        fonts.apply(3);
        return {
          html: document.getElementById("copy")?.innerHTML,
          text: document.getElementById("copy")?.textContent ?? null,
          scripts: document.querySelectorAll("strong:not(.aa-assist-bionic-prefix)").length
        };
      }`
    );

    expect(result.text).toBe("Use <strong> safely & visibly");
    expect(result.html).toContain("&lt;");
    expect(result.html).toContain("&gt;");
    expect(result.html).toContain("&amp;");
    expect(result.scripts).toBe(0);
    await page.close();
  });
});
