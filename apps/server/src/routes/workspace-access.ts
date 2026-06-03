import type { FastifyReply } from "fastify";
import { z } from "zod";

import type { SqliteDatabase } from "../db/client.js";
import {
  getAuthorizedWorkspaceBySlug,
  requireWorkspaceRole,
  WorkspaceRoleError,
  type WorkspaceAuthContext
} from "../repositories/workspaces.js";

export const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

export async function requireWorkspaceMembership(
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

export function requireWorkspaceOwner(context: WorkspaceAuthContext, reply: FastifyReply): boolean {
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
