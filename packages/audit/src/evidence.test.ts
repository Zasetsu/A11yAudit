import type { ScanFinding } from "@a11yaudit/core";
import type { StorageAdapter, StoredArtifact } from "@a11yaudit/storage";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";
import { captureEvidence } from "./evidence.js";

class MemoryStorageAdapter implements StorageAdapter {
  readonly puts: Array<{ key: string; body: Buffer; mimeType: string }> = [];

  async put(key: string, body: Buffer, mimeType: string): Promise<StoredArtifact> {
    this.puts.push({ key, body, mimeType });
    return { key, mimeType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    const entry = this.puts.find((put) => put.key === key);
    if (!entry) {
      throw new Error(`Missing artifact: ${key}`);
    }

    return entry.body;
  }

  async delete(key: string): Promise<void> {
    const index = this.puts.findIndex((put) => put.key === key);
    if (index !== -1) {
      this.puts.splice(index, 1);
    }
  }
}

function createPage(): Page {
  return {
    screenshot: async () => Buffer.from("page image")
  } as unknown as Page;
}

function createFinding(htmlSnippet: string | null): ScanFinding {
  return {
    id: "finding-1",
    title: "Image missing alternative text",
    severity: "serious",
    status: "new",
    source: "axe",
    certainty: "automatic_violation",
    origin: "content",
    wcagCriteria: ["1.1.1"],
    ruleId: "image-alt",
    description: "Images must have alternate text",
    recommendation: "Add useful alt text",
    pageUrl: "https://example.com/",
    viewport: "desktop",
    selector: "img",
    htmlSnippet,
    visibleText: null,
    helpUrl: null,
    fingerprint: "fingerprint-1",
    evidence: [],
    instances: 1
  };
}

describe("captureEvidence", () => {
  it("always stores a page screenshot artifact", async () => {
    const storage = new MemoryStorageAdapter();

    const artifacts = await captureEvidence({
      runId: "run-1",
      page: createPage(),
      finding: createFinding(null),
      storage
    });

    expect(artifacts).toEqual([
      {
        kind: "page_screenshot",
        artifactKey: expect.stringMatching(/^runs\/run-1\/screenshot\/[a-z0-9_-]+\.png$/),
        mimeType: "image/png",
        sizeBytes: Buffer.byteLength("page image")
      }
    ]);
    expect(storage.puts).toHaveLength(1);
    expect(storage.puts[0]?.mimeType).toBe("image/png");
    expect(storage.puts[0]?.body).toEqual(Buffer.from("page image"));
  });

  it("stores an HTML snippet artifact when present", async () => {
    const storage = new MemoryStorageAdapter();

    const artifacts = await captureEvidence({
      runId: "run-1",
      page: createPage(),
      finding: createFinding("<img src=\"example.png\">"),
      storage
    });

    expect(artifacts).toHaveLength(2);
    expect(artifacts[1]).toEqual({
      kind: "html_snippet",
      artifactKey: expect.stringMatching(/^runs\/run-1\/snippet\/[a-z0-9_-]+\.txt$/),
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength("<img src=\"example.png\">")
    });
    expect(storage.puts[1]).toMatchObject({
      key: expect.stringMatching(/^runs\/run-1\/snippet\/[a-z0-9_-]+\.txt$/),
      mimeType: "text/plain"
    });
    expect(storage.puts[0]?.body).toEqual(Buffer.from("page image"));
    expect(storage.puts[1]?.body).toEqual(Buffer.from("<img src=\"example.png\">"));
  });

  it("does not store a snippet artifact when htmlSnippet is null", async () => {
    const storage = new MemoryStorageAdapter();

    const artifacts = await captureEvidence({
      runId: "run-1",
      page: createPage(),
      finding: createFinding(null),
      storage
    });

    expect(artifacts.map((artifact) => artifact.kind)).toEqual(["page_screenshot"]);
    expect(storage.puts.map((put) => put.mimeType)).toEqual(["image/png"]);
  });
});
