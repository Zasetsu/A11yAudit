import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { assertSafeUrl } from "@a11yaudit/crawler";
import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import {
  createProjectForWorkspace,
  deleteProjectForWorkspace,
  DuplicateProjectDomainError,
  listProjectsForWorkspace
} from "../repositories/projects.js";
import {
  getAuthorizedWorkspaceBySlug,
  requireWorkspaceRole,
  WorkspaceRoleError,
  type WorkspaceAuthContext
} from "../repositories/workspaces.js";

const projectPayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
    domain: z.string().trim().min(1).optional()
  })
  .refine((payload) => payload.url !== undefined || payload.domain !== undefined, {
    message: "url or domain is required"
  });

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

const projectParamsSchema = workspaceParamsSchema.extend({
  projectId: z.string().trim().min(1)
});

function assertSafeTarget(url: string): void {
  assertSafeUrl(url);
}

function parseProjectTarget(payload: z.infer<typeof projectPayloadSchema>): { url: string; domain: string } {
  if (payload.url !== undefined) {
    const url = new URL(payload.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Project URL must use http or https");
    }
    assertSafeTarget(url.href);
    return { url: url.href, domain: url.hostname };
  }

  const url = new URL(`https://${payload.domain}`);
  if (!url.hostname.includes(".")) {
    throw new Error("Project domain must be a valid hostname");
  }
  assertSafeTarget(url.href);
  return { url: url.href, domain: url.hostname };
}

export interface ProjectRouteOptions {
  db: SqliteDatabase;
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

function requireWorkspaceOwner(context: WorkspaceAuthContext, reply: FastifyReply): boolean {
  try {
    requireWorkspaceRole(context, ["owner"]);
    return true;
  } catch (error) {
    if (error instanceof WorkspaceRoleError) {
      reply.code(403).send({ error: "Workspace owner role required" });
      return false;
    }

    throw error;
  }
}

export async function registerProjectRoutes(app: FastifyInstance, options: ProjectRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/workspaces/:workspaceSlug/projects", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    return { data: await listProjectsForWorkspace(db, context.workspaceId) };
  });

  app.post("/api/workspaces/:workspaceSlug/projects", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const parsed = projectPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid project payload", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    let target: { url: string; domain: string };
    try {
      target = parseProjectTarget(parsed.data);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid project target" });
    }

    try {
      const row = await createProjectForWorkspace(db, context.workspaceId, {
        name: parsed.data.name ?? target.domain,
        url: target.url,
        domain: target.domain
      });

      return reply.code(201).send(row);
    } catch (error) {
      if (error instanceof DuplicateProjectDomainError) {
        return reply.code(409).send({ error: "Project domain already exists in workspace" });
      }

      throw error;
    }
  });

  app.delete("/api/workspaces/:workspaceSlug/projects/:projectId", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid project parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    const deleted = await deleteProjectForWorkspace(db, context.workspaceId, params.data.projectId);
    if (!deleted) {
      return reply.code(404).send({ error: "Project not found" });
    }

    return { data: { ok: true } };
  });
}
