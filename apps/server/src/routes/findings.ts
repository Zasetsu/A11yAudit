import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import { listFindingsForWorkspace } from "../repositories/findings.js";
import { getAuthorizedWorkspaceBySlug, type WorkspaceAuthContext } from "../repositories/workspaces.js";

const findingQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

export interface FindingRouteOptions {
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

export async function registerFindingRoutes(app: FastifyInstance, options: FindingRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/workspaces/:workspaceSlug/findings", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const parsed = findingQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid finding query", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    return { data: await listFindingsForWorkspace(db, context.workspaceId, parsed.data) };
  });
}
