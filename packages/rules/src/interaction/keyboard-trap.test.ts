import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runKeyboardTrapRule } from "./index.js";

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

describe("runKeyboardTrapRule", () => {
  it("reports a suspected keyboard trap when focus repeats among a small set of controls", async () => {
    const page = await openFixturePage("keyboard-trap.fail.html");
    try {
      const findings = await runKeyboardTrapRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "keyboard-trap-suspected",
        title: "Potential keyboard trap detected",
        severity: "critical",
        certainty: "needs_manual_verification",
        wcagCriteria: ["2.1.2"],
        selector: "#trap-start",
        visibleText: "Trap start"
      });
      expect(findings[0]?.htmlSnippet).toContain('id="trap-start"');
    } finally {
      await page.close();
    }
  });

  it("does not report normal sequential Tab navigation", async () => {
    const page = await openFixturePage("keyboard-trap.pass.html");
    try {
      const findings = await runKeyboardTrapRule({
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
