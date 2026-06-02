# SaaS Auth and Workspace Tenancy Design

## Goal

A11yAudit is moving from a local single-tenant open-source audit tool toward a SaaS-capable product while remaining open source. The next architecture step is user accounts, workspace tenancy, and server-side authorization so users only see projects, scans, findings, issues, reports, and artifacts that belong to their workspace memberships.

Pricing and billing are out of scope for this design.

## Product Model

A11yAudit will use a workspace-first model.

```text
User
  -> Workspace membership
    -> Workspace
      -> Projects
        -> Scan runs
          -> Issues / Findings / Reports / Artifacts
```

### Workspace

A workspace is the main account boundary. It represents a company, public institution, agency, team, or solo user's working area.

Examples:

```text
Workspace: A Holding
Projects:
- aholding.com
- kariyer.aholding.com
- marka1.com
```

```text
Workspace: Ankara Municipality
Projects:
- ankara.bel.tr
- ebelediye.ankara.bel.tr
- kentrehberi.ankara.bel.tr
```

Users may belong to multiple workspaces. The UI should support workspace switching, but a user with only one workspace should be routed directly to that workspace.

### Project

A project is one website/domain or one public digital property to audit.

Rules:

- A project belongs to exactly one workspace.
- A project has one canonical URL/domain.
- Same-domain crawl stays inside the project domain.
- The same workspace cannot have duplicate projects for the same domain.
- Different workspaces may have projects for the same domain.

Unique constraint:

```text
unique(workspace_id, domain)
```

## Data Model

New tables:

```text
users
workspaces
workspace_members
workspace_invitations
sessions
```

Updated tables:

```text
projects.workspace_id
scan_runs -> project -> workspace
issues -> project/scan -> workspace
findings -> project/scan -> workspace
reports -> project/scan -> workspace
```

The existing database can be treated as a breaking schema transition. Fresh database setup is acceptable for this phase. Existing local SQLite data does not need automatic migration/backfill.

## Workspace Slugs

Workspace routes will use a slug generated from the workspace name.

Signup input:

```text
Workspace name: Acme Accessibility Team
Slug: acme-accessibility-team
```

Slug rules:

- lowercase
- ASCII normalized
- spaces become `-`
- invalid characters removed
- max length, recommended 64
- reserved words blocked
- uniqueness enforced
- collisions get numeric suffixes:

```text
acme
acme-2
acme-3
```

The slug does not change automatically when the workspace name changes. Slug editing can be added later.

Reserved slugs should include:

```text
api
admin
login
logout
signup
settings
new
invite
workspaces
```

## Roles and Permissions

MVP roles:

```text
owner
member
```

Permission matrix:

| Action | owner | member |
| --- | --- | --- |
| View workspace projects | Yes | Yes |
| View scans, issues, findings, reports | Yes | Yes |
| Start scans | Yes | Yes |
| Create projects | Yes | No |
| Delete projects | Yes | No |
| Invite members | Yes | No |
| Revoke invites | Yes | No |
| Manage workspace settings | Yes | No |

Access is workspace-wide in the MVP. If a user is a member of a workspace, they can access every project and report inside that workspace. Project-level ACL is out of scope.

## Authentication

Authentication method:

```text
email + password + server-side session cookie
```

Email:

- global unique
- normalized with trim + lowercase

Signup fields:

```text
Full name
Email
Password
Workspace name
```

Invite signup fields:

```text
Full name
Email
Password
```

Invite signup does not ask for workspace name because the workspace comes from the invite token.

### Password Hashing

Use Node `crypto.scrypt`.

Store password hash in a versioned string format, for example:

```text
scrypt$v1$N$r$p$salt$hash
```

Verification must:

- normalize email before lookup
- derive hash using stored params
- use timing-safe comparison

## Signup Policy

Signup policy:

```text
if user_count === 0:
  /signup is open
  created user becomes owner of first workspace

else if A11YAUDIT_PUBLIC_SIGNUPS=true:
  /signup is open
  created user becomes owner of their own workspace

else:
  /signup is closed
  users can join only through invite links
```

## Sessions

Session model:

```text
sessions
- id
- user_id
- token_hash
- csrf_token_hash
- expires_at
- created_at
- last_seen_at
- revoked_at
```

Session duration:

```text
30 days fixed
```

Cookie:

- session token is stored only in the cookie
- database stores only token hash
- `httpOnly`
- `SameSite=Lax`
- `Secure` in production

Logout revokes or deletes the active session.

## CSRF Protection

Use double-submit CSRF plus Origin/Referer checks.

Cookies:

```text
session cookie:
- httpOnly
- SameSite=Lax
- Secure in production

csrf cookie:
- readable by JavaScript
- SameSite=Lax
- Secure in production
```

Unsafe methods must validate:

```text
POST
PUT
PATCH
DELETE
```

Validation:

```text
X-CSRF-Token header == csrf cookie
Origin/Referer is same-origin
```

## Invitations

Invitations are link/token based. No email provider is required in the MVP.

Invitation fields:

```text
workspace_invitations
- id
- workspace_id
- email
- role = member
- token_hash
- expires_at
- accepted_at
- revoked_at
- invited_by_user_id
- created_at
```

Rules:

- token expires after 7 days
- owner can revoke invite
- token plaintext is never stored in the database
- accepted invite adds the user as workspace `member`
- invite links work even when public signup is disabled

Phase 1 includes minimal backend support for invite token generation and acceptance. Full member/invite management UI is Phase 3.

## Authorization Architecture

Use a full middleware + repository/service authorization model.

Request flow:

```text
request
  -> session middleware
  -> auth context
    user
  -> workspace membership check from path slug
  -> route
  -> workspace-scoped repository/service
```

Auth context should include:

```ts
{
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  role: "owner" | "member";
}
```

Routes should not perform ad hoc unscoped data access. Project, scan, issue, finding, report, and artifact access should go through scoped repository/service functions.

Examples:

```ts
workspaceRepository.getAuthorizedBySlug(slug, userId)
projectRepository.listForWorkspace(workspaceId)
projectRepository.getAuthorized(projectId, workspaceId)
scanRepository.listForWorkspace(workspaceId)
scanRepository.createForProject(workspaceId, projectId, payload)
reportRepository.getDownloadable(reportId, workspaceId)
artifactRepository.getFindingEvidenceArtifact(artifactKey, workspaceId)
```

This is intended to reduce IDOR risk and avoid forgotten workspace filters.

## API Shape

This is a breaking API change. Old global endpoints should be removed or replaced by workspace-scoped endpoints.

Old:

```text
/api/projects
/api/scans
/api/issues
/api/findings
/api/reports
```

New:

```text
GET  /api/workspaces
GET  /api/workspaces/:workspaceSlug

GET  /api/workspaces/:workspaceSlug/projects
POST /api/workspaces/:workspaceSlug/projects

GET  /api/workspaces/:workspaceSlug/scans
POST /api/workspaces/:workspaceSlug/scans

GET  /api/workspaces/:workspaceSlug/issues
GET  /api/workspaces/:workspaceSlug/issues/:issueId

GET  /api/workspaces/:workspaceSlug/findings

GET  /api/workspaces/:workspaceSlug/reports
GET  /api/workspaces/:workspaceSlug/reports/:reportId/download

GET  /api/workspaces/:workspaceSlug/artifacts/download?key=...
```

Every workspace-scoped route must verify:

1. active session exists;
2. user is a member of the workspace slug;
3. requested project/scan/report/artifact belongs to that workspace.

## Report and Artifact Security

Download endpoints must be workspace-scoped.

Server must verify:

- the user is a member of the workspace;
- the report or artifact belongs to a project/scan/finding in that workspace;
- artifact keys alone are not authorization.

Object storage signed URLs can be added later. MVP uses local storage with authorization checks before streaming/download.

## Frontend Routes

Use workspace-aware frontend routes.

```text
/login
/signup
/invite/:token
/workspaces

/w/:workspaceSlug/projects
/w/:workspaceSlug/scans
/w/:workspaceSlug/issues
/w/:workspaceSlug/findings
/w/:workspaceSlug/reports
```

Login redirect:

```text
if user has one workspace:
  /w/:workspaceSlug/projects

if user has multiple workspaces:
  /workspaces
```

Invite accept redirect:

```text
/w/:workspaceSlug/projects
```

Workspace switcher:

- shown in the app shell/header/sidebar
- can be collapsed to workspace name when the user has only one workspace
- needed because users may belong to multiple workspaces

## Scan Queue and Abuse Control

Use a global queue with configurable concurrency.

Defaults:

```text
A11YAUDIT_MAX_CONCURRENT_SCANS=1
project active scan limit=1
```

Rules:

- The same project cannot start a new scan while it has an active scan in `queued`, `crawling`, `auditing`, or `reporting`.
- Global worker concurrency is controlled by environment configuration.
- Workspace pricing/quota limits are out of scope.

## CLI Boundary

The CLI remains local/offline.

This auth and workspace tenancy change applies to the Web UI and server API. The CLI should continue to:

- run local scans;
- write local report/artifact output;
- avoid requiring a user account;
- avoid pushing data to a SaaS account.

API-token based CLI upload is a future feature, not part of this design.

## Migration Strategy

Switch to Drizzle migrations.

The current table bootstrap style using `CREATE TABLE IF NOT EXISTS` and `addColumnIfMissing` is not sufficient for SaaS schema evolution.

Expected approach:

```text
drizzle schema
  -> generated versioned migration files
  -> migration runner on server startup/deploy
```

Fresh database is acceptable for this auth/tenancy transition. Existing local data does not need automatic migration in the MVP.

## Implementation Phases

### Phase 1: Backend Auth, Workspace Tenancy, and Minimal Invite

- Drizzle migrations setup.
- New auth/workspace/session/invite schema.
- Password hashing.
- Session cookie handling.
- CSRF protection.
- Signup/login/logout/session endpoints.
- First-user bootstrap signup.
- Workspace slug generation.
- Minimal invite create/accept endpoints.
- Workspace-scoped API routes.
- Repository/service authorization layer.
- Server tests for access isolation and IDOR prevention.

### Phase 2: Web UI Auth and Workspace Routing

- Login page.
- Signup page.
- Invite accept page.
- Auth gate.
- Workspace-aware routes.
- Workspace list.
- Workspace switcher.
- Project/scans/issues/reports pages migrated to scoped API paths.

### Phase 3: Invite and Member Management UI

- Invite member form.
- Copy invite link.
- List pending invites.
- Revoke invite.
- Member list.
- Role display.

### Phase 4: Hardening, Documentation, and Regression Coverage

- CSRF/origin regression tests.
- Cookie security tests.
- Artifact/report authorization tests.
- Project duplicate-domain tests.
- Active scan limit tests.
- README and deployment documentation updates.
- Fresh database/reset note for this breaking release.

## Non-Goals

- Billing and pricing.
- OAuth login.
- Magic link login.
- Password reset email.
- Project-level access control.
- API tokens.
- CLI upload to SaaS.
- Automatic migration of existing local scan data.
- Full invite email delivery.
- Workspace slug editing.

## Open Implementation Risks

- Route migration is a breaking change and will touch Web UI + API together.
- Repository/service boundaries need to be strict enough to prevent unscoped DB access.
- CSRF implementation must be tested with real browser-like cookie/header behavior.
- Artifact authorization must not rely on artifact key secrecy.
- Drizzle migration setup may require changes to development and Docker startup flows.

