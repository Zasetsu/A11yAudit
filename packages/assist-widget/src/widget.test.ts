import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

describe("AssistWidget", () => {
  it("mounts the built bundle, opens the preferences panel, applies line height, and clears it", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p id='copy'>Readable copy</p></main>");

    await page.addScriptTag({ path: "packages/assist-widget/dist/a11yaudit-assist.js" });

    const launcher = page.getByRole("button", { name: "Open accessibility preferences" });
    expect(await launcher.count()).toBe(1);

    await launcher.click();

    const panel = page.getByRole("dialog", { name: "Accessibility Preferences" });
    expect(await panel.isVisible()).toBe(true);

    const lineHeight = page.getByRole("button", { name: /Line Height/ });
    expect(await lineHeight.count()).toBe(1);
    await lineHeight.click();

    const generatedCss = await page.locator("#aa-assist-generated-styles").textContent();
    expect(generatedCss).toContain("line-height: 1.5");

    await page.getByRole("button", { name: "Clear Preferences" }).click();

    expect(await page.locator("#aa-assist-generated-styles").count()).toBe(0);
    await page.close();
  });

  it("isolates widget UI in shadow DOM and preserves keyboard focus", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <style>
        button { display: none !important; color: rgb(255, 0, 0) !important; }
      </style>
      <main><p id="copy">Readable copy</p></main>
    `);

    await page.addScriptTag({ path: "packages/assist-widget/dist/a11yaudit-assist.js" });

    expect(await page.evaluate(() => document.querySelector(".aa-assist-launcher") === null)).toBe(true);
    expect(
      await page.locator("#aa-assist-root").evaluate((root) => {
        const launcher = root.shadowRoot?.querySelector(".aa-assist-launcher");
        return launcher ? getComputedStyle(launcher).display : "";
      })
    ).not.toBe("none");

    await page.getByRole("button", { name: "Open accessibility preferences" }).click();
    expect(
      await page.locator("#aa-assist-root").evaluate((root) => root.shadowRoot?.activeElement?.getAttribute("aria-label"))
    ).toBe("Close accessibility preferences");

    await page.keyboard.press("Shift+Tab");
    expect(
      await page.locator("#aa-assist-root").evaluate((root) => root.shadowRoot?.activeElement?.getAttribute("aria-label"))
    ).toBe("Clear Preferences");

    await page.getByRole("button", { name: /Line Height/ }).click();
    expect(
      await page.locator("#aa-assist-root").evaluate((root) => root.shadowRoot?.activeElement?.getAttribute("aria-label"))
    ).toBe("Line Height step 1");

    await page.keyboard.press("Escape");
    expect(await page.getByRole("dialog", { name: "Accessibility Preferences" }).count()).toBe(0);
    expect(
      await page.locator("#aa-assist-root").evaluate((root) => root.shadowRoot?.activeElement?.getAttribute("aria-label"))
    ).toBe("Open accessibility preferences");
    await page.close();
  });

  it("can initialize again after the loader-owned instance is unmounted", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p>Readable copy</p></main>");

    await page.addScriptTag({ path: "packages/assist-widget/dist/a11yaudit-assist.js" });

    await page.evaluate(() => {
      window.__A11Y_AUDIT_ASSIST__?.unmount();
      window.A11yAuditAssist.initAssistWidget();
    });

    const launcher = page.getByRole("button", { name: "Open accessibility preferences" });
    expect(await launcher.count()).toBe(1);

    await launcher.click();
    expect(await page.getByRole("dialog", { name: "Accessibility Preferences" }).isVisible()).toBe(true);
    await page.close();
  });

  it("ignores fake pre-seeded globals when the widget is not mounted", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p>Readable copy</p></main>");
    await page.evaluate(() => {
      window.__A11Y_AUDIT_ASSIST__ = {
        clearPreferences() {},
        unmount() {}
      };
    });

    await page.addScriptTag({ path: "packages/assist-widget/dist/a11yaudit-assist.js" });

    expect(await page.getByRole("button", { name: "Open accessibility preferences" }).count()).toBe(1);
    await page.close();
  });

  it("respects enabled section configuration", async () => {
    const page = await browser.newPage();
    await page.setContent("<main><p>Readable copy</p></main>");

    await page.addScriptTag({ path: "packages/assist-widget/dist/a11yaudit-assist.js" });
    await page.evaluate(() => {
      window.__A11Y_AUDIT_ASSIST__?.unmount();
      window.A11yAuditAssist.initAssistWidget({ enabledSections: ["color"] });
    });

    await page.getByRole("button", { name: "Open accessibility preferences" }).click();

    expect(await page.getByRole("button", { name: /Line Height/ }).count()).toBe(0);
    expect(await page.getByRole("button", { name: /Page Reader/ }).count()).toBe(0);
    expect(await page.getByRole("button", { name: /Monochrome/ }).count()).toBe(1);
    await page.close();
  });

  it("normalizes invalid persisted preferences before mounting", async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.route("http://a11yaudit-assist.test/", (route) => {
      void route.fulfill({
        contentType: "text/html",
        body: "<main><p>Readable copy</p></main>"
      });
    });
    await page.goto("http://a11yaudit-assist.test/");
    await page.evaluate(() => {
      window.localStorage.setItem(
        "aa-assist-preferences",
        JSON.stringify({ color: { contrast: { enabled: true, step: 3 } } })
      );
    });

    await page.addScriptTag({ path: "packages/assist-widget/dist/a11yaudit-assist.js" });

    expect(errors).toEqual([]);
    expect(await page.getByRole("button", { name: "Open accessibility preferences" }).count()).toBe(1);
    expect(await page.locator("html").evaluate((element) => element.className)).not.toContain("aa-assist-contrast");
    await page.close();
  });
});
