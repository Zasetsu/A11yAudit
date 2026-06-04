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

describe("page structure", () => {
  it("collects headings, links, and landmarks outside the assist root", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <div id="aa-assist-root"><h1>Widget heading</h1><a href="/widget">Widget link</a></div>
      <nav id="nav">Primary navigation</nav>
      <main id="main">
        <h1 id="title">Page title</h1>
        <h2>Section title</h2>
        <a id="link" href="/products">Products</a>
      </main>
      <footer id="footer">Footer content</footer>
    `);

    const result = await evaluateManager<{
      headings: Array<{ level: number; text: string }>;
      links: Array<{ text: string; href: string }>;
      landmarks: Array<{ role: string; text: string }>;
    }>(
      page,
      "packages/assist-widget/src/managers/page-structure.ts",
      `(module) => {
        const structure = module.collectPageStructure();
        return {
          headings: structure.headings.map((item) => ({ level: item.level, text: item.text })),
          links: structure.links.map((item) => ({ text: item.text, href: item.href })),
          landmarks: structure.landmarks.map((item) => ({ role: item.role, text: item.text }))
        };
      }`
    );

    expect(result).toEqual({
      headings: [
        { level: 1, text: "Page title" },
        { level: 2, text: "Section title" }
      ],
      links: [{ text: "Products", href: "/products" }],
      landmarks: [
        { role: "navigation", text: "Primary navigation" },
        { role: "main", text: "Page title Section title Products" },
        { role: "contentinfo", text: "Footer content" }
      ]
    });
    await page.close();
  });

  it("does not mutate missing-id elements during standalone collection", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><h2>Standalone heading</h2></main>");

    const result = await evaluateManager<{
      itemId: string;
      elementId: string | null;
      generatedAttribute: string | null;
    }>(
      page,
      "packages/assist-widget/src/managers/page-structure.ts",
      `(module) => {
        const heading = document.querySelector("h2");
        const structure = module.collectPageStructure();
        return {
          itemId: structure.headings[0].id,
          elementId: heading.getAttribute("id"),
          generatedAttribute: heading.getAttribute("data-aa-assist-structure-generated-id")
        };
      }`
    );

    expect(result).toEqual({
      itemId: expect.stringMatching(/^aa-assist-structure-item-/),
      elementId: null,
      generatedAttribute: null
    });
    await page.close();
  });

  it("collects expanded named landmarks conservatively", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <div id="aa-assist-root"><div role="search">Widget search</div></div>
      <search id="native-search">Native search</search>
      <div role="search" id="search">Search site</div>
      <div role="form" id="role-form" aria-label="Role form">Role form fields</div>
      <div role="region" id="role-region" aria-labelledby="region-label"><h2 id="region-label">Role region</h2></div>
      <section id="named-section"><h2>Named section</h2><p>Section copy</p></section>
      <section id="unnamed-section"><p>Section copy</p></section>
      <form id="named-form" aria-label="Contact form"><input name="email"></form>
      <form id="unnamed-form"><input name="q"></form>
    `);

    const result = await evaluateManager<Array<{ id: string; role: string; text: string }>>(
      page,
      "packages/assist-widget/src/managers/page-structure.ts",
      `(module) => module.collectPageStructure().landmarks.map((item) => ({
        id: item.id,
        role: item.role,
        text: item.text
      }))`
    );

    expect(result).toEqual([
      { id: "native-search", role: "search", text: "Native search" },
      { id: "search", role: "search", text: "Search site" },
      { id: "role-form", role: "form", text: "Role form fields" },
      { id: "role-region", role: "region", text: "Role region" },
      { id: "named-section", role: "region", text: "Named section Section copy" },
      { id: "named-form", role: "form", text: "Contact form" }
    ]);
    await page.close();
  });

  it("jumps to a heading with temporary focus state and removes widget-owned highlight on reset", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><h2 id='target'>Jump target</h2><h2 id='existing' tabindex='0'>Existing target</h2></main>");

    const result = await evaluateManager<{
      generatedId: string;
      tabindex: string | null;
      highlighted: boolean;
      activeId: string;
      resetTabindex: string | null;
      resetHighlight: boolean;
    }>(
      page,
      "packages/assist-widget/src/managers/page-structure.ts",
      `(module) => {
        const manager = new module.PageStructureManager();
        const structure = manager.collect();
        const section = structure.headings.find((item) => item.text === "Jump target");
        const generated = structure.headings.find((item) => item.text === "Existing target");
        manager.jumpTo(section.id);
        const target = document.getElementById("target");
        const tabindex = target.getAttribute("tabindex");
        const highlighted = target.hasAttribute("data-aa-assist-structure-highlight");
        const activeId = document.activeElement.id;
        manager.reset();
        return {
          generatedId: generated.id,
          tabindex,
          highlighted,
          activeId,
          resetTabindex: target.getAttribute("tabindex"),
          resetHighlight: target.hasAttribute("data-aa-assist-structure-highlight")
        };
      }`
    );

    expect(result).toEqual({
      generatedId: "existing",
      tabindex: "-1",
      highlighted: true,
      activeId: "target",
      resetTabindex: null,
      resetHighlight: false
    });
    await page.close();
  });

  it("generates temporary ids and removes only widget-owned temporary state on reset", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><h2>Generated heading</h2><h2 id='existing'>Existing heading</h2></main>");

    const result = await evaluateManager<{
      generatedIdPrefix: boolean;
      generatedIdBeforeReset: string | null;
      generatedTabindex: string | null;
      existingIdBeforeReset: string | null;
      generatedIdAfterReset: string | null;
      generatedTabindexAfterReset: string | null;
      generatedHighlightAfterReset: boolean;
      existingIdAfterReset: string | null;
    }>(
      page,
      "packages/assist-widget/src/managers/page-structure.ts",
      `(module) => {
        const manager = new module.PageStructureManager();
        const structure = manager.collect();
        const generatedItem = structure.headings.find((item) => item.text === "Generated heading");
        const existingItem = structure.headings.find((item) => item.text === "Existing heading");
        const generatedElement = generatedItem.element;
        manager.jumpTo(generatedItem.id);
        const generatedIdBeforeReset = generatedElement.getAttribute("id");
        const generatedTabindex = generatedElement.getAttribute("tabindex");
        const existingIdBeforeReset = existingItem.id;
        manager.reset();

        return {
          generatedIdPrefix: generatedItem.id.startsWith("aa-assist-structure-"),
          generatedIdBeforeReset,
          generatedTabindex,
          existingIdBeforeReset,
          generatedIdAfterReset: generatedElement.getAttribute("id"),
          generatedTabindexAfterReset: generatedElement.getAttribute("tabindex"),
          generatedHighlightAfterReset: generatedElement.hasAttribute("data-aa-assist-structure-highlight"),
          existingIdAfterReset: document.querySelector("h2#existing")?.id ?? null
        };
      }`
    );

    expect(result).toEqual({
      generatedIdPrefix: true,
      generatedIdBeforeReset: expect.stringMatching(/^aa-assist-structure-/),
      generatedTabindex: "-1",
      existingIdBeforeReset: "existing",
      generatedIdAfterReset: null,
      generatedTabindexAfterReset: null,
      generatedHighlightAfterReset: false,
      existingIdAfterReset: "existing"
    });
    await page.close();
  });

  it("restores previous highlight styles when jumping between targets", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><h2 id='first' style='outline: 1px solid red; outline-offset: 1px'>First</h2><h2 id='second'>Second</h2></main>");

    const result = await evaluateManager<{
      firstHighlighted: boolean;
      firstOutline: string;
      firstOffset: string;
      secondHighlighted: boolean;
      secondOutline: string;
      secondOffset: string;
    }>(
      page,
      "packages/assist-widget/src/managers/page-structure.ts",
      `(module) => {
        const manager = new module.PageStructureManager();
        manager.collect();
        manager.jumpTo("first");
        manager.jumpTo("second");
        const first = document.getElementById("first");
        const second = document.getElementById("second");
        return {
          firstHighlighted: first.hasAttribute("data-aa-assist-structure-highlight"),
          firstOutline: first.style.outline,
          firstOffset: first.style.outlineOffset,
          secondHighlighted: second.hasAttribute("data-aa-assist-structure-highlight"),
          secondOutline: second.style.outline,
          secondOffset: second.style.outlineOffset
        };
      }`
    );

    expect(result).toEqual({
      firstHighlighted: false,
      firstOutline: "red solid 1px",
      firstOffset: "1px",
      secondHighlighted: true,
      secondOutline: "rgb(37, 99, 235) solid 3px",
      secondOffset: "3px"
    });
    await page.close();
  });
});
