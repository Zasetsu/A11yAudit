import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { StorageAdapter } from "@a11yaudit/storage";
import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import { getAuthorizedArtifactForWorkspace } from "../repositories/artifacts.js";
import { getAuthorizedWorkspaceBySlug, type WorkspaceAuthContext } from "../repositories/workspaces.js";

const artifactQuerySchema = z.object({
  key: z.string().trim().min(1)
});

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

export interface ArtifactRouteOptions {
  db: SqliteDatabase;
  storage: StorageAdapter;
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

export async function registerArtifactRoutes(app: FastifyInstance, options: ArtifactRouteOptions): Promise<void> {
  const { db, storage } = options;

  app.get("/api/workspaces/:workspaceSlug/artifacts/download", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const parsed = artifactQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid artifact query", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    const key = parsed.data.key;
    const artifact = await getAuthorizedArtifactForWorkspace(db, context.workspaceId, key);
    if (!artifact) {
      return reply.code(404).send({ error: "Artifact not found" });
    }

    let body: Buffer;
    try {
      body = await storage.get(key);
    } catch {
      return reply.code(404).send({ error: "Artifact not found" });
    }

    return reply
      .header("content-type", artifact.mimeType)
      .header("content-length", body.byteLength)
      .send(body);
  });
}
