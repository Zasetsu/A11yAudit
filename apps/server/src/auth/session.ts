import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";

import type { SqliteDatabase } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import {
  csrfCookieName,
  serializeCookie,
  serializeCsrfCookie,
  serializeSessionCookie,
  sessionCookieName
} from "./cookies.js";
import { createPlainToken, hashToken } from "./tokens.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
}

export interface RequestAuth {
  user: AuthenticatedUser | null;
  sessionId: string | null;
  csrfToken: string | null;
  csrfTokenHash: string | null;
}

export interface CreatedSession {
  sessionId: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
}

export interface RequestLike {
  auth?: RequestAuth;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  protocol?: string;
  url: string;
}

export type CsrfValidationResult =
  | { valid: true }
  | { valid: false; statusCode: 403; error: string };

export interface CsrfValidationOptions {
  trustedBrowserOrigin?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: RequestAuth;
  }
}

export function getTrustedBrowserOrigin(): string {
  return process.env.A11YAUDIT_WEB_ORIGIN ?? "http://localhost:5173";
}

function anonymousAuth(csrfToken: string | null = null): RequestAuth {
  return {
    user: null,
    sessionId: null,
    csrfToken,
    csrfTokenHash: null
  };
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function parseCookies(cookieHeader: string | string[] | undefined): Map<string, string> {
  const cookies = new Map<string, string>();

  for (const header of Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader]) {
    if (!header) continue;

    for (const part of header.split(";")) {
      const [rawName, ...rawValueParts] = part.split("=");
      const name = rawName?.trim();
      if (!name) continue;

      const rawValue = rawValueParts.join("=");
      try {
        cookies.set(decodeURIComponent(name), decodeURIComponent(rawValue.trim()));
      } catch {
        cookies.set(name, rawValue.trim());
      }
    }
  }

  return cookies;
}

function getCookies(request: RequestLike): Map<string, string> {
  return parseCookies(request.headers.cookie);
}

export function getRequestAuth(request: FastifyRequest | RequestLike): RequestAuth {
  return request.auth ?? anonymousAuth();
}

export function createSession(db: SqliteDatabase, userId: string, now = new Date()): CreatedSession {
  const sessionToken = createPlainToken();
  const csrfToken = createPlainToken();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const sessionId = `sess-${nanoid(24)}`;

  db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
    createdAt,
    lastSeenAt: createdAt,
    revokedAt: null
  }).run();

  return {
    sessionId,
    sessionToken,
    csrfToken,
    expiresAt
  };
}

export function setSessionCookies(reply: FastifyReply, session: { sessionToken: string; csrfToken: string }): void {
  reply.header("Set-Cookie", [
    serializeSessionCookie(session.sessionToken),
    serializeCsrfCookie(session.csrfToken)
  ]);
}

export function setClearedAuthCookies(reply: FastifyReply): void {
  reply.header("Set-Cookie", [
    serializeCookie(sessionCookieName, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
      secure: process.env.NODE_ENV === "production"
    }),
    serializeCookie(csrfCookieName, "", {
      maxAgeSeconds: 0,
      secure: process.env.NODE_ENV === "production"
    })
  ]);
}

export function revokeSession(db: SqliteDatabase, sessionId: string, now = new Date()): void {
  db.update(sessions)
    .set({ revokedAt: now.toISOString() })
    .where(eq(sessions.id, sessionId))
    .run();
}

export function readAuthFromRequest(db: SqliteDatabase, request: RequestLike, now = new Date()): RequestAuth {
  const cookies = getCookies(request);
  const sessionToken = cookies.get(sessionCookieName);
  const csrfToken = cookies.get(csrfCookieName) ?? null;

  if (!sessionToken) {
    return anonymousAuth(csrfToken);
  }

  const row = db
    .select({
      sessionId: sessions.id,
      csrfTokenHash: sessions.csrfTokenHash,
      userId: users.id,
      fullName: users.fullName,
      email: users.email
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.tokenHash, hashToken(sessionToken)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now.toISOString())
    ))
    .get();

  if (!row) {
    return anonymousAuth(csrfToken);
  }

  db.update(sessions)
    .set({ lastSeenAt: now.toISOString() })
    .where(eq(sessions.id, row.sessionId))
    .run();

  return {
    user: {
      id: row.userId,
      fullName: row.fullName,
      email: row.email
    },
    sessionId: row.sessionId,
    csrfToken,
    csrfTokenHash: row.csrfTokenHash
  };
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | undefined> {
  const auth = getRequestAuth(request);
  if (!auth.user) {
    await reply.code(401).send({ error: "Authentication required" });
    return undefined;
  }

  return auth.user;
}

function isUnsafeMethod(method: string): boolean {
  return unsafeMethods.has(method.toUpperCase());
}

function requestOrigin(request: RequestLike): string | null {
  const host = firstHeaderValue(request.headers.host);
  if (!host) return null;

  const protocol = request.protocol ?? "http";
  return `${protocol}://${host}`;
}

function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function hasTrustedOrigin(request: RequestLike, trustedBrowserOrigin: string): boolean {
  const acceptedOrigins = new Set(
    [requestOrigin(request), normalizeOrigin(trustedBrowserOrigin)].filter((origin): origin is string => origin !== null)
  );

  if (acceptedOrigins.size === 0) return true;

  const originHeader = firstHeaderValue(request.headers.origin);
  if (originHeader) {
    const origin = normalizeOrigin(originHeader);
    return origin !== null && acceptedOrigins.has(origin);
  }

  const refererHeader = firstHeaderValue(request.headers.referer ?? request.headers.referrer);
  if (!refererHeader) return true;

  try {
    return acceptedOrigins.has(new URL(refererHeader).origin);
  } catch {
    return false;
  }
}

function getCsrfHeader(request: RequestLike): string | undefined {
  return firstHeaderValue(request.headers["x-csrf-token"] ?? request.headers["X-CSRF-Token"]);
}

export function validateCsrf(request: RequestLike, options: CsrfValidationOptions = {}): CsrfValidationResult {
  if (!isUnsafeMethod(request.method)) {
    return { valid: true };
  }

  const auth = getRequestAuth(request);
  if (!auth.user || !auth.sessionId) {
    return { valid: true };
  }

  if (!hasTrustedOrigin(request, options.trustedBrowserOrigin ?? getTrustedBrowserOrigin())) {
    return { valid: false, statusCode: 403, error: "Invalid CSRF origin" };
  }

  const headerToken = getCsrfHeader(request);
  const cookieToken = getCookies(request).get(csrfCookieName);
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return { valid: false, statusCode: 403, error: "Invalid CSRF token" };
  }

  if (auth.csrfTokenHash === null || auth.csrfTokenHash !== hashToken(headerToken)) {
    return { valid: false, statusCode: 403, error: "Invalid CSRF token" };
  }

  return { valid: true };
}
