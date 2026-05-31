import { createHash } from "node:crypto";

export interface ArtifactKeyInput {
  runId: string;
  kind: "report" | "screenshot" | "snippet";
  name: string;
  extension: "html" | "pdf" | "png" | "txt";
}

export function createArtifactKey(input: ArtifactKeyInput): string {
  validateRunId(input.runId);
  validateKind(input.kind);
  validateExtension(input.extension);

  const digest = createHash("sha256").update(input.name).digest("base64url").slice(0, 24).toLowerCase();
  return `runs/${input.runId}/${input.kind}/${digest}.${input.extension}`;
}

function validateRunId(runId: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    throw new Error("Artifact runId must be path-safe");
  }
}

function validateKind(kind: ArtifactKeyInput["kind"]): void {
  if (!["report", "screenshot", "snippet"].includes(kind)) {
    throw new Error("Artifact kind must be supported");
  }
}

function validateExtension(extension: ArtifactKeyInput["extension"]): void {
  if (!["html", "pdf", "png", "txt"].includes(extension)) {
    throw new Error("Artifact extension must be supported");
  }
}
