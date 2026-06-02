# Deployment Notes

A11yAudit is an open-source, self-hosted WCAG 2.2 technical accessibility audit platform. These notes describe the current server and web deployment behavior without claiming hosted SaaS production readiness.

## Fresh Database Assumption

The current SaaS auth and workspace schema is intended for a fresh SQLite database. Existing local single-tenant databases are not backfilled by these deployment notes.

Bootstrap flow:

1. Start the server with an empty SQLite database.
2. Open `/signup`.
3. The first account creates the first workspace and becomes owner.
4. After that, set `A11YAUDIT_PUBLIC_SIGNUPS=true` for open signup or invite users from a workspace.

Public signup is closed by default after the first account. Invite onboarding remains the preferred path when open signup is not intended.

## Environment Variables

Current server behavior:

```text
A11YAUDIT_PUBLIC_SIGNUPS=false
A11YAUDIT_MAX_CONCURRENT_SCANS=1
A11YAUDIT_DB_PATH=.a11yaudit/a11yaudit.db
A11YAUDIT_WEB_ORIGIN=https://your-web-origin.example
PORT=7842
NODE_ENV=production
```

Notes:

- `A11YAUDIT_PUBLIC_SIGNUPS` only enables open signup when set exactly to `true`. With the default unset or false behavior, the first user can bootstrap the first workspace, then later direct signup is disabled.
- `A11YAUDIT_MAX_CONCURRENT_SCANS` defaults to `1`. Invalid, missing, zero, or negative values fall back to `1`.
- `A11YAUDIT_DB_PATH` is the current SQLite database path variable used by the server and Drizzle config. The default is `.a11yaudit/a11yaudit.db`.
- `A11YAUDIT_WEB_ORIGIN` controls the trusted browser origin used for CORS and CSRF origin checks. Set it to the deployed web app origin. The default is `http://localhost:5173`.
- `DATABASE_URL` is not the current server database setting.
- `PORT` defaults to `7842`.
- `NODE_ENV=production` makes auth cookies secure, so deploy behind HTTPS.

The web app also reads:

```text
VITE_A11YAUDIT_API_BASE_URL=http://localhost:7842
```

Set it to the browser-reachable API origin for your deployment.

## CLI Boundary

CLI scans remain offline and account-free. Running `pnpm --filter @a11yaudit/cli dev -- scan ...` writes reports and evidence to the selected local output directory and does not require a web account, workspace membership, or SaaS upload.

## Workspace-Scoped API

The old global web API endpoints are replaced by workspace-scoped endpoints. For example:

```text
GET  /api/workspaces/:workspaceSlug/projects
POST /api/workspaces/:workspaceSlug/projects
GET  /api/workspaces/:workspaceSlug/scans
POST /api/workspaces/:workspaceSlug/scans
GET  /api/workspaces/:workspaceSlug/reports
```

Workspace-scoped routes require an authenticated session and membership in the workspace identified by `:workspaceSlug`.

## Operational Boundaries

A11yAudit scans public HTTP/HTTPS targets and keeps the same SSRF-sensitive safety boundary described in `SECURITY.md`: localhost, private-network, link-local, unsupported protocol, and unsafe redirect targets are blocked.

Automated reports are technical audit artifacts. They should not be represented as legal opinions, certification, or proof of full WCAG conformance.
