import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { SqliteDatabase } from "../db/client.js";
import { projects, scanRuns } from "../db/schema.js";

export interface CreateScanInput {
  projectId: string;
  url: string;
  mode: "single_url" | "same_domain_crawl";
  maxPages: number;
  maxDepth: number;
  viewports: string[];
}

export interface ScanRunSummary {
  id: string;
  projectId: string;
  projectName: string;
  url: string;
  status: string;
  mode: string;
  maxPages: number;
  maxDepth: number;
  viewports: string;
  pagesQueued: number;
  pagesScanned: number;
  findingsTotal: number;
  score: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
}

export class ScanProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
  }
}

export class ActiveScanAlreadyExistsError extends Error {
  constructor() {
    super("Project already has an active scan");
  }
}

function isActiveScanUniqueError(error: unknown): boolean {
  return error instanceof Error
    && (
      error.message.includes("scan_runs.project_id")
      || error.message.includes("scan_runs_active_project_unique")
    );
}

const scanSummarySelection = {
  id: scanRuns.id,
  projectId: scanRuns.projectId,
  projectName: projects.name,
  url: scanRuns.url,
  status: scanRuns.status,
  mode: scanRuns.mode,
  maxPages: scanRuns.maxPages,
  maxDepth: scanRuns.maxDepth,
  viewports: scanRuns.viewports,
  pagesQueued: scanRuns.pagesQueued,
  pagesScanned: scanRuns.pagesScanned,
  findingsTotal: scanRuns.findingsTotal,
  score: scanRuns.score,
  createdAt: scanRuns.createdAt,
  startedAt: scanRuns.startedAt,
  finishedAt: scanRuns.finishedAt,
  errorMessage: scanRuns.errorMessage
};

export async function listScansForWorkspace(db: SqliteDatabase, workspaceId: string): Promise<ScanRunSummary[]> {
  return db
    .select(scanSummarySelection)
    .from(scanRuns)
    .innerJoin(projects, eq(scanRuns.projectId, projects.id))
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(scanRuns.createdAt))
    .all();
}

export async function createScanForWorkspace(
  db: SqliteDatabase,
  workspaceId: string,
  input: CreateScanInput
): Promise<ScanRunSummary> {
  const project = db
    .select({
      id: projects.id,
      name: projects.name
    })
    .from(projects)
    .where(and(
      eq(projects.id, input.projectId),
      eq(projects.workspaceId, workspaceId)
    ))
    .get();

  if (project === undefined) {
    throw new ScanProjectNotFoundError();
  }

  const now = new Date().toISOString();
  const row = {
    id: `run-${nanoid(10)}`,
    projectId: input.projectId,
    url: input.url,
    status: "queued",
    mode: input.mode,
    maxPages: input.maxPages,
    maxDepth: input.maxDepth,
    viewports: input.viewports.join(","),
    pagesQueued: 0,
    pagesScanned: 0,
    findingsTotal: 0,
    score: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    errorMessage: null
  };

  try {
    db.insert(scanRuns).values(row).run();
  } catch (error) {
    if (isActiveScanUniqueError(error)) {
      throw new ActiveScanAlreadyExistsError();
    }

    throw error;
  }

  return {
    ...row,
    projectName: project.name
  };
}

export async function hasActiveScanForProject(
  db: SqliteDatabase,
  workspaceId: string,
  projectId: string
): Promise<boolean> {
  const row = db
    .select({ id: scanRuns.id })
    .from(scanRuns)
    .innerJoin(projects, eq(scanRuns.projectId, projects.id))
    .where(and(
      eq(projects.workspaceId, workspaceId),
      eq(scanRuns.projectId, projectId),
      inArray(scanRuns.status, ["queued", "crawling", "auditing", "reporting"])
    ))
    .get();

  return row !== undefined;
}
