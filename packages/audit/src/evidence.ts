import type { EvidenceArtifact, ScanFinding } from "@a11yaudit/core";
import { createArtifactKey, type StorageAdapter } from "@a11yaudit/storage";
import type { Page } from "playwright";

export interface CaptureEvidenceInput {
  runId: string;
  page: Page;
  finding: ScanFinding;
  storage: StorageAdapter;
}

export async function captureEvidence(input: CaptureEvidenceInput): Promise<EvidenceArtifact[]> {
  const artifacts: EvidenceArtifact[] = [];
  const pageScreenshot = await input.page.screenshot({ fullPage: true, type: "png" });
  const pageKey = createArtifactKey({
    runId: input.runId,
    kind: "screenshot",
    name: `${input.finding.fingerprint}:page`,
    extension: "png"
  });
  const storedPage = await input.storage.put(pageKey, Buffer.from(pageScreenshot), "image/png");
  artifacts.push({
    kind: "page_screenshot",
    artifactKey: storedPage.key,
    mimeType: storedPage.mimeType,
    sizeBytes: storedPage.sizeBytes
  });

  if (input.finding.htmlSnippet) {
    const snippetKey = createArtifactKey({
      runId: input.runId,
      kind: "snippet",
      name: `${input.finding.fingerprint}:html`,
      extension: "txt"
    });
    const storedSnippet = await input.storage.put(snippetKey, Buffer.from(input.finding.htmlSnippet), "text/plain");
    artifacts.push({
      kind: "html_snippet",
      artifactKey: storedSnippet.key,
      mimeType: storedSnippet.mimeType,
      sizeBytes: storedSnippet.sizeBytes
    });
  }

  return artifacts;
}
