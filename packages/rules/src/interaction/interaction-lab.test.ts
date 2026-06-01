import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runInteractionRules } from "./index.js";

const fixtureDir = join(process.cwd(), "packages/rules/fixtures/interaction-lab");
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

describe("interaction lab fixture", () => {
  it("returns findings from multiple custom interaction rules", async () => {
    const page = await openLabPage();
    try {
      const findings = await runInteractionRules({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      const ruleIds = findings.map((finding) => finding.ruleId);

      expect(ruleIds).toContain("keyboard-unreachable-clickable");
      expect(ruleIds).toContain("focus-visible-missing");
    } finally {
      await page.close();
    }
  });
});

async function openLabPage(): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(server.baseUrl);
  return page;
}
