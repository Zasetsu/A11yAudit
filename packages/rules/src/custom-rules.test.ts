import { describe, expect, it } from "vitest";
import { isSuspiciousAltText, isWeakLinkText } from "./index";

describe("custom rules", () => {
  it("detects suspicious alt text", () => {
    expect(isSuspiciousAltText("image")).toBe(true);
    expect(isSuspiciousAltText("photo")).toBe(true);
    expect(isSuspiciousAltText("Mayor speaking at city hall")).toBe(false);
  });

  it("detects weak link text", () => {
    expect(isWeakLinkText("click here")).toBe(true);
    expect(isWeakLinkText("read more")).toBe(true);
    expect(isWeakLinkText("Apply for housing benefits")).toBe(false);
  });
});
