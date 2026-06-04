import { and, desc, eq, ne, type SQL } from "drizzle-orm";

import type { BaselineIssue } from "@a11yaudit/core";

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

function toBaselineIssue(row: IssueRow): BaselineIssue {
  return {
    issueKey: row.issueKey,
    title: row.title,
    severity: row.severity as BaselineIssue["severity"],
    source: row.source as BaselineIssue["source"],
    certainty: row.certainty as BaselineIssue["certainty"],
    ruleId: row.ruleId,
    wcagCriteria: row.wcagCriteria.split(",").map((c) => c.trim()).filter(Boolean),
    description: row.description,
    recommendation: row.recommendation,
    likelyScope: row.likelyScope,
    urlScopeGroup: row.urlScopeGroup,
    componentArea: row.componentArea,
    cmsHint: row.cmsHint,
    confidence: row.confidence as BaselineIssue["confidence"],
    affectedPages: row.affectedPages,
    occurrences: row.occurrences,
    viewportSummary: row.viewportSummary,
    representativeUrl: row.representativeUrl,
    representativeSelector: row.representativeSelector,
    representativeHtmlSnippet: row.representativeHtmlSnippet,
    sampleUrls: parseSampleUrls(row.sampleUrls)
  };
}

export function getBaselineIssues(
  db: SqliteDatabase,
  params: { projectId: string; excludeScanRunId: string }
): BaselineIssue[] {
  const priorRun = db
    .select({ id: scanRuns.id })
    .from(scanRuns)
    .where(and(
      eq(scanRuns.projectId, params.projectId),
      eq(scanRuns.status, "completed"),
      ne(scanRuns.id, params.excludeScanRunId)
    ))
    .orderBy(desc(scanRuns.finishedAt))
    .limit(1)
    .get();

  if (!priorRun) {
    return [];
  }

  // Exclude resolved carry-over rows from the baseline. They are not "live" issues:
  // including them would re-resolve an already-fixed issue on every subsequent scan
  // (sticky resolved) and would mislabel a regressed issue as "ongoing" instead of "new".
  return db
    .select({ issue: issues })
    .from(issues)
    .where(and(eq(issues.scanRunId, priorRun.id), ne(issues.status, "resolved")))
    .all()
    .map((row) => toBaselineIssue(row.issue));
}
