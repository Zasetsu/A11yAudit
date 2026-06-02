import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { assertSafeUrl } from "@a11yaudit/crawler";
import { DEFAULT_VIEWPORTS } from "@a11yaudit/core";
import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import type { LocalJobRunner } from "../jobs/local-job-runner.js";
import {
  createScanForWorkspace,
  hasActiveScanForProject,
  listScansForWorkspace,
  ScanProjectNotFoundError
} from "../repositories/scans.js";
import { getAuthorizedWorkspaceBySlug, type WorkspaceAuthContext } from "../repositories/workspaces.js";

const scanPayloadSchema = z.object({
  projectId: z.string().trim().min(1),
  url: z.string().trim().min(1),
  mode: z.enum(["single_url", "same_domain_crawl"]).default("single_url"),
  maxPages: z.number().int().min(1).max(250).default(10),
  maxDepth: z.number().int().min(0).max(5).default(1),
  viewports: z.array(z.enum(["desktop", "mobile"])).min(1).default(["desktop", "mobile"])
});

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

export interface ScanJobPayload {
  projectId: string;
  url: string;
  mode: "single_url" | "same_domain_crawl";
  maxPages: number;
  maxDepth: number;
  viewports: typeof DEFAULT_VIEWPORTS;
}

export interface ScanRouteOptions {
  db: SqliteDatabase;
  runner: LocalJobRunner<ScanJobPayload>;
}

function parseAuditUrl(input: string): string {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Scan URL must use http or https");
  }

  assertSafeUrl(url.href);

  return url.href;
}

function resolveViewports(names: z.infer<typeof scanPayloadSchema>["viewports"]): typeof DEFAULT_VIEWPORTS {
  return names.map((name) => {
    const viewport = DEFAULT_VIEWPORTS.find((candidate) => candidate.name === name);
    if (viewport === undefined) {
      throw new Error(`Unknown viewport: ${name}`);
    }

    return viewport;
  });
}

async function requireWorkspaceMembership(
  db: SqliteDatabase,
  userId: string,
  workspaceSlug: string,
  reply: FastifyReply
): Promise<WorkspaceAuthContext | undefined> {
  const context = await getAuthorizedWorkspaceBySlug(db, userId, workspaceSlug);
  if (!context) {
    await reply.code(404).send({ error: "Workspace not found" });
    return undefined;
  }

  return context;
}

export async function registerScanRoutes(app: FastifyInstance, options: ScanRouteOptions): Promise<void> {
  const { db, runner } = options;

  app.get("/api/workspaces/:workspaceSlug/scans", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    return { data: await listScansForWorkspace(db, context.workspaceId) };
  });

  app.post("/api/workspaces/:workspaceSlug/scans", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const parsed = scanPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid scan payload", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    let url: string;
    try {
      url = parseAuditUrl(parsed.data.url);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid scan URL" });
    }

    if (await hasActiveScanForProject(db, context.workspaceId, parsed.data.projectId)) {
      return reply.code(409).send({ error: "Project already has an active scan" });
    }

    let row: Awaited<ReturnType<typeof createScanForWorkspace>>;
    try {
      row = await createScanForWorkspace(db, context.workspaceId, {
        projectId: parsed.data.projectId,
        url,
        mode: parsed.data.mode,
        maxPages: parsed.data.maxPages,
        maxDepth: parsed.data.maxDepth,
        viewports: parsed.data.viewports
      });
    } catch (error) {
      if (error instanceof ScanProjectNotFoundError) {
        return reply.code(404).send({ error: "Project not found" });
      }

      throw error;
    }

    runner.enqueue(row.id, {
      projectId: row.projectId,
      url: row.url,
      mode: parsed.data.mode,
      maxPages: parsed.data.maxPages,
      maxDepth: parsed.data.maxDepth,
      viewports: resolveViewports(parsed.data.viewports)
    });

    return reply.code(201).send(row);
  });
}
