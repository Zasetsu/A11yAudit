import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  serializeCsrfCookie,
  serializeSessionCookie
} from "../auth/cookies.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { createSession, requireAuth } from "../auth/session.js";
import { createPlainToken, hashToken } from "../auth/tokens.js";
import type { SqliteDatabase } from "../db/client.js";
import { users, workspaceInvitations, workspaceMembers, workspaces } from "../db/schema.js";
import {
  getAuthorizedWorkspaceBySlug,
  listMemberships,
  requireWorkspaceRole,
  WorkspaceRoleError,
  type WorkspaceAuthContext,
  type WorkspaceRole
} from "../repositories/workspaces.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().trim().min(1)
});

const invitationParamsSchema = workspaceParamsSchema.extend({
  invitationId: z.string().trim().min(1)
});

const acceptParamsSchema = z.object({
  token: z.string().trim().min(1)
});

const createInvitationPayloadSchema = z.object({
  email: z.string().trim().email(),
  role: z.literal("member").optional().default("member")
});

const acceptInvitationPayloadSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8)
});

export interface WorkspaceRouteOptions {
  db: SqliteDatabase;
}

type SessionUser = {
  id: string;
  fullName: string;
  email: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function setSessionCookies(reply: FastifyReply, session: { sessionToken: string; csrfToken: string }): void {
  reply.header("Set-Cookie", [
    serializeSessionCookie(session.sessionToken),
    serializeCsrfCookie(session.csrfToken)
  ]);
}

async function sessionPayload(db: SqliteDatabase, user: SessionUser): Promise<{
  user: SessionUser;
  workspaces: Awaited<ReturnType<typeof listMemberships>>;
}> {
  return {
    user,
    workspaces: await listMemberships(db, user.id)
  };
}

async function requireWorkspaceMembership(
  db: SqliteDatabase,
  userId: string,
  slug: string,
  reply: FastifyReply
): Promise<WorkspaceAuthContext | undefined> {
  const context = await getAuthorizedWorkspaceBySlug(db, userId, slug);
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

function parseWorkspaceParams(params: unknown): { workspaceSlug: string } | null {
  const parsed = workspaceParamsSchema.safeParse(params);
  return parsed.success ? parsed.data : null;
}

function serializeInvitation(row: {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
}): {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
} {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expiresAt
  };
}

export async function registerWorkspaceRoutes(app: FastifyInstance, options: WorkspaceRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/workspaces", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    return { data: { workspaces: await listMemberships(db, user.id) } };
  });

  app.get("/api/workspaces/:workspaceSlug", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = parseWorkspaceParams(request.params);
    if (!params) {
      return reply.code(400).send({ error: "Invalid workspace parameters" });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.workspaceSlug, reply);
    if (!context) return undefined;

    const workspace = db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug
      })
      .from(workspaces)
      .where(eq(workspaces.id, context.workspaceId))
      .get();

    if (!workspace) {
      return reply.code(404).send({ error: "Workspace not found" });
    }

    return {
      data: {
        workspace: {
          ...workspace,
          role: context.role
        }
      }
    };
  });

  app.post("/api/workspaces/:workspaceSlug/invitations", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = parseWorkspaceParams(request.params);
    if (!params) {
      return reply.code(400).send({ error: "Invalid workspace parameters" });
    }

    const parsed = createInvitationPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invitation payload", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    const token = createPlainToken();
    const now = new Date();
    const invitation = {
      id: `winv-${nanoid(16)}`,
      workspaceId: context.workspaceId,
      email: normalizeEmail(parsed.data.email),
      role: parsed.data.role,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      invitedByUserId: user.id,
      createdAt: now.toISOString()
    };

    db.insert(workspaceInvitations).values(invitation).run();

    return reply.code(201).send({
      data: {
        invitation: serializeInvitation(invitation),
        inviteUrl: `/invite/${token}`
      }
    });
  });

  app.delete("/api/workspaces/:workspaceSlug/invitations/:invitationId", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = invitationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid invitation parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    const invitation = db
      .select({ id: workspaceInvitations.id })
      .from(workspaceInvitations)
      .where(and(
        eq(workspaceInvitations.id, params.data.invitationId),
        eq(workspaceInvitations.workspaceId, context.workspaceId)
      ))
      .get();

    if (!invitation) {
      return reply.code(404).send({ error: "Invitation not found" });
    }

    db.update(workspaceInvitations)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(workspaceInvitations.id, invitation.id))
      .run();

    return { data: { ok: true } };
  });

  app.post("/api/invitations/:token/accept", async (request, reply) => {
    const params = acceptParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid invitation parameters", issues: params.error.issues });
    }

    const parsed = acceptInvitationPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invitation acceptance payload", issues: parsed.error.issues });
    }

    const now = new Date();
    const invitation = db
      .select({
        id: workspaceInvitations.id,
        workspaceId: workspaceInvitations.workspaceId,
        email: workspaceInvitations.email,
        expiresAt: workspaceInvitations.expiresAt,
        acceptedAt: workspaceInvitations.acceptedAt,
        revokedAt: workspaceInvitations.revokedAt
      })
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, hashToken(params.data.token)))
      .get();

    if (!invitation) {
      return reply.code(404).send({ error: "Invitation not found" });
    }

    if (invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= now.toISOString()) {
      return reply.code(410).send({ error: "Invitation is no longer valid" });
    }

    const email = normalizeEmail(parsed.data.email);
    if (email !== invitation.email) {
      return reply.code(400).send({ error: "Invitation email mismatch" });
    }

    const existingUser = db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        passwordHash: users.passwordHash
      })
      .from(users)
      .where(eq(users.email, email))
      .get();

    let sessionUser: SessionUser;
    let newUserPasswordHash: string | null = null;

    if (existingUser) {
      if (!(await verifyPassword(parsed.data.password, existingUser.passwordHash))) {
        return reply.code(401).send({ error: "Invalid email or password" });
      }
      sessionUser = {
        id: existingUser.id,
        fullName: existingUser.fullName,
        email: existingUser.email
      };
    } else {
      newUserPasswordHash = await hashPassword(parsed.data.password);
      sessionUser = {
        id: `user-${nanoid(16)}`,
        fullName: parsed.data.fullName,
        email
      };
    }

    db.transaction((tx) => {
      if (!existingUser) {
        if (!newUserPasswordHash) {
          throw new Error("Missing password hash for invited user");
        }

        tx.insert(users).values({
          ...sessionUser,
          passwordHash: newUserPasswordHash,
          createdAt: now.toISOString()
        }).run();
      }

      const existingMembership = tx
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, invitation.workspaceId),
          eq(workspaceMembers.userId, sessionUser.id)
        ))
        .get();

      if (!existingMembership) {
        tx.insert(workspaceMembers).values({
          id: `wmem-${nanoid(16)}`,
          workspaceId: invitation.workspaceId,
          userId: sessionUser.id,
          role: "member",
          createdAt: now.toISOString()
        }).run();
      }

      tx.update(workspaceInvitations)
        .set({ acceptedAt: now.toISOString() })
        .where(eq(workspaceInvitations.id, invitation.id))
        .run();
    });

    const session = createSession(db, sessionUser.id, now);
    setSessionCookies(reply, session);

    return { data: await sessionPayload(db, sessionUser) };
  });
}
