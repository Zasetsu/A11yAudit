import { describe, expect, it } from "vitest";

import { baseWorkspaceSlug } from "./slug.js";

describe("workspace slug primitives", () => {
  it("normalizes workspace names and blocks reserved slugs", () => {
    expect(baseWorkspaceSlug("Acme Accessibility Team")).toBe("acme-accessibility-team");
    expect(baseWorkspaceSlug("LOGIN")).toBe("workspace-login");
  });

  it("limits slugs to 64 characters and trims trailing separators", () => {
    expect(baseWorkspaceSlug(`${"a".repeat(70)} !!!`)).toBe("a".repeat(64));
  });

  it("removes invalid characters and collapses dashes", () => {
    expect(baseWorkspaceSlug(" Acme --- Audit_Desk + QA! ")).toBe("acme-auditdesk-qa");
  });

  it("falls back when the normalized slug is empty", () => {
    expect(baseWorkspaceSlug("     ")).toBe("workspace");
    expect(baseWorkspaceSlug("!!!")).toBe("workspace");
  });

  it("normalizes Turkish characters and diacritics to ASCII", () => {
    expect(baseWorkspaceSlug("İstanbul Erişilebilirlik Çalışma Grubu")).toBe("istanbul-erisilebilirlik-calisma-grubu");
    expect(baseWorkspaceSlug("Crème Brûlée")).toBe("creme-brulee");
  });
});
