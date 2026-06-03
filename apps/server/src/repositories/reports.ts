import { and, desc, eq, type SQL } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { projects, reports, scanRuns } from "../db/schema.js";

export interface ReportFilters {
  projectId?: string;
  scanRunId?: string;
}

export interface ReportListRow {
  id: string;
  projectId: string;
  projectName: string;
  scanRunId: string;
  kind: string;
  artifactKey: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export type ReportRow = typeof reports.$inferSelect;

function reportWorkspaceConditions(workspaceId: string, filters: ReportFilters = {}): SQL[] {
  const conditions: SQL[] = [eq(projects.workspaceId, workspaceId)];

  if (filters.projectId !== undefined) {
    conditions.push(eq(projects.id, filters.projectId));
  }

  if (filters.scanRunId !== undefined) {
    conditions.push(eq(scanRuns.id, filters.scanRunId));
  }

  return conditions;
}

export async function listReportsForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  filters: ReportFilters = {}
): Promise<ReportListRow[]> {
  return db
    .select({
      id: reports.id,
      projectId: reports.projectId,
      projectName: projects.name,
      scanRunId: reports.scanRunId,
      kind: reports.kind,
      artifactKey: reports.artifactKey,
      mimeType: reports.mimeType,
      sizeBytes: reports.sizeBytes,
      createdAt: reports.createdAt
    })
    .from(reports)
    .innerJoin(scanRuns, eq(scanRuns.id, reports.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, reports.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(...reportWorkspaceConditions(workspaceId, filters)))
    .orderBy(desc(reports.createdAt))
    .all();
}

export async function getReportForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  reportId: string
): Promise<ReportRow | null> {
  const row = db
    .select({ report: reports })
    .from(reports)
    .innerJoin(scanRuns, eq(scanRuns.id, reports.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, reports.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(
      eq(reports.id, reportId),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  return row?.report ?? null;
}
