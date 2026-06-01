import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runFocusVisibleRule } from "./focus-visible.js";

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

describe("runFocusVisibleRule", () => {
  it("reports focused controls with no detectable focus indicator", async () => {
    const page = await openFixturePage("focus-visible.fail.html");
    try {
      const findings = await runFocusVisibleRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      expect(findings).toHaveLength(2);
      expect(findings[0]).toMatchObject({
        ruleId: "focus-visible-missing",
        title: "Focused element has no detectable focus indicator",
        severity: "serious",
        certainty: "needs_manual_verification",
        wcagCriteria: ["2.4.7"],
        selector: "main > button",
        visibleText: "Save changes"
      });
      expect(findings[0]?.htmlSnippet).toContain("<button");
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "focus-visible-missing",
            visibleText: "Cancel changes"
          })
        ])
      );
    } finally {
      await page.close();
    }
  });

  it("does not report focused controls with a visible focus indicator", async () => {
    const page = await openFixturePage("focus-visible.pass.html");
    try {
      const findings = await runFocusVisibleRule({
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
