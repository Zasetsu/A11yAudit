import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";

import { normalizeEmail } from "../auth/email.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  createSession,
  getRequestAuth,
  revokeSession,
  setClearedAuthCookies,
  setSessionCookies
} from "../auth/session.js";
import { baseWorkspaceSlug } from "../auth/slug.js";
import type { SqliteDatabase } from "../db/client.js";
import { users, workspaces, workspaceMembers } from "../db/schema.js";
import { buildSessionPayload } from "../repositories/workspaces.js";

const MAX_WORKSPACE_SLUG_LENGTH = 64;

const signupPayloadSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  workspaceName: z.string().trim().min(1)
});

const loginPayloadSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export interface AuthRouteOptions {
  db: SqliteDatabase;
}

class DuplicateEmailError extends Error {}

class PublicSignupDisabledError extends Error {}

function publicSignupsEnabled(): boolean {
  return process.env.A11YAUDIT_PUBLIC_SIGNUPS === "true";
}

function userCount(db: SqliteDatabase): number {
  return db.select({ count: sql<number>`count(*)` }).from(users).get()?.count ?? 0;
}

function uniqueConstraintFailed(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function emailUniqueConstraintFailed(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed: users\.email/i.test(error.message);
}

function candidateSlug(baseSlug: string, suffix: number): string {
  if (suffix === 1) {
    return baseSlug;
  }

  const suffixText = `-${suffix}`;
  return `${baseSlug.slice(0, MAX_WORKSPACE_SLUG_LENGTH - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
}

function nextWorkspaceSlug(db: SqliteDatabase, workspaceName: string): string {
  const baseSlug = baseWorkspaceSlug(workspaceName);
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const slug = candidateSlug(baseSlug, suffix);
    const existing = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).get();
    if (!existing) {
      return slug;
    }
  }

  throw new Error("Unable to allocate workspace slug");
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  const { db } = options;

  app.post("/api/auth/signup", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = signupPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid signup payload", issues: parsed.error.issues });
    }

    const email = normalizeEmail(parsed.data.email);
    const existingUser = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return reply.code(409).send({ error: "Email already exists" });
    }

    if (userCount(db) > 0 && !publicSignupsEnabled()) {
      return reply.code(403).send({ error: "Public signup is disabled" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date().toISOString();
    const user = {
      id: `user-${nanoid(16)}`,
      fullName: parsed.data.fullName,
      email
    };

    try {
      db.transaction((tx) => {
        const duplicateUser = tx.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
        if (duplicateUser) {
          throw new DuplicateEmailError();
        }

        if (userCount(tx) > 0 && !publicSignupsEnabled()) {
          throw new PublicSignupDisabledError();
        }

        const workspace = {
          id: `wrk-${nanoid(16)}`,
          name: parsed.data.workspaceName,
          slug: nextWorkspaceSlug(tx, parsed.data.workspaceName),
          createdAt: now
        };

        tx.insert(users).values({
          ...user,
          passwordHash,
          createdAt: now
        }).run();
        tx.insert(workspaces).values(workspace).run();
        tx.insert(workspaceMembers).values({
          id: `wmem-${nanoid(16)}`,
          workspaceId: workspace.id,
          userId: user.id,
          role: "owner",
          createdAt: now
        }).run();
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError || emailUniqueConstraintFailed(error)) {
        return reply.code(409).send({ error: "Email already exists" });
      }
      if (error instanceof PublicSignupDisabledError) {
        return reply.code(403).send({ error: "Public signup is disabled" });
      }
      if (uniqueConstraintFailed(error)) {
        return reply.code(409).send({ error: "Signup conflict" });
      }
      throw error;
    }

    const session = createSession(db, user.id);
    setSessionCookies(reply, session);

    return reply.code(201).send({ data: await buildSessionPayload(db, user) });
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid login payload", issues: parsed.error.issues });
    }

    const email = normalizeEmail(parsed.data.email);
    const user = db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        passwordHash: users.passwordHash
      })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const session = createSession(db, user.id);
    setSessionCookies(reply, session);

    return {
      data: await buildSessionPayload(db, {
        id: user.id,
        fullName: user.fullName,
        email: user.email
      })
    };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const auth = getRequestAuth(request);
    if (!auth.user || !auth.sessionId) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    revokeSession(db, auth.sessionId);
    setClearedAuthCookies(reply);

    return { data: { ok: true } };
  });

  app.get("/api/auth/session", async (request) => {
    const auth = getRequestAuth(request);
    if (!auth.user) {
      return { data: null };
    }

    return { data: await buildSessionPayload(db, auth.user) };
  });
}
