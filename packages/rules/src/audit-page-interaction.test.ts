import { createHash } from "node:crypto";
import { join } from "node:path";
import { createFindingFingerprint } from "@a11yaudit/core";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "./test-utils/fixture-server.js";
import { auditPage } from "./audit-page.js";

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

describe("auditPage interaction rules", () => {
  it("returns custom findings from interaction rules", async () => {
    const page = await openFixturePage("keyboard-unreachable-clickable.fail.html");
    try {
      const result = await auditPage({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport
      });

      const finding = result.findings.find((candidate) => candidate.ruleId === "keyboard-unreachable-clickable");

      expect(finding).toMatchObject({
        source: "custom",
        status: "new",
        origin: "unknown",
        helpUrl: null,
        evidence: [],
        instances: 1,
        wcagCriteria: ["2.1.1"],
        selector: "main > div.fake-button",
        visibleText: "Save changes"
      });
      expect(finding?.fingerprint).toBe(
        createFindingFingerprint({
          normalizedUrl: page.url(),
          viewport: "desktop",
          ruleId: "keyboard-unreachable-clickable",
          wcagCriteria: ["2.1.1"],
          elementSignature: "main > div.fake-button"
        })
      );
      expect(finding?.id).toBe(createStableFindingId(finding?.fingerprint ?? ""));
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

function createStableFindingId(fingerprint: string): string {
  return `finding-${createHash("sha256").update(fingerprint).digest("base64url").slice(0, 24)}`;
}
