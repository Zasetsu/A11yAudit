import { afterEach, describe, expect, it } from "vitest";

import { createDb, initializeDb, type DbClient } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { csrfCookieName, sessionCookieName } from "./cookies.js";
import {
  createSession,
  readAuthFromRequest,
  revokeSession,
  validateCsrf,
  type RequestLike
} from "./session.js";
import { hashToken } from "./tokens.js";

let dbClient: DbClient | undefined;

function setupDb(): DbClient {
  dbClient = createDb(":memory:");
  initializeDb(dbClient.sqlite);
  return dbClient;
}

function createRequest({
  cookie,
  headers = {},
  method = "GET",
  url = "/api/projects"
}: {
  cookie?: string;
  headers?: Record<string, string>;
  method?: string;
  url?: string;
}): RequestLike {
  return {
    headers: {
      ...headers,
      ...(cookie === undefined ? {} : { cookie })
    },
    method,
    url
  };
}

function seedUser(client: DbClient): void {
  client.db.insert(users).values({
    id: "user-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    passwordHash: "hash",
    createdAt: "2026-06-02T00:00:00.000Z"
  }).run();
}

afterEach(() => {
  dbClient?.close();
  dbClient = undefined;
});

describe("sessions", () => {
  it("creates a session with hashed tokens and a 30-day fixed expiry", () => {
    const client = setupDb();
    seedUser(client);
    const now = new Date("2026-06-02T10:00:00.000Z");

    const session = createSession(client.db, "user-1", now);
    const stored = client.db.select().from(sessions).all()[0];

    expect(session.sessionId).toBe(stored.id);
    expect(session.expiresAt).toBe("2026-07-02T10:00:00.000Z");
    expect(stored.tokenHash).toBe(hashToken(session.sessionToken));
    expect(stored.csrfTokenHash).toBe(hashToken(session.csrfToken));
    expect(stored.tokenHash).not.toBe(session.sessionToken);
    expect(stored.csrfTokenHash).not.toBe(session.csrfToken);
  });

  it("reads an active session from the session cookie and updates last seen", () => {
    const client = setupDb();
    seedUser(client);
    const session = createSession(client.db, "user-1", new Date("2026-06-02T10:00:00.000Z"));

    const auth = readAuthFromRequest(client.db, createRequest({
      cookie: `${sessionCookieName}=${session.sessionToken}; ${csrfCookieName}=${session.csrfToken}`
    }), new Date("2026-06-03T10:00:00.000Z"));

    expect(auth).toMatchObject({
      sessionId: session.sessionId,
      csrfToken: session.csrfToken,
      user: {
        id: "user-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com"
      }
    });
    expect(client.db.select().from(sessions).all()[0].lastSeenAt).toBe("2026-06-03T10:00:00.000Z");
  });

  it("returns anonymous auth for expired and revoked sessions", () => {
    const client = setupDb();
    seedUser(client);
    const expired = createSession(client.db, "user-1", new Date("2026-05-01T00:00:00.000Z"));
    const revoked = createSession(client.db, "user-1", new Date("2026-06-02T00:00:00.000Z"));
    revokeSession(client.db, revoked.sessionId, new Date("2026-06-03T00:00:00.000Z"));

    expect(readAuthFromRequest(client.db, createRequest({
      cookie: `${sessionCookieName}=${expired.sessionToken}`
    }), new Date("2026-06-02T00:00:00.000Z")).user).toBeNull();
    expect(readAuthFromRequest(client.db, createRequest({
      cookie: `${sessionCookieName}=${revoked.sessionToken}`
    }), new Date("2026-06-03T00:00:00.000Z")).user).toBeNull();
  });

  it("validates CSRF with matching header, cookie, and stored session hash", () => {
    const client = setupDb();
    seedUser(client);
    const session = createSession(client.db, "user-1", new Date("2026-06-02T00:00:00.000Z"));
    const request = createRequest({
      cookie: `${sessionCookieName}=${session.sessionToken}; ${csrfCookieName}=${session.csrfToken}`,
      headers: {
        "x-csrf-token": session.csrfToken,
        origin: "http://localhost:7842",
        host: "localhost:7842"
      },
      method: "POST"
    });

    request.auth = readAuthFromRequest(client.db, request, new Date("2026-06-03T00:00:00.000Z"));

    expect(validateCsrf(client.db, request)).toEqual({ valid: true });
  });

  it("rejects CSRF when an authenticated unsafe request omits the header", () => {
    const client = setupDb();
    seedUser(client);
    const session = createSession(client.db, "user-1", new Date("2026-06-02T00:00:00.000Z"));
    const request = createRequest({
      cookie: `${sessionCookieName}=${session.sessionToken}; ${csrfCookieName}=${session.csrfToken}`,
      method: "POST"
    });

    request.auth = readAuthFromRequest(client.db, request, new Date("2026-06-03T00:00:00.000Z"));

    expect(validateCsrf(client.db, request)).toMatchObject({ valid: false, statusCode: 403 });
  });

  it("rejects CSRF when the header and cookie do not match the stored session hash", () => {
    const client = setupDb();
    seedUser(client);
    const session = createSession(client.db, "user-1", new Date("2026-06-02T00:00:00.000Z"));
    const forgedCsrfToken = "forged-csrf-token";
    const request = createRequest({
      cookie: `${sessionCookieName}=${session.sessionToken}; ${csrfCookieName}=${forgedCsrfToken}`,
      headers: { "x-csrf-token": forgedCsrfToken },
      method: "POST"
    });

    request.auth = readAuthFromRequest(client.db, request, new Date("2026-06-03T00:00:00.000Z"));

    expect(validateCsrf(client.db, request)).toMatchObject({ valid: false, statusCode: 403 });
  });

  it("does not CSRF-block anonymous unsafe requests", () => {
    const client = setupDb();
    const request = createRequest({ method: "POST" });
    request.auth = readAuthFromRequest(client.db, request);

    expect(validateCsrf(client.db, request)).toEqual({ valid: true });
  });
});
