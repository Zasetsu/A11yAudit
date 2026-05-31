import { describe, expect, it } from "vitest";
import { createArtifactKey } from "./artifact-keys.js";

describe("createArtifactKey", () => {
  it("creates path-safe stable artifact keys", () => {
    expect(
      createArtifactKey({
        runId: "run-1",
        kind: "screenshot",
        name: "https://example.com/a?b=c",
        extension: "png"
      })
    ).toMatch(/^runs\/run-1\/screenshot\/[a-z0-9_-]+\.png$/);
  });

  it("creates deterministic keys for the same input", () => {
    const input = {
      runId: "run-1",
      kind: "snippet" as const,
      name: "fingerprint:html",
      extension: "txt" as const
    };

    expect(createArtifactKey(input)).toBe(createArtifactKey(input));
  });

  it("rejects run IDs that could escape the runs directory", () => {
    expect(() =>
      createArtifactKey({
        runId: "../run-1",
        kind: "report",
        name: "report",
        extension: "html"
      })
    ).toThrow("Artifact runId must be path-safe");
  });

  it("rejects unsupported artifact kinds at runtime", () => {
    expect(() =>
      createArtifactKey({
        runId: "run-1",
        kind: "../screenshot" as "screenshot",
        name: "page",
        extension: "png"
      })
    ).toThrow("Artifact kind must be supported");
  });

  it("rejects unsupported artifact extensions at runtime", () => {
    expect(() =>
      createArtifactKey({
        runId: "run-1",
        kind: "screenshot",
        name: "page",
        extension: "../png" as "png"
      })
    ).toThrow("Artifact extension must be supported");
  });
});
