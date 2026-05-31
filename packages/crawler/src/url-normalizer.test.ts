import { describe, expect, it } from "vitest";
import { normalizeAuditUrl, shouldSkipUrl } from "./index";

describe("normalizeAuditUrl", () => {
  it("removes fragments and tracking params", () => {
    expect(normalizeAuditUrl("https://example.gov/path/?utm_source=x&b=2#top")).toBe("https://example.gov/path?b=2");
  });

  it("skips unsupported protocols and static assets", () => {
    expect(shouldSkipUrl("mailto:test@example.gov")).toBe(true);
    expect(shouldSkipUrl("https://example.gov/file.pdf")).toBe(true);
    expect(shouldSkipUrl("https://example.gov/page")).toBe(false);
  });
});
