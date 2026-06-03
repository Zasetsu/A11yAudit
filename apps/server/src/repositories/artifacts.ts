import { and, eq } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { evidenceArtifacts, projects, reports, scanRuns } from "../db/schema.js";

export interface AuthorizedArtifact {
  artifactKey: string;
  mimeType: string;
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
  const row = db
    .select({
      artifactKey: evidenceArtifacts.artifactKey,
      mimeType: evidenceArtifacts.mimeType
    })
    .from(evidenceArtifacts)
    .innerJoin(projects, eq(projects.id, evidenceArtifacts.projectId))
    .where(and(
      eq(evidenceArtifacts.artifactKey, key),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  return row ?? null;
}

export async function getAuthorizedArtifactForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  key: string
): Promise<AuthorizedArtifact | null> {
  return getReportArtifactForWorkspace(db, workspaceId, key)
    ?? getFindingEvidenceArtifactForWorkspace(db, workspaceId, key);
}
