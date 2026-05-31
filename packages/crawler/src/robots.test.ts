import { describe, expect, it } from "vitest";
import { isAllowedByRobots, parseRobotsTxt } from "./robots";

describe("parseRobotsTxt", () => {
  it("parses wildcard user-agent disallow rules while ignoring comments and blank lines", () => {
    const rules = parseRobotsTxt(`
      # crawler policy
      User-agent: *

      Disallow: /private
      Disallow: /tmp # inline comment
      Disallow:
    `);

    expect(rules).toEqual({ disallow: ["/private", "/tmp"] });
  });

  it("ignores non-wildcard user-agent groups", () => {
    const rules = parseRobotsTxt(`
      User-agent: OtherBot
      Disallow: /other-only

      User-agent: *
      Disallow: /blocked
    `);

    expect(rules).toEqual({ disallow: ["/blocked"] });
  });
});

describe("isAllowedByRobots", () => {
  it("blocks URLs by pathname prefix", () => {
    const rules = { disallow: ["/private", "/tmp"] };

    expect(isAllowedByRobots(new URL("https://example.gov/private"), rules)).toBe(false);
    expect(isAllowedByRobots(new URL("https://example.gov/private/page"), rules)).toBe(false);
    expect(isAllowedByRobots(new URL("https://example.gov/public"), rules)).toBe(true);
  });
});
