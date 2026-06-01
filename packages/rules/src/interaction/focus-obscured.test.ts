import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runFocusObscuredRule } from "./focus-obscured.js";

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

describe("runFocusObscuredRule", () => {
  it("reports focused controls whose center point is covered by fixed content", async () => {
    const page = await openFixturePage("focus-obscured.fail.html");
    try {
      const findings = await runFocusObscuredRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "focus-obscured-or-offscreen",
        title: "Focused element appears offscreen or obscured",
        severity: "serious",
        certainty: "needs_manual_verification",
        wcagCriteria: ["2.4.11"],
        selector: "main > button",
        visibleText: "Hidden primary action"
      });
      expect(findings[0]?.htmlSnippet).toContain("<button");
    } finally {
      await page.close();
    }
  });

  it("does not report focused controls offset below a fixed header", async () => {
    const page = await openFixturePage("focus-obscured.pass.html");
    try {
      const findings = await runFocusObscuredRule({
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
