import { and, desc, eq, type SQL } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { findings, projects, scanRuns } from "../db/schema.js";

export type FindingRow = typeof findings.$inferSelect;

export interface FindingFilters {
  projectId?: string;
  scanRunId?: string;
}

function findingWorkspaceConditions(workspaceId: string, filters: FindingFilters = {}): SQL[] {
  const conditions: SQL[] = [eq(projects.workspaceId, workspaceId)];

  if (filters.projectId !== undefined) {
    conditions.push(eq(projects.id, filters.projectId));
  }

  if (filters.scanRunId !== undefined) {
    conditions.push(eq(scanRuns.id, filters.scanRunId));
  }

  return conditions;
}

export async function listFindingsForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  filters: FindingFilters = {}
): Promise<FindingRow[]> {
  return db
    .select({ finding: findings })
    .from(findings)
    .innerJoin(scanRuns, eq(scanRuns.id, findings.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, findings.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(...findingWorkspaceConditions(workspaceId, filters)))
    .orderBy(desc(findings.createdAt))
    .all()
    .map((row) => row.finding);
}
