import { createHash } from "node:crypto";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFindingFingerprint } from "@a11yaudit/core";
import { auditPage } from "./audit-page.js";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("auditPage", () => {
  it("returns axe violations as normalized technical findings", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.setContent('<main><img src="/missing-alt.png"><button></button></main>', {
        waitUntil: "domcontentloaded"
      });

      const result = await auditPage({
        page,
        url: "https://example.com/",
        normalizedUrl: "https://example.com/",
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(result.page).toMatchObject({
        url: "https://example.com/",
        normalizedUrl: "https://example.com/",
        viewport: "desktop",
        statusCode: null,
        finalUrl: "about:blank",
        errorMessage: null
      });
      expect(result.page.durationMs).toBeGreaterThanOrEqual(0);
      expect(
        result.findings.some((finding) => finding.ruleId === "image-alt" || finding.ruleId === "button-name")
      ).toBe(true);
      expect(result.findings.every((finding) => finding.certainty === "automatic_violation")).toBe(true);
      expect(result.findings.every((finding) => finding.evidence.length === 0)).toBe(true);

      const imageAltFinding = result.findings.find((finding) => finding.ruleId === "image-alt");
      expect(imageAltFinding).toBeDefined();
      expect(imageAltFinding).toMatchObject({
        source: "axe",
        status: "new",
        origin: "unknown",
        pageUrl: "https://example.com/",
        viewport: "desktop",
        selector: "img",
        htmlSnippet: '<img src="/missing-alt.png">',
        visibleText: null,
        instances: 1
      });
      expect(imageAltFinding?.fingerprint).toBe(
        createFindingFingerprint({
          normalizedUrl: "https://example.com/",
          viewport: "desktop",
          ruleId: "image-alt",
          wcagCriteria: imageAltFinding?.wcagCriteria ?? [],
          elementSignature: imageAltFinding?.selector ?? ""
        })
      );
      expect(imageAltFinding?.id).toBe(createStableFindingId(imageAltFinding?.fingerprint ?? ""));
      expect(imageAltFinding?.id).not.toMatch(/:\d+$/);
    } finally {
      await page.close();
    }
  });
});

function createStableFindingId(fingerprint: string): string {
  return `finding-${createHash("sha256").update(fingerprint).digest("base64url").slice(0, 24)}`;
}
