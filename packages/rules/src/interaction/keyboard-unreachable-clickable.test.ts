import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { keyboardUnreachableClickableRule } from "./keyboard-unreachable-clickable.js";

const fixtureDir = join(process.cwd(), "packages/rules/fixtures/interaction");
const viewport = { name: "desktop" as const, width: 1280, height: 720 };

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch();
  server = await serveFixtureDirectory(fixtureDir);
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("keyboardUnreachableClickableRule", () => {
  it("reports visible clickable controls that are not reached by sequential Tab navigation", async () => {
    const page = await openFixturePage("keyboard-unreachable-clickable.fail.html");
    try {
      const findings = await keyboardUnreachableClickableRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "keyboard-unreachable-clickable",
        title: "Clickable control is not reachable by keyboard",
        severity: "serious",
        certainty: "automatic_violation",
        wcagCriteria: ["2.1.1"],
        selector: "main > div.fake-button",
        visibleText: "Save changes"
      });
      expect(findings[0]?.htmlSnippet).toContain('class="fake-button"');
      expect(findings[0]?.recommendation).toContain("native interactive element");
    } finally {
      await page.close();
    }
  });

  it("does not report native controls reached by sequential Tab navigation", async () => {
    const page = await openFixturePage("keyboard-unreachable-clickable.pass.html");
    try {
      const findings = await keyboardUnreachableClickableRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      expect(findings).toHaveLength(0);
    } finally {
      await page.close();
    }
  });
});

async function openFixturePage(fileName: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(`${server.baseUrl}/${fileName}`);
  return page;
}
