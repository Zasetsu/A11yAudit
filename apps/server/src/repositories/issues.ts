import { and, desc, eq, type SQL } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { issues, projects, scanRuns } from "../db/schema.js";

export type IssueRow = typeof issues.$inferSelect;
export type IssueResponse = Omit<IssueRow, "sampleUrls"> & { sampleUrls: string[] };

export interface IssueFilters {
  projectId?: string;
  scanRunId?: string;
}

function parseSampleUrls(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((url): url is string => typeof url === "string");
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string") : [];
  } catch {
    return [];
  }
}

export function mapIssueRow(row: IssueRow): IssueResponse {
  return {
    ...row,
    sampleUrls: parseSampleUrls(row.sampleUrls)
  };
}

function issueWorkspaceConditions(workspaceId: string, filters: IssueFilters = {}): SQL[] {
  const conditions: SQL[] = [eq(projects.workspaceId, workspaceId)];

  if (filters.projectId !== undefined) {
    conditions.push(eq(projects.id, filters.projectId));
  }

  if (filters.scanRunId !== undefined) {
    conditions.push(eq(scanRuns.id, filters.scanRunId));
  }

  return conditions;
}

export async function listIssuesForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  filters: IssueFilters = {}
): Promise<IssueResponse[]> {
  return db
    .select({ issue: issues })
    .from(issues)
    .innerJoin(scanRuns, eq(scanRuns.id, issues.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, issues.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(...issueWorkspaceConditions(workspaceId, filters)))
    .orderBy(desc(issues.occurrences))
    .all()
    .map((row) => mapIssueRow(row.issue));
}

export async function getIssueForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  issueId: string
): Promise<IssueResponse | null> {
  const row = db
    .select({ issue: issues })
    .from(issues)
    .innerJoin(scanRuns, eq(scanRuns.id, issues.scanRunId))
    .innerJoin(projects, and(
      eq(projects.id, issues.projectId),
      eq(projects.id, scanRuns.projectId)
    ))
    .where(and(
      eq(issues.id, issueId),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  return row ? mapIssueRow(row.issue) : null;
}
