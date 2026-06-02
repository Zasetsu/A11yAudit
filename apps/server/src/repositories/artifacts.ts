import { and, eq } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { findings, projects, reports, scanRuns } from "../db/schema.js";

interface EvidenceArtifactRow {
  artifactKey?: unknown;
  mimeType?: unknown;
}

export interface AuthorizedArtifact {
  artifactKey: string;
  mimeType: string;
}

function findEvidenceArtifactMetadata(evidence: string, key: string): AuthorizedArtifact | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(evidence);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const artifact = item as EvidenceArtifactRow;
    if (artifact.artifactKey === key && typeof artifact.mimeType === "string") {
      return { artifactKey: key, mimeType: artifact.mimeType };
    }
  }

  return null;
}

function getReportArtifactForWorkspace(db: SqliteDatabase, workspaceId: string, key: string): AuthorizedArtifact | null {
  const row = db
    .select({
      artifactKey: reports.artifactKey,
      mimeType: reports.mimeType
    })
    .from(reports)
    .innerJoin(scanRuns, eq(scanRuns.id, reports.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, reports.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(
      eq(reports.artifactKey, key),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  return row ?? null;
}

function getFindingEvidenceArtifactForWorkspace(db: SqliteDatabase, workspaceId: string, key: string): AuthorizedArtifact | null {
  for (const row of db
    .select({ evidence: findings.evidence })
    .from(findings)
    .innerJoin(scanRuns, eq(scanRuns.id, findings.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, findings.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(eq(projects.workspaceId, workspaceId))
    .all()) {
    const artifact = findEvidenceArtifactMetadata(row.evidence, key);
    if (artifact !== null) return artifact;
  }

  return null;
}

export async function getAuthorizedArtifactForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  key: string
): Promise<AuthorizedArtifact | null> {
  return getReportArtifactForWorkspace(db, workspaceId, key)
    ?? getFindingEvidenceArtifactForWorkspace(db, workspaceId, key);
}
