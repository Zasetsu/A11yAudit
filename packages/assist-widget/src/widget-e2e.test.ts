import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { resolve } from "node:path";
import { serveFixtureDirectory, type FixtureServer } from "./test-utils/fixture-server.js";
import { withPage } from "./test-utils/browser.js";

const fixtureRoot = resolve("packages/assist-widget/fixtures");
const bundlePath = resolve("packages/assist-widget/dist/a11yaudit-assist.js");

let server: FixtureServer;

beforeAll(async () => {
  server = await serveFixtureDirectory(fixtureRoot);
});

afterAll(async () => {
  await server.close();
});

describe("AssistWidget e2e fixtures", () => {
  it("applies text preferences and clears them", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "text.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Line Height/);
      await clickControl(page, /Text Size/);
      await clickControl(page, /Large Cursor/);
      await clickControl(page, /Text Spacing/);
      await clickControl(page, /Text Alignment/);
      await clickControl(page, /Fonts/);
      await clickControl(page, /Fonts/);

      const generatedCss = await page.locator("#aa-assist-generated-styles").textContent();
      expect(generatedCss).toContain("line-height");
      expect(generatedCss).toContain("font-size");
      expect(generatedCss).toContain("letter-spacing");
      expect(generatedCss).toContain("text-align");
      expect(await bodyHasClass(page, "aa-assist-readable-font")).toBe(true);
      const cursor = await page.locator("#intro").evaluate((element) => getComputedStyle(element).cursor);
      expect(cursor).toContain("data:image/svg+xml");
      expect(cursor).not.toBe("zoom-in");

      await clearPreferences(page);

      expect(await page.locator("#aa-assist-generated-styles").count()).toBe(0);
      expect(await bodyHasClass(page, "aa-assist-readable-font")).toBe(false);
    });
  });

  it("handles media preferences", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "media.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Hide Images/);
      await clickControl(page, /Hints/);
      await clickControl(page, /Magnifier/);
      await clickControl(page, /Mute Sound/);

      await expectHiddenByVisibility(page, "#described-image");
      await expectHiddenByVisibility(page, "#fixture-video");

      await page.locator("#described-image").dispatchEvent("pointerover", {
        clientX: 40,
        clientY: 40,
        bubbles: true
      });
      await waitForText(page, "#aa-assist-hint-tooltip", "Chart preview");

      await page.locator("#media-copy").dispatchEvent("pointermove", {
        clientX: 60,
        clientY: 60,
        bubbles: true
      });
      await waitForCount(page, ".aa-assist-magnifier", 1);

      expect(await page.locator("#fixture-audio").evaluate((audio) => (audio as HTMLAudioElement).muted)).toBe(true);
      expect(await page.locator("#fixture-video").evaluate((video) => (video as HTMLVideoElement).muted)).toBe(true);

      await clearPreferences(page);

      await expectVisibleByVisibility(page, "#described-image");
      await expectVisibleByVisibility(page, "#fixture-video");
      await waitForCount(page, "#aa-assist-hint-tooltip", 0);
      await waitForCount(page, ".aa-assist-magnifier", 0);
      expect(await page.locator("#fixture-audio").evaluate((audio) => (audio as HTMLAudioElement).muted)).toBe(false);
      expect(await page.locator("#fixture-video").evaluate((video) => (video as HTMLVideoElement).muted)).toBe(false);
    });
  });

  it("stops existing and dynamic animations", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "animation.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Stop Animations/);

      await expectAnimationStopped(page, "#animated-box");
      await expectAnimationStopped(page, "#transformed-box");

      await page.evaluate(() => {
        (window as Window & { addDynamicAnimatedElement: () => void }).addDynamicAnimatedElement();
      });

      await expectAnimationStopped(page, "#dynamic-animated-box");
    });
  });

  it("opens page structure and jumps to entries", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "structure.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Page Structure/);

      expect(await page.getByRole("heading", { name: "Headings" }).isVisible()).toBe(true);
      expect(await page.getByRole("heading", { name: "Links" }).isVisible()).toBe(true);
      expect(await page.getByRole("heading", { name: "Landmarks" }).isVisible()).toBe(true);

      await page.getByRole("button", { name: /H2 Details Section/ }).click();

      await waitForAttribute(page, "#details", "data-aa-assist-structure-highlight", "true");
      const outlineStyle = await page.locator("#details").evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(outlineStyle).not.toBe("none");
    });
  });

  it("makes focused page controls visually prominent", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "text.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Highlight Focus/);
      await page.getByRole("button", { name: "Close accessibility preferences" }).click();
      await page.locator("#name").focus();

      const focusStyles = await page.locator("#name").evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          outline: computed.outline,
          outlineOffset: computed.outlineOffset,
          boxShadow: computed.boxShadow,
          backgroundColor: computed.backgroundColor
        };
      });
      expect(focusStyles.outline).toContain("rgb(245, 158, 11)");
      expect(focusStyles.outlineOffset).toBe("4px");
      expect(focusStyles.boxShadow).toContain("rgba(245, 158, 11, 0.28)");
      expect(focusStyles.backgroundColor).toBe("rgb(255, 251, 235)");
    });
  });

  it("applies reading mode without transforming the widget root", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "layout.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Reading Mode/);

      await expectDisplay(page, "#layout-nav", "none");
      await expectDisplay(page, "#layout-aside", "none");
      await expectDisplay(page, "#layout-popup", "none");

      const rootStyle = await page.locator("#aa-assist-root").evaluate((root) => {
        const computed = getComputedStyle(root);
        return { display: computed.display, position: computed.position };
      });
      expect(rootStyle.display).not.toBe("none");
      expect(rootStyle.position).toBe("fixed");
    });
  });

  it("applies color preferences and clears them", async () => {
    await withPage(async (page) => {
      await navigateToFixture(page, "text.html");
      await injectBundle(page);
      await openPanel(page);

      await clickControl(page, /Monochrome/);
      await clickControl(page, /Saturation/);
      await clickControl(page, /Brightness/);
      await clickControl(page, /^Contrast /);
      await clickControl(page, /Smart Contrast/);

      const classes = await htmlClasses(page);
      expect(classes).toContain("aa-assist-monochrome");
      expect(classes.some((className) => className.startsWith("aa-assist-saturation-"))).toBe(true);
      expect(classes.some((className) => className.startsWith("aa-assist-brightness-"))).toBe(true);
      expect(classes.some((className) => className.startsWith("aa-assist-contrast-"))).toBe(true);
      expect(classes.some((className) => className.startsWith("aa-assist-smart-contrast-"))).toBe(true);

      await clearPreferences(page);

      const clearedClasses = await htmlClasses(page);
      expect(clearedClasses).not.toContain("aa-assist-monochrome");
      expect(clearedClasses.some((className) => className.startsWith("aa-assist-saturation-"))).toBe(false);
      expect(clearedClasses.some((className) => className.startsWith("aa-assist-brightness-"))).toBe(false);
      expect(clearedClasses.some((className) => className.startsWith("aa-assist-contrast-"))).toBe(false);
      expect(clearedClasses.some((className) => className.startsWith("aa-assist-smart-contrast-"))).toBe(false);
    });
  });
});

async function navigateToFixture(page: Page, fixtureName: string): Promise<void> {
  await page.goto(`${server.baseUrl}/${fixtureName}`);
}

async function injectBundle(page: Page): Promise<void> {
  // The widget defaults to Turkish; force English so the English-string
  // assertions below resolve via the loader's <html lang> fallback.
  await page.evaluate(() => {
    document.documentElement.lang = "en";
  });
  await page.addScriptTag({ path: bundlePath });
}

async function openPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open accessibility preferences" }).click();
  expect(await page.getByRole("dialog", { name: "Accessibility Preferences" }).isVisible()).toBe(true);
}

async function clickControl(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole("button", { name }).click();
}

async function clearPreferences(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Clear Preferences" }).click();
}

async function bodyHasClass(page: Page, className: string): Promise<boolean> {
  return page.evaluate((expectedClass) => document.body.classList.contains(expectedClass), className);
}

async function htmlClasses(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.documentElement.classList));
}

async function waitForText(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForFunction(
    ({ targetSelector, expectedText }) => document.querySelector(targetSelector)?.textContent === expectedText,
    { targetSelector: selector, expectedText: text }
  );
}

async function waitForCount(page: Page, selector: string, count: number): Promise<void> {
  await page.waitForFunction(
    ({ targetSelector, expectedCount }) => document.querySelectorAll(targetSelector).length === expectedCount,
    { targetSelector: selector, expectedCount: count }
  );
}

async function waitForAttribute(page: Page, selector: string, attribute: string, value: string): Promise<void> {
  await page.waitForFunction(
    ({ targetSelector, targetAttribute, expectedValue }) =>
      document.querySelector(targetSelector)?.getAttribute(targetAttribute) === expectedValue,
    { targetSelector: selector, targetAttribute: attribute, expectedValue: value }
  );
}

async function expectHiddenByVisibility(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return element ? getComputedStyle(element).visibility === "hidden" : false;
  }, selector);
}

async function expectVisibleByVisibility(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return element ? getComputedStyle(element).visibility === "visible" : false;
  }, selector);
}

async function expectDisplay(page: Page, selector: string, display: string): Promise<void> {
  await page.waitForFunction(
    ({ targetSelector, expectedDisplay }) => {
      const element = document.querySelector(targetSelector);
      return element ? getComputedStyle(element).display === expectedDisplay : false;
    },
    { targetSelector: selector, expectedDisplay: display }
  );
}

async function expectAnimationStopped(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return (
      element?.hasAttribute("data-aa-assist-original-style") === true &&
      element.classList.contains("aa-assist-animation-stopped")
    );
  }, selector);
}
