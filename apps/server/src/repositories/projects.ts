import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { SqliteDatabase } from "../db/client.js";
import { issues, projects, reports, scanRuns } from "../db/schema.js";

export interface CreateProjectInput {
  name?: string;
  url?: string;
  domain?: string;
}

export type ProjectRow = typeof projects.$inferSelect;

export interface ProjectSummary {
  id: string;
  name: string;
  url: string;
  domain: string;
  createdAt: string;
  score: number | null;
  openFindings: number;
  reports: number;
  lastScan: string | null;
  crawlLimit: number | null;
  viewports: string | null;
}

export class DuplicateProjectDomainError extends Error {
  constructor() {
    super("Project domain already exists in workspace");
  }
}

const projectSummarySelection = {
  id: projects.id,
  name: projects.name,
  url: projects.url,
  domain: projects.domain,
  createdAt: projects.createdAt,
  score: sql<number | null>`(
    select ${scanRuns.score}
    from ${scanRuns}
    where ${scanRuns.projectId} = ${projects.id} and ${scanRuns.score} is not null
    order by ${scanRuns.createdAt} desc
    limit 1
  )`,
  openFindings: sql<number>`(
    select count(*)
    from ${issues}
    where ${issues.projectId} = ${projects.id}
      and ${issues.scanRunId} = (
        select ${scanRuns.id}
        from ${scanRuns}
        where ${scanRuns.projectId} = ${projects.id} and ${scanRuns.status} = 'completed'
        order by ${scanRuns.createdAt} desc
        limit 1
      )
  )`,
  reports: sql<number>`count(distinct ${reports.id})`,
  lastScan: sql<string | null>`max(${scanRuns.createdAt})`,
  crawlLimit: sql<number | null>`(
    select ${scanRuns.maxPages}
    from ${scanRuns}
    where ${scanRuns.projectId} = ${projects.id}
    order by ${scanRuns.createdAt} desc
    limit 1
  )`,
  viewports: sql<string | null>`(
    select ${scanRuns.viewports}
    from ${scanRuns}
    where ${scanRuns.projectId} = ${projects.id}
    order by ${scanRuns.createdAt} desc
    limit 1
  )`
};

function isDuplicateWorkspaceDomainError(error: unknown): boolean {
  return error instanceof Error
    && (
      error.message.includes("projects.workspace_id, projects.domain")
      || error.message.includes("projects_workspace_domain_unique")
    );
}

export async function listProjectsForWorkspace(db: SqliteDatabase, workspaceId: string): Promise<ProjectSummary[]> {
  return db
    .select(projectSummarySelection)
    .from(projects)
    .leftJoin(scanRuns, eq(scanRuns.projectId, projects.id))
    .leftJoin(reports, eq(reports.projectId, projects.id))
    .where(eq(projects.workspaceId, workspaceId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt))
    .all();
}

export async function createProjectForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  input: CreateProjectInput
): Promise<ProjectSummary> {
  const now = new Date().toISOString();
  const row = {
    id: `proj-${nanoid(10)}`,
    workspaceId,
    name: input.name ?? input.domain ?? input.url ?? "Project",
    url: input.url ?? "",
    domain: input.domain ?? "",
    createdAt: now
  };

  try {
    db.insert(projects).values(row).run();
  } catch (error) {
    if (isDuplicateWorkspaceDomainError(error)) {
      throw new DuplicateProjectDomainError();
    }

    throw error;
  }

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    domain: row.domain,
    createdAt: row.createdAt,
    score: null,
    openFindings: 0,
    reports: 0,
    lastScan: null,
    crawlLimit: null,
    viewports: null
  };
}

export async function getProjectForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  projectId: string
): Promise<ProjectRow | null> {
  return db
    .select()
    .from(projects)
    .where(and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspaceId)
    ))
    .get() ?? null;
}

export async function deleteProjectForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  projectId: string
): Promise<boolean> {
  const result = db
    .delete(projects)
    .where(and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspaceId)
    ))
    .run();

  return result.changes > 0;
}
