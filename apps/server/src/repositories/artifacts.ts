import { and, eq } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { findings, projects, reports, scanRuns } from "../db/schema.js";

interface EvidenceArtifactRow {
  artifactKey?: unknown;
}

function evidenceReferencesKey(evidence: string, key: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(evidence);
  } catch {
    return false;
  }

  if (!Array.isArray(parsed)) return false;

  return parsed.some((item: unknown) => {
    if (item === null || typeof item !== "object") return false;
    return (item as EvidenceArtifactRow).artifactKey === key;
  });
}

function reportArtifactExistsForWorkspace(db: SqliteDatabase, workspaceId: string, key: string): boolean {
  const row = db
    .select({ id: reports.id })
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

  return row !== undefined;
}

function findingEvidenceArtifactExistsForWorkspace(db: SqliteDatabase, workspaceId: string, key: string): boolean {
  return db
    .select({ evidence: findings.evidence })
    .from(findings)
    .innerJoin(scanRuns, eq(scanRuns.id, findings.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, findings.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(eq(projects.workspaceId, workspaceId))
    .all()
    .some((row) => evidenceReferencesKey(row.evidence, key));
}

export async function isArtifactAuthorizedForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  key: string
): Promise<boolean> {
  return reportArtifactExistsForWorkspace(db, workspaceId, key)
    || findingEvidenceArtifactExistsForWorkspace(db, workspaceId, key);
}
