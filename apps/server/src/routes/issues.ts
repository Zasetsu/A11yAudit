import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import { getIssueForWorkspace, listIssuesForWorkspace } from "../repositories/issues.js";
import { getAuthorizedWorkspaceBySlug, type WorkspaceAuthContext } from "../repositories/workspaces.js";

const issueQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

const issueParamsSchema = workspaceParamsSchema.extend({
  issueId: z.string().trim().min(1)
});

export interface IssueRouteOptions {
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

export async function registerIssueRoutes(app: FastifyInstance, options: IssueRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/workspaces/:workspaceSlug/issues", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const parsed = issueQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid issue query", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    return { data: await listIssuesForWorkspace(db, context.workspaceId, parsed.data) };
  });

  app.get("/api/workspaces/:workspaceSlug/issues/:issueId", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = issueParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid issue parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    const issue = await getIssueForWorkspace(db, context.workspaceId, params.data.issueId);
    if (!issue) {
      return reply.code(404).send({ error: "Issue not found" });
    }

    return issue;
  });
}
