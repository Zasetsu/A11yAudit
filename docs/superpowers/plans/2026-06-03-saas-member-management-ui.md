# SaaS Member & Invite Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-only Members page per workspace where an owner can view members, change roles, remove members, invite people, and revoke/regenerate pending invitations.

**Architecture:** New owner-gated Fastify routes added to the existing `routes/workspaces.ts`, backed by new query/guard functions in `repositories/workspaces.ts`. All routes reuse the shared `requireWorkspaceMembership` + `requireWorkspaceOwner` choke point in `routes/workspace-access.ts`. The web app gains a `members` page reached at `/w/:slug/members`, with the nav entry shown only to owners. No schema changes — `workspace_members` and `workspace_invitations` already hold everything required.

**Tech Stack:** Fastify, Drizzle ORM (better-sqlite3), Zod, React 18 + Vite, TanStack Query, Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-02-saas-member-management-ui-design.md`

---

## API summary (what this plan builds)

All owner-only, all under `/api/workspaces/:workspaceSlug`, all returning the `{ data: ... }` envelope:

```
GET    /members                              -> { data: { members: WorkspaceMember[] } }
PATCH  /members/:userId           { role }   -> { data: { ok: true } }
DELETE /members/:userId                      -> { data: { ok: true } }
GET    /invitations                          -> { data: { invitations: PendingInvitation[] } }
POST   /invitations               { email }  -> { data: { invitation, inviteUrl } }   (exists; add duplicate guard)
DELETE /invitations/:invitationId            -> { data: { ok: true } }                (exists, unchanged)
POST   /invitations/:invitationId/regenerate -> { data: { invitation, inviteUrl } }
```

Server-side guards: last-owner protection (409), no self-target on role/remove (400), duplicate-invite rejection (409), unknown member/invitation (404).

> Note on the last-owner guard: with the self-target block (400) plus the owner-only actor requirement, the last-owner 409 is effectively unreachable through the HTTP surface (the sole owner can only target a non-owner). It is kept as cheap defense-in-depth so the invariant still holds if the self-target rule is ever relaxed. The tests therefore do not assert the 409 path; they assert the reachable behaviors (promote, demote-when-others-remain, self-target 400, unknown-member 404).

## File Structure

- `apps/server/src/repositories/workspaces.ts` — add member + invitation query/guard functions.
- `apps/server/src/routes/workspaces.ts` — add member routes, invitation-list route, regenerate route; add duplicate-invite guard to the existing create route.
- `apps/server/src/app.test.ts` — add a `addWorkspaceMember` helper and integration tests.
- `apps/web/src/api/client.ts` — add `WorkspaceMember`/`WorkspaceInvitation` types + client functions.
- `apps/web/src/pages/members.tsx` — new owner-only page (create).
- `apps/web/src/app.tsx` — add `members` to the route union, routing, and render case.
- `apps/web/src/design/shell.tsx` — owner-gated `Members` nav entry.
- `apps/web/src/pages/members.test.tsx` — new web test (create).

## Conventions to follow (from the existing codebase)

- ESM: relative imports use explicit `.js` extensions even from `.ts`.
- Repository functions take `db` first; route handlers resolve `context` via `requireWorkspaceMembership` then `requireWorkspaceOwner`.
- Run a single server test file: `./node_modules/.bin/vitest run apps/server/src/app.test.ts`
- Run a single web test file: `./node_modules/.bin/vitest run apps/web/src/pages/members.test.tsx`
- Server typecheck: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
- Web typecheck: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`

---

## Task 1: Member listing (repository + GET route)

**Files:**
- Modify: `apps/server/src/repositories/workspaces.ts`
- Modify: `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Add the `addWorkspaceMember` test helper**

In `apps/server/src/app.test.ts`, add this helper next to `createWorkspaceInvite` (around line 390). It invites an email, accepts the invite, and returns the new member's cookies + userId.

```ts
async function addWorkspaceMember(
  app: Awaited<ReturnType<typeof buildServer>>,
  ownerCookies: Record<string, string>,
  workspaceSlug: string,
  email: string,
  password = "password12345"
) {
  const invite = await createWorkspaceInvite(app, ownerCookies, workspaceSlug, email);
  const token = invite.json().data.inviteUrl.replace("/invite/", "");
  const accepted = await app.inject({
    method: "POST",
    url: `/api/invitations/${token}/accept`,
    payload: { fullName: "Member", email, password }
  });
  return {
    accepted,
    cookies: authCookies(accepted),
    userId: accepted.json().data.user.id as string
  };
}
```

- [ ] **Step 2: Write the failing test for member listing**

Add this `describe`/`it` block to `apps/server/src/app.test.ts` (append near the other workspace tests).

```ts
describe("workspace members", () => {
  it("lets an owner list workspace members with roles", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(200);
        const members = response.json().data.members as Array<{ email: string; role: string }>;
        expect(members).toHaveLength(2);
        expect(members.map((m) => `${m.email}:${m.role}`).sort()).toEqual([
          "member@example.com:member",
          "owner@example.com:owner"
        ]);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects member listing by non-owners", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");
        const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");

        const asMember = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: member.cookies
        });
        const asOutsider = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: authCookies(outsider)
        });

        expect(asMember.statusCode).toBe(403);
        expect(asOutsider.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: FAIL — the `/members` route returns 404 (not registered), so assertions on 200/403 fail.

- [ ] **Step 4: Add the repository function**

In `apps/server/src/repositories/workspaces.ts`, update the imports and add `listWorkspaceMembers`. Change the top imports to include `users`:

```ts
import { and, asc, eq, sql } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { users, workspaceMembers, workspaces } from "../db/schema.js";
```

Add this interface near `WorkspaceMembership`:

```ts
export interface WorkspaceMemberRow {
  userId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}
```

Add this function at the end of the file:

```ts
export async function listWorkspaceMembers(db: SqliteDatabase, workspaceId: string): Promise<WorkspaceMemberRow[]> {
  return db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.createdAt))
    .all();
}
```

(`sql` is imported now for Task 2's owner count; it is unused until then — that is fine, but if your tsconfig flags unused imports, add `sql` in the same step as Task 2 instead.)

- [ ] **Step 5: Register the GET members route**

In `apps/server/src/routes/workspaces.ts`, update the repositories import to include `listWorkspaceMembers`:

```ts
import {
  buildSessionPayload,
  listMemberships,
  listWorkspaceMembers,
  type SessionUser,
  type WorkspaceRole
} from "../repositories/workspaces.js";
```

Add this route inside `registerWorkspaceRoutes`, after the `GET /api/workspaces/:workspaceSlug` handler:

```ts
  app.get("/api/workspaces/:workspaceSlug/members", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = parseWorkspaceParams(request.params);
    if (!params) {
      return reply.code(400).send({ error: "Invalid workspace parameters" });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    return { data: { members: await listWorkspaceMembers(db, context.workspaceId) } };
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/repositories/workspaces.ts apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts
git commit -m "feat(server): list workspace members for owners"
```

---

## Task 2: Change member role (PATCH route + last-owner & self-target guards)

**Files:**
- Modify: `apps/server/src/repositories/workspaces.ts`
- Modify: `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests inside the `describe("workspace members", ...)` block in `apps/server/src/app.test.ts`.

```ts
  it("lets an owner promote a member to owner", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${member.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "owner" }
        });

        expect(response.statusCode).toBe(200);
        const list = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: ownerCookies
        });
        const promoted = list.json().data.members.find((m: { email: string }) => m.email === "member@example.com");
        expect(promoted.role).toBe("owner");
      } finally {
        await app.close();
      }
    });
  });

  it("rejects an owner changing their own role", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const ownerUserId = owner.json().data.user.id;

        const response = await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${ownerUserId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "member" }
        });

        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  it("lets an owner demote a second owner back to member when others remain", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const second = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "second@example.com");

        // Promote second to owner (now two owners).
        await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${second.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "owner" }
        });

        // Original owner demotes second back to member: allowed because another owner remains.
        const response = await app.inject({
          method: "PATCH",
          url: `/api/workspaces/owner-workspace/members/${second.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "member" }
        });

        expect(response.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 when changing the role of a non-member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);

        const response = await app.inject({
          method: "PATCH",
          url: "/api/workspaces/owner-workspace/members/user-not-a-member",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies,
          payload: { role: "owner" }
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: FAIL — PATCH route returns 404, so the 200/400 assertions fail.

- [ ] **Step 3: Add repository functions**

In `apps/server/src/repositories/workspaces.ts`, add these functions at the end (ensure `sql` is in the drizzle import from Task 1):

```ts
export function countWorkspaceOwners(db: SqliteDatabase, workspaceId: string): number {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")))
    .get()?.count ?? 0;
}

export function getWorkspaceMember(
  db: SqliteDatabase,
  workspaceId: string,
  userId: string
): { id: string; role: WorkspaceRole } | null {
  const row = db
    .select({ id: workspaceMembers.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .get();

  return row ?? null;
}

export function updateMemberRole(db: SqliteDatabase, workspaceId: string, userId: string, role: WorkspaceRole): void {
  db.update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .run();
}
```

- [ ] **Step 4: Register the PATCH route**

In `apps/server/src/routes/workspaces.ts`, extend the repositories import:

```ts
import {
  buildSessionPayload,
  countWorkspaceOwners,
  getWorkspaceMember,
  listMemberships,
  listWorkspaceMembers,
  updateMemberRole,
  type SessionUser,
  type WorkspaceRole
} from "../repositories/workspaces.js";
```

Add these schemas next to `invitationParamsSchema` (top of the file):

```ts
const memberParamsSchema = workspaceParamsSchema.extend({
  userId: z.string().trim().min(1)
});

const updateMemberPayloadSchema = z.object({
  role: z.enum(["owner", "member"])
});
```

Add this route inside `registerWorkspaceRoutes`, after the GET members route:

```ts
  app.patch("/api/workspaces/:workspaceSlug/members/:userId", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = memberParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid member parameters", issues: params.error.issues });
    }

    const parsed = updateMemberPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid member payload", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    if (params.data.userId === user.id) {
      return reply.code(400).send({ error: "You cannot change your own role" });
    }

    const member = getWorkspaceMember(db, context.workspaceId, params.data.userId);
    if (!member) {
      return reply.code(404).send({ error: "Member not found" });
    }

    if (
      member.role === "owner" &&
      parsed.data.role === "member" &&
      countWorkspaceOwners(db, context.workspaceId) === 1
    ) {
      return reply.code(409).send({ error: "Workspace must keep at least one owner" });
    }

    updateMemberRole(db, context.workspaceId, params.data.userId, parsed.data.role);

    return { data: { ok: true } };
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: PASS (all `workspace members` tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/repositories/workspaces.ts apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts
git commit -m "feat(server): change member role with last-owner and self guards"
```

---

## Task 3: Remove a member (DELETE route + guards)

**Files:**
- Modify: `apps/server/src/repositories/workspaces.ts`
- Modify: `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the `describe("workspace members", ...)` block:

```ts
  it("lets an owner remove a member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/members/${member.userId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(200);
        const list = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/members",
          cookies: ownerCookies
        });
        expect(list.json().data.members).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects an owner removing themselves", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const ownerUserId = owner.json().data.user.id;

        const response = await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/members/${ownerUserId}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  it("returns 404 when removing a user who is not a member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);

        const response = await app.inject({
          method: "DELETE",
          url: "/api/workspaces/owner-workspace/members/user-does-not-exist",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: FAIL — DELETE member route returns 404 for all cases.

- [ ] **Step 3: Add the repository function**

In `apps/server/src/repositories/workspaces.ts`, add at the end:

```ts
export function removeMember(db: SqliteDatabase, workspaceId: string, userId: string): void {
  db.delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .run();
}
```

- [ ] **Step 4: Register the DELETE route**

In `apps/server/src/routes/workspaces.ts`, add `removeMember` to the repositories import, then add this route after the PATCH members route:

```ts
  app.delete("/api/workspaces/:workspaceSlug/members/:userId", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = memberParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid member parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    if (params.data.userId === user.id) {
      return reply.code(400).send({ error: "You cannot remove yourself" });
    }

    const member = getWorkspaceMember(db, context.workspaceId, params.data.userId);
    if (!member) {
      return reply.code(404).send({ error: "Member not found" });
    }

    if (member.role === "owner" && countWorkspaceOwners(db, context.workspaceId) === 1) {
      return reply.code(409).send({ error: "Workspace must keep at least one owner" });
    }

    removeMember(db, context.workspaceId, params.data.userId);

    return { data: { ok: true } };
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/repositories/workspaces.ts apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts
git commit -m "feat(server): remove workspace members with guards"
```

---

## Task 4: Duplicate-invite guard on create

**Files:**
- Modify: `apps/server/src/repositories/workspaces.ts`
- Modify: `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the `describe("workspace members", ...)` block:

```ts
  it("rejects inviting an email that already belongs to a member", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "member@example.com");

        expect(response.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects a second pending invite for the same email", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const first = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");
        expect(first.statusCode).toBe(201);

        const second = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");

        expect(second.statusCode).toBe(409);
      } finally {
        await app.close();
      }
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: FAIL — both currently return 201 (no duplicate guard).

- [ ] **Step 3: Add the repository guard functions**

In `apps/server/src/repositories/workspaces.ts`, update the drizzle import to include `gt` and `isNull`, and the schema import to include `workspaceInvitations`:

```ts
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { users, workspaceInvitations, workspaceMembers, workspaces } from "../db/schema.js";
```

Add these functions at the end:

```ts
export function emailIsWorkspaceMember(db: SqliteDatabase, workspaceId: string, email: string): boolean {
  const row = db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email)))
    .get();

  return row !== undefined;
}

export function pendingInvitationExists(
  db: SqliteDatabase,
  workspaceId: string,
  email: string,
  now: string
): boolean {
  const row = db
    .select({ id: workspaceInvitations.id })
    .from(workspaceInvitations)
    .where(and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      eq(workspaceInvitations.email, email),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, now)
    ))
    .get();

  return row !== undefined;
}
```

- [ ] **Step 4: Wire the guards into the existing create-invite route**

In `apps/server/src/routes/workspaces.ts`, add `emailIsWorkspaceMember` and `pendingInvitationExists` to the repositories import. Then, inside the existing `app.post("/api/workspaces/:workspaceSlug/invitations", ...)` handler, replace the block that builds `invitation` so the duplicate checks run first. Find:

```ts
    const token = createPlainToken();
    const now = new Date();
    const invitation = {
```

and replace with:

```ts
    const inviteEmail = normalizeEmail(parsed.data.email);
    const now = new Date();

    if (emailIsWorkspaceMember(db, context.workspaceId, inviteEmail)) {
      return reply.code(409).send({ error: "User is already a workspace member" });
    }

    if (pendingInvitationExists(db, context.workspaceId, inviteEmail, now.toISOString())) {
      return reply.code(409).send({ error: "A pending invitation already exists for this email" });
    }

    const token = createPlainToken();
    const invitation = {
```

Then, in that same object literal, change the `email` field from `normalizeEmail(parsed.data.email)` to `inviteEmail`:

```ts
      email: inviteEmail,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "workspace members"`
Expected: PASS. Also run the existing invite tests to confirm no regression:
Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "invite"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/repositories/workspaces.ts apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts
git commit -m "feat(server): reject duplicate workspace invitations"
```

---

## Task 5: List pending invitations (GET route)

**Files:**
- Modify: `apps/server/src/repositories/workspaces.ts`
- Modify: `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe("workspace members", ...)` block:

```ts
  it("lists only pending invitations for owners", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const pending = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "pending@example.com");
        const revoked = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "revoked@example.com");
        await app.inject({
          method: "DELETE",
          url: `/api/workspaces/owner-workspace/invitations/${revoked.json().data.invitation.id}`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/invitations",
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(200);
        const invitations = response.json().data.invitations as Array<{ id: string; email: string }>;
        expect(invitations).toHaveLength(1);
        expect(invitations[0].email).toBe("pending@example.com");
        expect(invitations[0].id).toBe(pending.json().data.invitation.id);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects invitation listing by non-owners", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const member = await addWorkspaceMember(app, ownerCookies, "owner-workspace", "member@example.com");

        const response = await app.inject({
          method: "GET",
          url: "/api/workspaces/owner-workspace/invitations",
          cookies: member.cookies
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "pending invitations"`
Expected: FAIL — GET invitations route returns 404.

- [ ] **Step 3: Add the repository function**

In `apps/server/src/repositories/workspaces.ts`, add:

```ts
export interface PendingInvitationRow {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
}

export function listPendingInvitations(db: SqliteDatabase, workspaceId: string, now: string): PendingInvitationRow[] {
  return db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      expiresAt: workspaceInvitations.expiresAt,
      createdAt: workspaceInvitations.createdAt
    })
    .from(workspaceInvitations)
    .where(and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, now)
    ))
    .orderBy(asc(workspaceInvitations.createdAt))
    .all();
}
```

- [ ] **Step 4: Register the GET invitations route**

In `apps/server/src/routes/workspaces.ts`, add `listPendingInvitations` to the repositories import, then add this route after the existing `POST .../invitations` handler:

```ts
  app.get("/api/workspaces/:workspaceSlug/invitations", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = parseWorkspaceParams(request.params);
    if (!params) {
      return reply.code(400).send({ error: "Invalid workspace parameters" });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.workspaceSlug, reply);
    if (!context) return undefined;
    if (!requireWorkspaceOwner(context, reply)) return undefined;

    return {
      data: { invitations: listPendingInvitations(db, context.workspaceId, new Date().toISOString()) }
    };
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "pending invitations"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/repositories/workspaces.ts apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts
git commit -m "feat(server): list pending workspace invitations"
```

---

## Task 6: Regenerate an invitation link

**Files:**
- Modify: `apps/server/src/routes/workspaces.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe("workspace members", ...)` block:

```ts
  it("regenerates an invite token so the old link stops working", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);
        const created = await createWorkspaceInvite(app, ownerCookies, "owner-workspace", "invitee@example.com");
        const invitationId = created.json().data.invitation.id;
        const oldToken = created.json().data.inviteUrl.replace("/invite/", "");

        const regenerated = await app.inject({
          method: "POST",
          url: `/api/workspaces/owner-workspace/invitations/${invitationId}/regenerate`,
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(regenerated.statusCode).toBe(200);
        const newToken = regenerated.json().data.inviteUrl.replace("/invite/", "");
        expect(newToken).not.toBe(oldToken);

        const acceptOld = await app.inject({
          method: "POST",
          url: `/api/invitations/${oldToken}/accept`,
          payload: { fullName: "Member", email: "invitee@example.com", password: "password12345" }
        });
        expect(acceptOld.statusCode).toBe(404);

        const acceptNew = await app.inject({
          method: "POST",
          url: `/api/invitations/${newToken}/accept`,
          payload: { fullName: "Member", email: "invitee@example.com", password: "password12345" }
        });
        expect(acceptNew.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  it("rejects regenerating an unknown invitation", async () => {
    await withTempDb(async (dbPath) => {
      const app = await buildServer({ dbPath, executeScans: false });
      try {
        const owner = await signup(app, "owner@example.com", "Owner Workspace");
        const ownerCookies = authCookies(owner);

        const response = await app.inject({
          method: "POST",
          url: "/api/workspaces/owner-workspace/invitations/winv-missing/regenerate",
          headers: { "x-csrf-token": ownerCookies[csrfCookieName] },
          cookies: ownerCookies
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "regenerat"`
Expected: FAIL — regenerate route returns 404 for the valid case.

- [ ] **Step 3: Register the regenerate route**

In `apps/server/src/routes/workspaces.ts`, add this route after the `DELETE .../invitations/:invitationId` handler. It reuses `invitationParamsSchema`, `createPlainToken`, `hashToken`, `INVITATION_TTL_MS`, and `serializeInvitation` already present in the file.

```ts
  app.post("/api/workspaces/:workspaceSlug/invitations/:invitationId/regenerate", async (request, reply) => {
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
      .select({ id: workspaceInvitations.id, acceptedAt: workspaceInvitations.acceptedAt })
      .from(workspaceInvitations)
      .where(and(
        eq(workspaceInvitations.id, params.data.invitationId),
        eq(workspaceInvitations.workspaceId, context.workspaceId)
      ))
      .get();

    if (!invitation) {
      return reply.code(404).send({ error: "Invitation not found" });
    }

    if (invitation.acceptedAt) {
      return reply.code(409).send({ error: "Invitation has already been accepted" });
    }

    const token = createPlainToken();
    const now = new Date();
    db.update(workspaceInvitations)
      .set({
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
        revokedAt: null
      })
      .where(eq(workspaceInvitations.id, invitation.id))
      .run();

    const updated = db
      .select({
        id: workspaceInvitations.id,
        email: workspaceInvitations.email,
        role: workspaceInvitations.role,
        expiresAt: workspaceInvitations.expiresAt
      })
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitation.id))
      .get();

    if (!updated) {
      return reply.code(404).send({ error: "Invitation not found" });
    }

    return {
      data: {
        invitation: serializeInvitation(updated),
        inviteUrl: `/invite/${token}`
      }
    };
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/server/src/app.test.ts -t "regenerat"`
Expected: PASS.

- [ ] **Step 5: Run the full server suite + typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
Expected: exit 0.
Run: `./node_modules/.bin/vitest run apps/server`
Expected: PASS (all server tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/workspaces.ts apps/server/src/app.test.ts
git commit -m "feat(server): regenerate workspace invitation links"
```

---

## Task 7: Web API client functions

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/api/client.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/web/src/api/client.test.ts`, find how existing tests stub `fetch` (the file already mocks `globalThis.fetch` and sets `VITE_A11YAUDIT_API_BASE_URL`). Mirror that pattern and add:

```ts
it("posts an invitation and returns the invite url", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({
    data: { invitation: { id: "winv-1", email: "x@example.com", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" }, inviteUrl: "/invite/tok" }
  }));

  const result = await createInvite("acme", "x@example.com");

  expect(result).toEqual({
    invitation: { id: "winv-1", email: "x@example.com", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" },
    inviteUrl: "/invite/tok"
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.test/api/workspaces/acme/invitations",
    expect.objectContaining({ method: "POST", credentials: "include" })
  );
});
```

(Use the same `fetchMock`/`jsonResponse` names the existing test file defines; if they differ, match the existing helpers. Add `createInvite` to the import from `./client`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/web/src/api/client.test.ts -t "invitation"`
Expected: FAIL — `createInvite` is not exported.

- [ ] **Step 3: Add types, path helpers, and client functions**

In `apps/web/src/api/client.ts`, add these types near the other exported interfaces:

```ts
export interface WorkspaceMember {
  userId: string;
  fullName: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: "member";
  expiresAt: string;
  createdAt: string;
}
```

Add these path helpers next to `workspaceProjectsPath`:

```ts
function workspaceMembersPath(workspaceSlug: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/members`;
}

function workspaceInvitationsPath(workspaceSlug: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/invitations`;
}
```

Add these functions near the other exported API calls:

```ts
export async function listMembers(workspaceSlug: string): Promise<WorkspaceMember[]> {
  const response = await apiFetch(workspaceMembersPath(workspaceSlug));
  if (response === null || !response.ok) return [];

  try {
    const payload = (await response.json()) as { data?: { members?: WorkspaceMember[] } };
    return Array.isArray(payload.data?.members) ? payload.data!.members! : [];
  } catch {
    return [];
  }
}

export async function updateMemberRole(
  workspaceSlug: string,
  userId: string,
  role: "owner" | "member"
): Promise<{ ok: true } | { error: string }> {
  const response = await apiFetch(`${workspaceMembersPath(workspaceSlug)}/${encodeURIComponent(userId)}`, {
    body: JSON.stringify({ role }),
    method: "PATCH"
  });
  return readMutationResult(response);
}

export async function removeMember(
  workspaceSlug: string,
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const response = await apiFetch(`${workspaceMembersPath(workspaceSlug)}/${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
  return readMutationResult(response);
}

export async function listInvitations(workspaceSlug: string): Promise<WorkspaceInvitation[]> {
  const response = await apiFetch(workspaceInvitationsPath(workspaceSlug));
  if (response === null || !response.ok) return [];

  try {
    const payload = (await response.json()) as { data?: { invitations?: WorkspaceInvitation[] } };
    return Array.isArray(payload.data?.invitations) ? payload.data!.invitations! : [];
  } catch {
    return [];
  }
}

export async function createInvite(
  workspaceSlug: string,
  email: string
): Promise<{ invitation: WorkspaceInvitation; inviteUrl: string } | { error: string }> {
  const response = await apiFetch(workspaceInvitationsPath(workspaceSlug), {
    body: JSON.stringify({ email }),
    method: "POST"
  });
  if (response === null) return { error: "API is unavailable" };

  try {
    const payload = (await response.json()) as { data?: { invitation: WorkspaceInvitation; inviteUrl: string }; error?: string };
    if (!response.ok || payload.data === undefined) {
      return { error: payload.error ?? "Could not create invitation" };
    }
    return payload.data;
  } catch {
    return { error: "Could not create invitation" };
  }
}

export async function revokeInvitation(
  workspaceSlug: string,
  invitationId: string
): Promise<{ ok: true } | { error: string }> {
  const response = await apiFetch(`${workspaceInvitationsPath(workspaceSlug)}/${encodeURIComponent(invitationId)}`, {
    method: "DELETE"
  });
  return readMutationResult(response);
}

export async function regenerateInvitation(
  workspaceSlug: string,
  invitationId: string
): Promise<{ inviteUrl: string } | { error: string }> {
  const response = await apiFetch(
    `${workspaceInvitationsPath(workspaceSlug)}/${encodeURIComponent(invitationId)}/regenerate`,
    { method: "POST" }
  );
  if (response === null) return { error: "API is unavailable" };

  try {
    const payload = (await response.json()) as { data?: { inviteUrl: string }; error?: string };
    if (!response.ok || payload.data === undefined) {
      return { error: payload.error ?? "Could not regenerate invitation" };
    }
    return { inviteUrl: payload.data.inviteUrl };
  } catch {
    return { error: "Could not regenerate invitation" };
  }
}
```

Add this shared helper near the bottom of the file (used by the mutation functions above):

```ts
async function readMutationResult(response: Response | null): Promise<{ ok: true } | { error: string }> {
  if (response === null) return { error: "API is unavailable" };
  if (response.ok) return { ok: true };

  try {
    const payload = (await response.json()) as { error?: string };
    return { error: payload.error ?? "Request failed" };
  } catch {
    return { error: "Request failed" };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/web/src/api/client.test.ts -t "invitation"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/api/client.test.ts
git commit -m "feat(web): add member and invitation API client functions"
```

---

## Task 8: Members page component

**Files:**
- Create: `apps/web/src/pages/members.tsx`
- Modify: `apps/web/src/pages/page-props.ts` (only if `workspaceRole`/`workspaceSlug` are not already on the shared page props)

- [ ] **Step 1: Confirm the shared page props**

Read `apps/web/src/pages/page-props.ts`. The `common` object in `app.tsx` already passes `workspaceSlug` and `workspaceRole`. Ensure the shared page-props type includes both:

```ts
workspaceSlug: string;
workspaceRole: "owner" | "member";
```

If they are missing, add them. If present, no change.

- [ ] **Step 2: Create the Members page**

Create `apps/web/src/pages/members.tsx`. This page is owner-only; if a non-owner reaches it, it shows an access notice. It uses TanStack Query like the other pages.

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvite,
  listInvitations,
  listMembers,
  regenerateInvitation,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type WorkspaceInvitation,
  type WorkspaceMember
} from "../api/client";
import { Button, Icon, PageHeader, Panel } from "../design/ui";
import type { PageProps } from "./page-props";

function inviteLink(inviteUrl: string): string {
  return `${window.location.origin}${inviteUrl}`;
}

export function MembersPage({ workspaceSlug, workspaceRole }: PageProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latestLink, setLatestLink] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["members", workspaceSlug],
    queryFn: () => listMembers(workspaceSlug),
    enabled: workspaceRole === "owner"
  });
  const invitationsQuery = useQuery({
    queryKey: ["invitations", workspaceSlug],
    queryFn: () => listInvitations(workspaceSlug),
    enabled: workspaceRole === "owner"
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });
    void queryClient.invalidateQueries({ queryKey: ["invitations", workspaceSlug] });
  }

  const inviteMutation = useMutation({
    mutationFn: () => createInvite(workspaceSlug, email),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setEmail("");
      setLatestLink(inviteLink(result.inviteUrl));
      refresh();
    }
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: "owner" | "member" }) =>
      updateMemberRole(workspaceSlug, input.userId, input.role),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      refresh();
    }
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(workspaceSlug, userId),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      refresh();
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(workspaceSlug, invitationId),
    onSuccess: () => {
      setError(null);
      refresh();
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: (invitationId: string) => regenerateInvitation(workspaceSlug, invitationId),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setLatestLink(inviteLink(result.inviteUrl));
      refresh();
    }
  });

  if (workspaceRole !== "owner") {
    return (
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle="Workspace membership" title="Members" />
        <Panel title="Owner access required">
          <div className="note"><Icon name="info" size={14} /> Only workspace owners can manage members and invitations.</div>
        </Panel>
      </div>
    );
  }

  const members: WorkspaceMember[] = membersQuery.data ?? [];
  const invitations: WorkspaceInvitation[] = invitationsQuery.data ?? [];

  return (
    <div className="content-inner fadein">
      <PageHeader icon="shield-check" subtitle="Manage who can access this workspace" title="Members" />

      {error !== null ? (
        <div className="note"><Icon name="alert-triangle" size={14} /> {error}</div>
      ) : null}

      <Panel title="Invite a member">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <label>
            <span>Email</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              type="email"
              value={email}
            />
          </label>
          <Button icon="plus" type="submit" variant="primary">Send invite</Button>
        </form>
        {latestLink !== null ? (
          <div className="note">
            <Icon name="info" size={14} /> Invite link (copy now, it is shown once):
            <code className="mono"> {latestLink}</code>
          </div>
        ) : null}
      </Panel>

      <Panel title="Members">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId}>
                <td>{member.fullName}</td>
                <td className="mono">{member.email}</td>
                <td>
                  <select
                    aria-label={`Role for ${member.email}`}
                    onChange={(event) => roleMutation.mutate({ userId: member.userId, role: event.target.value as "owner" | "member" })}
                    value={member.role}
                  >
                    <option value="owner">owner</option>
                    <option value="member">member</option>
                  </select>
                </td>
                <td>
                  <Button
                    icon="alert-octagon"
                    onClick={() => removeMutation.mutate(member.userId)}
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Pending invitations">
        {invitations.length === 0 ? (
          <div className="note"><Icon name="info" size={14} /> No pending invitations.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Email</th><th>Expires</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="mono">{invitation.email}</td>
                  <td>{new Date(invitation.expiresAt).toLocaleDateString()}</td>
                  <td>
                    <Button icon="arrow-right" onClick={() => regenerateMutation.mutate(invitation.id)} variant="ghost">Regenerate link</Button>
                    <Button icon="alert-octagon" onClick={() => revokeMutation.mutate(invitation.id)} variant="ghost">Revoke</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
```

Note: the role `<select>` lets an owner pick the same role; the server treats an unchanged role as a valid no-op 200, and the self-row guard (400) surfaces via `error`. The page intentionally keeps controls enabled and relies on the server guards for correctness (the UI shows the returned error message).

- [ ] **Step 3: Typecheck the web package**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0. (The page is not yet routed; this only checks it compiles. If `PageProps` lacks `workspaceRole`, fix Step 1.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/members.tsx apps/web/src/pages/page-props.ts
git commit -m "feat(web): add owner-only members management page"
```

---

## Task 9: Route + nav wiring

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/design/shell.tsx`

- [ ] **Step 1: Add `members` to the route union and workspace pages**

In `apps/web/src/app.tsx`, add `members` to the `Route` union:

```ts
export type Route =
  | { page: "overview" }
  | { page: "projects" }
  | { page: "new-scan" }
  | { page: "scan-runs" }
  | { page: "findings" }
  | { page: "finding-detail"; findingId: string }
  | { page: "reports" }
  | { page: "members" }
  | { page: "settings" }
  | { page: "docs" };
```

Add `"members"` to the `workspacePages` set:

```ts
const workspacePages = new Set<Exclude<WorkspacePage, "finding-detail">>([
  "overview",
  "projects",
  "new-scan",
  "scan-runs",
  "findings",
  "reports",
  "members",
  "settings",
  "docs"
]);
```

- [ ] **Step 2: Render the Members page in the dashboard switch**

In `apps/web/src/app.tsx`, import the page at the top:

```ts
import { MembersPage } from "./pages/members";
```

Add a case in the `switch (route.page)` inside `DashboardApp`:

```ts
    case "members":
      view = <MembersPage {...common} />;
      break;
```

(`common` already includes `workspaceSlug` and `workspaceRole`, so the page receives them. The page itself renders the owner-access notice for non-owners.)

- [ ] **Step 3: Add the owner-gated nav entry**

In `apps/web/src/design/shell.tsx`, the `Sidebar` needs the current role to decide whether to show Members. Update the `Sidebar` signature and its caller.

In `shell.tsx`, change the `Sidebar` declaration to accept `workspaceRole`:

```tsx
export function Sidebar({ route, navigate, workspaceRole }: { route: Route; navigate: Navigate; workspaceRole: "owner" | "member" }) {
```

Add a Members entry to the `configItems` list rendering — replace the `configItems.map(...)` line in `Sidebar` with a block that conditionally includes Members for owners:

```tsx
        {workspaceRole === "owner" ? (
          <NavButton item={{ id: "members", label: "Members", icon: "shield-check" }} navigate={navigate} route={route} />
        ) : null}
        {configItems.map((item) => <NavButton item={item} key={item.id} navigate={navigate} route={route} />)}
```

- [ ] **Step 4: Pass `workspaceRole` to the Sidebar**

In `apps/web/src/app.tsx`, the `DashboardApp` renders `<Sidebar navigate={navigate} route={route} />`. Update it to pass the role (already available as `currentWorkspace.role`):

```tsx
        <Sidebar navigate={navigate} route={route} workspaceRole={currentWorkspace.role} />
```

- [ ] **Step 5: Typecheck and run the web suite**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0.
Run: `./node_modules/.bin/vitest run apps/web`
Expected: PASS (existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app.tsx apps/web/src/design/shell.tsx
git commit -m "feat(web): route and owner-gated nav for members page"
```

---

## Task 10: Web integration test for the members page

**Files:**
- Create: `apps/web/src/pages/members.test.tsx`

- [ ] **Step 1: Write the test**

Mirror the harness in `apps/web/src/pages/auth.test.tsx` (it mounts `<App />` with a mocked `../api/client`, sets the path, and asserts DOM). Create `apps/web/src/pages/members.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import type { AuthSession } from "../api/client";

const api = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  createInvite: vi.fn(),
  createProject: vi.fn(),
  createScan: vi.fn(),
  fetchIssues: vi.fn(),
  getFindings: vi.fn(),
  getProjects: vi.fn(),
  getReports: vi.fn(),
  getScans: vi.fn(),
  getSession: vi.fn(),
  listInvitations: vi.fn(),
  listMembers: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  regenerateInvitation: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  signup: vi.fn(),
  updateMemberRole: vi.fn()
}));

vi.mock("../api/client", () => api);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const ownerSession: AuthSession = {
  user: { id: "user-1", fullName: "Ada Lovelace", email: "ada@example.test" },
  workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "owner" }]
};

const memberSession: AuthSession = {
  ...ownerSession,
  workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "member" }]
};

async function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
  });
  return { container, root };
}

async function waitFor(assertion: () => void) {
  const timeoutAt = Date.now() + 1_000;
  let lastError: unknown;
  while (Date.now() < timeoutAt) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    }
  }
  throw lastError;
}

describe("members page", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    api.getProjects.mockResolvedValue([]);
    api.getScans.mockResolvedValue([]);
    api.getFindings.mockResolvedValue([]);
    api.fetchIssues.mockResolvedValue([]);
    api.getReports.mockResolvedValue([]);
    api.listMembers.mockResolvedValue([
      { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" }
    ]);
    api.listInvitations.mockResolvedValue([]);
    window.history.replaceState(null, "", "/w/acme/members");
  });

  afterEach(async () => {
    for (const root of roots) {
      await act(async () => root.unmount());
    }
    roots = [];
    document.body.innerHTML = "";
  });

  it("shows the members table for an owner", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => {
      expect(rendered.container.textContent).toContain("Members");
      expect(rendered.container.textContent).toContain("ada@example.test");
    });
    expect(api.listMembers).toHaveBeenCalledWith("acme");
  });

  it("hides the Members nav entry for a member-role session", async () => {
    api.getSession.mockResolvedValue(memberSession);
    window.history.replaceState(null, "", "/w/acme/projects");
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
    const navButtons = Array.from(rendered.container.querySelectorAll(".sidebar button"))
      .map((button) => button.textContent ?? "");
    expect(navButtons.some((label) => label.includes("Members"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/members.test.tsx`
Expected: PASS (2 tests). If the owner test cannot find members because dashboard queries throw, ensure all the dashboard query mocks in `beforeEach` resolve (they do above).

- [ ] **Step 3: Run the full web + server suites and typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0.
Run: `./node_modules/.bin/vitest run`
Expected: PASS (all packages).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/members.test.tsx
git commit -m "test(web): cover members page rendering and owner-gated nav"
```

---

## Final verification

- [ ] Run the whole suite: `./node_modules/.bin/vitest run` → all pass.
- [ ] Server typecheck: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → exit 0.
- [ ] Web typecheck: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` → exit 0.
- [ ] Manual smoke (optional): start server + web, sign up an owner, open `/w/<slug>/members`, invite an email, copy the link, accept it in a private window, confirm the member appears, change its role, remove it.
- [ ] Open a PR from `feature/member-management` to `main`.
