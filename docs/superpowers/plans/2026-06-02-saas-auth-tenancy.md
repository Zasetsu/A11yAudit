# SaaS Auth and Workspace Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user accounts, workspace tenancy, session auth, CSRF protection, invite onboarding, and workspace-scoped project/scan/report data access.

**Architecture:** The server becomes workspace-first: every web API request authenticates through a server-side session, resolves a workspace membership from the route slug, then calls scoped repository functions. The CLI remains local/offline and does not use accounts. The web app gets auth screens and `/w/:workspaceSlug/*` routes while keeping the current dashboard pages as the authenticated workspace experience.

**Tech Stack:** TypeScript monorepo, Fastify, Drizzle ORM, SQLite, better-sqlite3, React, React Query, Vitest, pnpm.

---

## File Structure

### Server

- `apps/server/src/db/schema.ts` defines the complete Drizzle schema, including users, workspaces, members, invitations, sessions, and `projects.workspaceId`.
- `apps/server/src/db/client.ts` creates the SQLite client and runs migrations/schema initialization for a fresh SaaS database.
- `apps/server/src/auth/password.ts` hashes and verifies passwords with Node `crypto.scrypt`.
- `apps/server/src/auth/tokens.ts` generates random session/invite/CSRF tokens and stores only hashes.
- `apps/server/src/auth/cookies.ts` centralizes session and CSRF cookie names/options.
- `apps/server/src/auth/session.ts` reads sessions, attaches authenticated user context, creates/revokes sessions, and validates CSRF.
- `apps/server/src/auth/slug.ts` generates stable unique workspace slugs.
- `apps/server/src/repositories/workspaces.ts` resolves workspace membership and role.
- `apps/server/src/repositories/projects.ts` exposes workspace-scoped project list/create/get/delete helpers.
- `apps/server/src/repositories/scans.ts` exposes workspace-scoped scan list/create/active-scan checks.
- `apps/server/src/repositories/issues.ts` exposes workspace-scoped grouped issue queries.
- `apps/server/src/repositories/findings.ts` exposes workspace-scoped finding queries.
- `apps/server/src/repositories/reports.ts` exposes workspace-scoped report list/download lookup.
- `apps/server/src/repositories/artifacts.ts` resolves local artifact keys only after workspace ownership is proven.
- `apps/server/src/routes/auth.ts` registers signup/login/logout/session endpoints.
- `apps/server/src/routes/workspaces.ts` registers workspace listing/detail and minimal invitation endpoints.
- Existing route files under `apps/server/src/routes/` are moved to `/api/workspaces/:workspaceSlug/...` behavior.

### Web

- `apps/web/src/api/client.ts` adds auth/session/workspace API methods, scoped endpoint builders, credentialed fetch, and CSRF header support.
- `apps/web/src/app.tsx` parses browser paths, gates authenticated routes, redirects after login/signup/invite, and passes `workspaceSlug` to data queries.
- `apps/web/src/pages/login.tsx` renders login.
- `apps/web/src/pages/signup.tsx` renders first-user/public signup.
- `apps/web/src/pages/invite.tsx` renders invite acceptance.
- `apps/web/src/pages/workspaces.tsx` renders workspace chooser.
- Existing page files keep their domain UI but receive scoped API data through `App`.

## Task 1: Schema and Fresh Database Initialization

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/db/client.ts`
- Test: `apps/server/src/app.test.ts`

- [ ] Add `drizzle-kit` as a server dev dependency and add scripts:

```json
{
  "scripts": {
    "dev": "tsx src/app.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "db:generate": "drizzle-kit generate:sqlite",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "drizzle-kit": "^0.20.18",
    "tsx": "^4.11.0"
  }
}
```

- [ ] Extend `apps/server/src/db/schema.ts` with these columns/tables:

```ts
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull()
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull()
});

export const workspaceMembers = sqliteTable("workspace_members", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull(),
  createdAt: text("created_at").notNull()
}, (table) => ({
  workspaceUserUnique: uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId)
}));

export const workspaceInvitations = sqliteTable("workspace_invitations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["member"] }).notNull().default("member"),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  revokedAt: text("revoked_at"),
  invitedByUserId: text("invited_by_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull()
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  csrfTokenHash: text("csrf_token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  revokedAt: text("revoked_at")
});
```

- [ ] Add `workspaceId` to `projects` and enforce one domain per workspace:

```ts
workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" })
```

```ts
workspaceDomainUnique: uniqueIndex("projects_workspace_domain_unique").on(table.workspaceId, table.domain)
```

- [ ] Replace raw bootstrap additions in `initializeDb` with fresh schema creation that includes all required tables and indexes. The MVP accepts fresh DBs, so existing local DB backfill is not required.
- [ ] Add a server test that creates the database and verifies the auth tables exist:

```ts
it("initializes SaaS auth and workspace tables", async () => {
  await withTempDb(async (dbPath) => {
    const dbClient = createDb(dbPath);
    initializeDb(dbClient.sqlite);
    const rows = dbClient.sqlite.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>;
    const names = rows.map((row) => row.name);
    expect(names).toContain("users");
    expect(names).toContain("workspaces");
    expect(names).toContain("workspace_members");
    expect(names).toContain("workspace_invitations");
    expect(names).toContain("sessions");
    dbClient.close();
  });
});
```

- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/package.json apps/server/src/db apps/server/src/app.test.ts pnpm-lock.yaml && git commit -m "feat(server): add SaaS tenancy schema"`

## Task 2: Password, Token, and Slug Primitives

**Files:**
- Create: `apps/server/src/auth/password.ts`
- Create: `apps/server/src/auth/password.test.ts`
- Create: `apps/server/src/auth/tokens.ts`
- Create: `apps/server/src/auth/tokens.test.ts`
- Create: `apps/server/src/auth/slug.ts`
- Create: `apps/server/src/auth/slug.test.ts`

- [ ] Write tests for password hashing:

```ts
it("stores scrypt hashes in versioned format and verifies them", async () => {
  const hash = await hashPassword("correct horse battery staple");
  expect(hash.startsWith("scrypt$v1$")).toBe(true);
  await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
});
```

- [ ] Implement `hashPassword` and `verifyPassword` with `crypto.scrypt`, `randomBytes`, and `timingSafeEqual`.
- [ ] Write token tests:

```ts
it("hashes tokens without storing plaintext", () => {
  const token = createPlainToken();
  const hash = hashToken(token);
  expect(token).not.toEqual(hash);
  expect(hash).toHaveLength(64);
});
```

- [ ] Implement `createPlainToken()` as base64url random 32 bytes and `hashToken()` as SHA-256 hex.
- [ ] Write slug tests:

```ts
it("normalizes workspace names and blocks reserved slugs", () => {
  expect(baseWorkspaceSlug("Acme Accessibility Team")).toBe("acme-accessibility-team");
  expect(baseWorkspaceSlug("LOGIN")).toBe("workspace-login");
});
```

- [ ] Implement `baseWorkspaceSlug(name: string): string` with lowercase ASCII normalization, dash collapsing, max length 64, and reserved word prefixing.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/auth/password.test.ts apps/server/src/auth/tokens.test.ts apps/server/src/auth/slug.test.ts`
- [ ] Commit: `git add apps/server/src/auth && git commit -m "feat(server): add auth crypto primitives"`

## Task 3: Session Cookies, Auth Context, and CSRF Guard

**Files:**
- Create: `apps/server/src/auth/cookies.ts`
- Create: `apps/server/src/auth/session.ts`
- Create: `apps/server/src/auth/session.test.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Add cookie constants:

```ts
export const sessionCookieName = "a11yaudit_session";
export const csrfCookieName = "a11yaudit_csrf";
```

- [ ] Define auth context:

```ts
export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
}

export interface RequestAuth {
  user: AuthenticatedUser | null;
  sessionId: string | null;
  csrfToken: string | null;
}
```

- [ ] Implement `readAuthFromRequest(db, request)` by parsing the session cookie, hashing it, looking up a non-revoked/non-expired session, updating `last_seen_at`, and returning `{ user, sessionId, csrfToken }`.
- [ ] Implement `requireAuth(request)` so unauthenticated requests return a `401` route response.
- [ ] Implement `validateCsrf(request)` so unsafe methods require:

```text
X-CSRF-Token header equals csrf cookie
Origin or Referer host equals request host
```

- [ ] Add server tests:

```ts
it("rejects unsafe authenticated requests without CSRF", async () => {
  const app = await buildServer({ dbPath });
  const auth = await signupAndLogin(app);
  const response = await app.inject({
    method: "POST",
    url: `/api/workspaces/${auth.workspaceSlug}/projects`,
    cookies: auth.cookies,
    payload: { name: "Portal", url: "https://portal.example.test/" }
  });
  expect(response.statusCode).toBe(403);
});
```

- [ ] Register an `onRequest` hook in `app.ts` that attaches auth context and validates CSRF for unsafe methods, skipping `/health`, `/api/auth/login`, `/api/auth/signup`, and invite token reads.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/auth/session.test.ts apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/auth apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): add session and CSRF middleware"`

## Task 4: Signup, Login, Logout, and Session Endpoints

**Files:**
- Create: `apps/server/src/routes/auth.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Add tests for first-user signup:

```ts
it("allows first-user signup and creates an owner workspace", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: {
      fullName: "Ada Lovelace",
      email: "ADA@EXAMPLE.COM ",
      password: "correct horse battery staple",
      workspaceName: "Acme Accessibility Team"
    }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().data.user.email).toBe("ada@example.com");
  expect(response.json().data.workspaces[0]).toMatchObject({ slug: "acme-accessibility-team", role: "owner" });
  expect(response.headers["set-cookie"]).toBeDefined();
});
```

- [ ] Add tests for closed public signup:

```ts
it("closes normal signup after first user when public signup is disabled", async () => {
  await signup(app, "owner@example.com", "Owner Workspace");
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: { fullName: "Member", email: "member@example.com", password: "password12345", workspaceName: "Member Workspace" }
  });
  expect(response.statusCode).toBe(403);
});
```

- [ ] Implement route handlers:

```ts
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

- [ ] Normalize email with `email.trim().toLowerCase()`.
- [ ] Use `A11YAUDIT_PUBLIC_SIGNUPS === "true"` for public signup policy.
- [ ] Create session and set both session and CSRF cookies on signup/login.
- [ ] Return session payload:

```ts
{
  data: {
    user: { id, fullName, email },
    workspaces: [{ id, name, slug, role }]
  }
}
```

- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/routes/auth.ts apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): add auth routes"`

## Task 5: Workspace Membership Repository and Invite API

**Files:**
- Create: `apps/server/src/repositories/workspaces.ts`
- Create: `apps/server/src/routes/workspaces.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Implement workspace repository functions:

```ts
export async function listMemberships(db: Db, userId: string): Promise<WorkspaceMembership[]>;
export async function getAuthorizedWorkspaceBySlug(db: Db, userId: string, slug: string): Promise<WorkspaceAuthContext | null>;
export async function requireWorkspaceRole(context: WorkspaceAuthContext, roles: WorkspaceRole[]): Promise<void>;
```

- [ ] Add tests proving non-members cannot read a workspace:

```ts
it("rejects workspace detail for non-members", async () => {
  const owner = await signup(app, "owner@example.com", "Owner Workspace");
  const outsider = await signupWithPublicSignup(app, "outsider@example.com", "Other Workspace");
  const response = await app.inject({
    method: "GET",
    url: `/api/workspaces/${owner.workspaceSlug}`,
    cookies: outsider.cookies
  });
  expect(response.statusCode).toBe(404);
});
```

- [ ] Register:

```text
GET  /api/workspaces
GET  /api/workspaces/:workspaceSlug
POST /api/workspaces/:workspaceSlug/invitations
DELETE /api/workspaces/:workspaceSlug/invitations/:invitationId
POST /api/invitations/:token/accept
```

- [ ] Make invite create/revoke owner-only.
- [ ] Make invite acceptance create a user when needed, add `member`, set `acceptedAt`, and create a session.
- [ ] Keep plaintext invite token only in the create response:

```ts
{ data: { invitation: { id, email, role, expiresAt }, inviteUrl: `/invite/${token}` } }
```

- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/repositories/workspaces.ts apps/server/src/routes/workspaces.ts apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): add workspace invite API"`

## Task 6: Workspace-Scoped Projects

**Files:**
- Create: `apps/server/src/repositories/projects.ts`
- Modify: `apps/server/src/routes/projects.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Add repository functions:

```ts
export async function listProjectsForWorkspace(db: Db, workspaceId: string): Promise<ProjectSummary[]>;
export async function createProjectForWorkspace(db: Db, workspaceId: string, input: CreateProjectInput): Promise<ProjectSummary>;
export async function getProjectForWorkspace(db: Db, workspaceId: string, projectId: string): Promise<ProjectRow | null>;
```

- [ ] Add tests:

```ts
it("lists only projects in the authenticated workspace", async () => {
  const acme = await signup(app, "acme@example.com", "Acme");
  const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
  await createProject(app, acme, "Acme Portal", "https://acme.example.test/");
  await createProject(app, beta, "Beta Portal", "https://beta.example.test/");

  const response = await app.inject({ method: "GET", url: `/api/workspaces/${acme.workspaceSlug}/projects`, cookies: acme.cookies });
  expect(response.json().data).toHaveLength(1);
  expect(response.json().data[0].domain).toBe("acme.example.test");
});
```

- [ ] Change routes to:

```text
GET  /api/workspaces/:workspaceSlug/projects
POST /api/workspaces/:workspaceSlug/projects
DELETE /api/workspaces/:workspaceSlug/projects/:projectId
```

- [ ] Enforce owner-only create/delete and member read.
- [ ] Remove old global `/api/projects` registration.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/repositories/projects.ts apps/server/src/routes/projects.ts apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): scope projects by workspace"`

## Task 7: Workspace-Scoped Scans and Queue Limits

**Files:**
- Create: `apps/server/src/repositories/scans.ts`
- Modify: `apps/server/src/routes/scans.ts`
- Modify: `apps/server/src/jobs/local-job-runner.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Add repository functions:

```ts
export async function listScansForWorkspace(db: Db, workspaceId: string): Promise<ScanRunSummary[]>;
export async function createScanForWorkspace(db: Db, workspaceId: string, input: CreateScanInput): Promise<ScanRunSummary>;
export async function hasActiveScanForProject(db: Db, workspaceId: string, projectId: string): Promise<boolean>;
```

- [ ] Add tests:

```ts
it("rejects starting a second active scan for the same project", async () => {
  const auth = await signup(app, "owner@example.com", "Owner Workspace");
  const project = await createProject(app, auth, "Portal", "https://portal.example.test/");
  const first = await startScan(app, auth, project.id);
  expect(first.statusCode).toBe(201);

  const second = await startScan(app, auth, project.id);
  expect(second.statusCode).toBe(409);
});
```

- [ ] Read `A11YAUDIT_MAX_CONCURRENT_SCANS` in `buildServer` and pass it to `LocalJobRunner`.
- [ ] Change routes to:

```text
GET  /api/workspaces/:workspaceSlug/scans
POST /api/workspaces/:workspaceSlug/scans
```

- [ ] Allow owners and members to start scans.
- [ ] Ensure scan create verifies the project belongs to the current workspace.
- [ ] Remove old global `/api/scans` registration.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/repositories/scans.ts apps/server/src/routes/scans.ts apps/server/src/jobs/local-job-runner.ts apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): scope scans by workspace"`

## Task 8: Workspace-Scoped Findings and Grouped Issues

**Files:**
- Create: `apps/server/src/repositories/issues.ts`
- Create: `apps/server/src/repositories/findings.ts`
- Modify: `apps/server/src/routes/issues.ts`
- Modify: `apps/server/src/routes/findings.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Add tests:

```ts
it("does not expose issues across workspaces", async () => {
  const acme = await signup(app, "acme@example.com", "Acme");
  const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
  await seedIssueForWorkspace(app, acme);

  const response = await app.inject({ method: "GET", url: `/api/workspaces/${beta.workspaceSlug}/issues`, cookies: beta.cookies });
  expect(response.json().data).toEqual([]);
});
```

- [ ] Preserve filtered query behavior under workspace scope:

```text
GET /api/workspaces/:workspaceSlug/issues?projectId=...&scanRunId=...
GET /api/workspaces/:workspaceSlug/findings?projectId=...&scanRunId=...
```

- [ ] Keep unfiltered issue requests allowed only inside an authenticated workspace, because the workspace slug is now the boundary.
- [ ] Add `GET /api/workspaces/:workspaceSlug/issues/:issueId` and ensure it returns `404` when the issue is not in that workspace.
- [ ] Remove old global `/api/issues` and `/api/findings` registrations.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/repositories/issues.ts apps/server/src/repositories/findings.ts apps/server/src/routes/issues.ts apps/server/src/routes/findings.ts apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): scope issues and findings by workspace"`

## Task 9: Workspace-Scoped Reports and Artifacts

**Files:**
- Create: `apps/server/src/repositories/reports.ts`
- Create: `apps/server/src/repositories/artifacts.ts`
- Modify: `apps/server/src/routes/reports.ts`
- Modify: `apps/server/src/routes/artifacts.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Add tests for report isolation:

```ts
it("rejects report downloads outside the current workspace", async () => {
  const acme = await signup(app, "acme@example.com", "Acme");
  const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
  const report = await seedReportForWorkspace(app, acme);

  const response = await app.inject({
    method: "GET",
    url: `/api/workspaces/${beta.workspaceSlug}/reports/${report.id}/download`,
    cookies: beta.cookies
  });
  expect(response.statusCode).toBe(404);
});
```

- [ ] Change routes to:

```text
GET /api/workspaces/:workspaceSlug/reports
GET /api/workspaces/:workspaceSlug/reports/:reportId/download
GET /api/workspaces/:workspaceSlug/artifacts/download?key=...
```

- [ ] Authorize artifacts by joining finding evidence to project/scan workspace ownership. Do not authorize by artifact key alone.
- [ ] Remove old global `/api/reports` and `/api/artifacts/download` registrations.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/repositories/reports.ts apps/server/src/repositories/artifacts.ts apps/server/src/routes/reports.ts apps/server/src/routes/artifacts.ts apps/server/src/app.ts apps/server/src/app.test.ts && git commit -m "feat(server): secure report and artifact access"`

## Task 10: Web API Client Auth and Workspace Endpoints

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts`

- [ ] Add client types:

```ts
export interface AuthSession {
  user: { id: string; fullName: string; email: string };
  workspaces: Array<{ id: string; name: string; slug: string; role: "owner" | "member" }>;
}
```

- [ ] Add credentialed fetch helper:

```ts
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = readCookie("a11yaudit_csrf");
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    ...options.headers
  };
  return fetch(apiUrl(path), { ...options, credentials: "include", headers });
}
```

- [ ] Add auth methods:

```ts
export async function getSession(): Promise<AuthSession | null>;
export async function signup(input: SignupInput): Promise<AuthSession>;
export async function login(input: LoginInput): Promise<AuthSession>;
export async function logout(): Promise<void>;
export async function acceptInvite(token: string, input: InviteAcceptInput): Promise<AuthSession>;
```

- [ ] Change data methods to require `workspaceSlug`:

```ts
export async function getProjects(workspaceSlug: string): Promise<Project[]>;
export async function createProject(workspaceSlug: string, input: CreateProjectInput): Promise<Project>;
export async function getScans(workspaceSlug: string): Promise<ScanRun[]>;
export async function createScan(workspaceSlug: string, input: CreateScanInput): Promise<ScanRun>;
export async function fetchIssues(workspaceSlug: string, filters?: IssueFilters): Promise<Issue[]>;
export async function getFindings(workspaceSlug: string): Promise<Finding[]>;
export async function getReports(workspaceSlug: string): Promise<Report[]>;
```

- [ ] Update tests to expect URLs like:

```ts
expect(fetchMock).toHaveBeenCalledWith(
  "https://api.example.test/api/workspaces/acme/projects",
  expect.objectContaining({ credentials: "include" })
);
```

- [ ] Keep demo data only when no API base URL is configured.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/web/src/api/client.test.ts`
- [ ] Commit: `git add apps/web/src/api/client.ts apps/web/src/api/client.test.ts && git commit -m "feat(web): add auth-aware API client"`

## Task 11: Web Auth Pages and Browser Path Routing

**Files:**
- Modify: `apps/web/src/app.tsx`
- Create: `apps/web/src/pages/login.tsx`
- Create: `apps/web/src/pages/signup.tsx`
- Create: `apps/web/src/pages/invite.tsx`
- Create: `apps/web/src/pages/workspaces.tsx`
- Create: `apps/web/src/pages/auth.test.tsx`

- [ ] Add a small path parser:

```ts
function parsePath(pathname: string): AppRoute {
  if (pathname === "/login") return { page: "login" };
  if (pathname === "/signup") return { page: "signup" };
  if (pathname === "/workspaces") return { page: "workspaces" };
  const invite = pathname.match(/^\/invite\/([^/]+)$/);
  if (invite) return { page: "invite", token: invite[1] };
  const workspace = pathname.match(/^\/w\/([^/]+)\/([^/]+)$/);
  if (workspace) return { page: workspace[2] as WorkspacePage, workspaceSlug: workspace[1] };
  return { page: "login" };
}
```

- [ ] Add tests:

```ts
it("redirects a single-workspace session to workspace projects", async () => {
  mockSession({ workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "owner" }] });
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
});
```

- [ ] Implement login/signup/invite forms with field labels in English and submit buttons:

```text
Email
Password
Full name
Workspace name
Sign in
Create account
Accept invite
```

- [ ] After login/signup/invite:

```text
one workspace -> /w/:workspaceSlug/projects
multiple workspaces -> /workspaces
```

- [ ] Unauthenticated workspace routes redirect to `/login`.
- [ ] Run: `rtk npm exec pnpm@9 -- test apps/web/src/pages/auth.test.tsx`
- [ ] Commit: `git add apps/web/src/app.tsx apps/web/src/pages/login.tsx apps/web/src/pages/signup.tsx apps/web/src/pages/invite.tsx apps/web/src/pages/workspaces.tsx apps/web/src/pages/auth.test.tsx && git commit -m "feat(web): add auth pages and routing"`

## Task 12: Web Workspace-Scoped Dashboard Data

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/design/shell.tsx`
- Modify: `apps/web/src/pages/projects.tsx`
- Modify: `apps/web/src/pages/new-scan.tsx`
- Modify: `apps/web/src/pages/reports.tsx`
- Modify: `apps/web/src/pages/scan-runs.test.ts`
- Modify: `apps/web/src/pages/reports.test.ts`

- [ ] Include `workspaceSlug` in every React Query key:

```ts
const projectsQuery = useQuery({ queryKey: ["projects", workspaceSlug], queryFn: () => getProjects(workspaceSlug) });
const scansQuery = useQuery({ queryKey: ["scans", workspaceSlug], queryFn: () => getScans(workspaceSlug) });
const issuesQuery = useQuery({ queryKey: ["issues", workspaceSlug, selectedProject.id, selectedScan?.id ?? null], queryFn: () => fetchIssues(workspaceSlug, filters) });
```

- [ ] Pass `workspaceSlug` into create project, create scan, report download, and artifact download actions.
- [ ] Add a workspace switcher to `TopBar` that lists session workspaces and navigates to `/w/:slug/projects`.
- [ ] Hide create/delete project controls for `member` role while keeping scan start visible.
- [ ] Add page tests proving:

```ts
it("members can start scans but cannot create projects", async () => {
  renderWorkspaceApp({ role: "member" });
  expect(screen.queryByRole("button", { name: /new project/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /new scan/i })).toBeEnabled();
});
```

- [ ] Run: `rtk npm exec pnpm@9 -- test apps/web/src/pages/scan-runs.test.ts apps/web/src/pages/reports.test.ts`
- [ ] Commit: `git add apps/web/src/app.tsx apps/web/src/design/shell.tsx apps/web/src/pages && git commit -m "feat(web): scope dashboard by workspace"`

## Task 13: Server Integration Regression Coverage

**Files:**
- Modify: `apps/server/src/app.test.ts`

- [ ] Add IDOR regression tests:

```ts
it("rejects scans for projects outside the current workspace", async () => {
  const acme = await signup(app, "acme@example.com", "Acme");
  const beta = await signupWithPublicSignup(app, "beta@example.com", "Beta");
  const betaProject = await createProject(app, beta, "Beta Portal", "https://beta.example.test/");

  const response = await app.inject({
    method: "POST",
    url: `/api/workspaces/${acme.workspaceSlug}/scans`,
    cookies: acme.cookies,
    headers: acme.csrfHeaders,
    payload: { projectId: betaProject.id, url: betaProject.url, mode: "single_url", viewports: ["desktop"] }
  });

  expect(response.statusCode).toBe(404);
});
```

- [ ] Add compatibility regression tests proving old global endpoints are no longer available:

```ts
it("does not expose old global project endpoint", async () => {
  const response = await app.inject({ method: "GET", url: "/api/projects" });
  expect(response.statusCode).toBe(404);
});
```

- [ ] Add role regression tests:

```ts
it("allows members to read and scan but rejects project creation", async () => {
  const owner = await signup(app, "owner@example.com", "Owner Workspace");
  const member = await inviteAndAccept(app, owner, "member@example.com");

  const readResponse = await app.inject({ method: "GET", url: `/api/workspaces/${owner.workspaceSlug}/projects`, cookies: member.cookies });
  expect(readResponse.statusCode).toBe(200);

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/workspaces/${owner.workspaceSlug}/projects`,
    cookies: member.cookies,
    headers: member.csrfHeaders,
    payload: { name: "Member Portal", url: "https://member.example.test/" }
  });
  expect(createResponse.statusCode).toBe(403);
});
```

- [ ] Run: `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Commit: `git add apps/server/src/app.test.ts && git commit -m "test(server): cover workspace authorization regressions"`

## Task 14: Documentation and Deployment Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/wcag-22-coverage-guide.md`
- Create: `docs/deployment.md`

- [ ] Document the SaaS bootstrap flow:

```text
1. Start the server with an empty SQLite database.
2. Open /signup.
3. The first account creates the first workspace and becomes owner.
4. After that, set A11YAUDIT_PUBLIC_SIGNUPS=true for open signup or invite users from a workspace.
```

- [ ] Document environment variables:

```text
A11YAUDIT_PUBLIC_SIGNUPS=false
A11YAUDIT_MAX_CONCURRENT_SCANS=1
DATABASE_URL=.a11yaudit/a11yaudit.db
PORT=7842
NODE_ENV=production
```

- [ ] Document that CLI scans remain offline and account-free.
- [ ] Document that old global web API endpoints are replaced by workspace-scoped endpoints.
- [ ] Run: `rtk npm exec pnpm@9 -- build`
- [ ] Commit: `git add README.md docs/deployment.md docs/wcag-22-coverage-guide.md && git commit -m "docs: document SaaS workspace deployment"`

## Verification

- [ ] Run server auth/unit tests:

```bash
rtk npm exec pnpm@9 -- test apps/server/src/auth/password.test.ts apps/server/src/auth/tokens.test.ts apps/server/src/auth/slug.test.ts apps/server/src/auth/session.test.ts
```

- [ ] Run server integration tests:

```bash
rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts
```

- [ ] Run web API/page tests:

```bash
rtk npm exec pnpm@9 -- test apps/web/src/api/client.test.ts apps/web/src/pages/auth.test.tsx apps/web/src/pages/scan-runs.test.ts apps/web/src/pages/reports.test.ts
```

- [ ] Run full tests:

```bash
rtk npm exec pnpm@9 -- test
```

- [ ] Run typecheck:

```bash
rtk npm exec pnpm@9 -- typecheck
```

- [ ] Run build:

```bash
rtk npm exec pnpm@9 -- build
```

## Assumptions

- Fresh SQLite database setup is acceptable for this transition.
- Existing CLI package behavior is unchanged.
- Billing, quotas, SSO, API tokens, email delivery, scheduled scans, and project-level ACLs are out of scope.
- Workspace-scoped route paths replace old global web API paths.
- Members can start scans; only owners can create/delete projects and manage invitations.
- Demo data in the web app remains available only when no API base URL is configured.

## Self-Review

- Spec coverage: data model, slug rules, roles, signup policy, password hashing, sessions, CSRF, invitations, middleware/repository authorization, workspace-scoped API, report/artifact security, frontend routes, queue limits, CLI boundary, migration strategy, and documentation are mapped to tasks.
- Placeholder scan: the plan avoids deferred placeholders and defines concrete files, route paths, test names, commands, and expected behaviors.
- Type consistency: workspace role values are consistently `owner | member`; auth session payload uses `{ user, workspaces }`; workspace routes consistently use `workspaceSlug`; scoped data methods require `workspaceSlug`.
