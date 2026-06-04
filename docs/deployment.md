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

### Evidence Artifact Index

Evidence-artifact downloads are authorized through an indexed `evidence_artifacts`
table populated when a scan's findings are persisted. Scans created before this
table existed are not backfilled: their evidence-artifact downloads return 404
until the project is re-scanned. Report (HTML/PDF) downloads are unaffected.

## Environment Variables

Current deployment behavior:

```text
A11YAUDIT_PUBLIC_SIGNUPS=false
A11YAUDIT_MAX_CONCURRENT_SCANS=1
A11YAUDIT_DB_PATH=.a11yaudit/a11yaudit.db
A11YAUDIT_SERVER_URL=https://your-api-origin.example
A11YAUDIT_WEB_ORIGIN=https://your-web-origin.example
A11YAUDIT_COOKIE_DOMAIN=.example.com
PORT=7842
NODE_ENV=production
```

Notes:

- `A11YAUDIT_PUBLIC_SIGNUPS` only enables open signup when set exactly to `true`. With the default unset or false behavior, the first user can bootstrap the first workspace, then later direct signup is disabled.
- `A11YAUDIT_MAX_CONCURRENT_SCANS` defaults to `1`. Invalid, missing, zero, or negative values fall back to `1`.
- `A11YAUDIT_DB_PATH` is the current SQLite database path variable used by the server startup. The default is `.a11yaudit/a11yaudit.db`.
- `A11YAUDIT_SERVER_URL` is the public API origin used by the web app. Set it to the browser-reachable server origin. The default development origin is `http://localhost:7842`.
- `A11YAUDIT_WEB_ORIGIN` controls the trusted browser origin used for CORS and CSRF origin checks. Set it to the deployed web app origin. The default is `http://localhost:5173`.
- `A11YAUDIT_COOKIE_DOMAIN` is optional. Leave it unset for same-origin or reverse-proxied deployments. For same-site split deployments such as `app.example.com` and `api.example.com`, set it to the shared cookie domain, for example `.example.com`.
- `DATABASE_URL` is not the current server database setting.
- `PORT` defaults to `7842`.
- `NODE_ENV=production` makes auth cookies secure, so deploy behind HTTPS.

For a split same-site deployment, set:

```text
A11YAUDIT_SERVER_URL=https://api.example.com
A11YAUDIT_WEB_ORIGIN=https://app.example.com
A11YAUDIT_COOKIE_DOMAIN=.example.com
```

This lets the browser read the CSRF cookie on the web origin and send session cookies to the API. Split deployments on different registrable domains are not supported by the current cookie-based CSRF and session model. Same-origin or reverse-proxied deployments can leave `A11YAUDIT_COOKIE_DOMAIN` unset.

The web app also reads:

```text
VITE_A11YAUDIT_API_BASE_URL=http://localhost:7842
```

`VITE_A11YAUDIT_API_BASE_URL` is kept as a compatibility alias. If both web API origin variables are set, `VITE_A11YAUDIT_API_BASE_URL` takes precedence over `A11YAUDIT_SERVER_URL`.

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

## Accessibility widget (embeddable)

The server serves the built accessibility widget bundle at:

```text
GET /assist/a11yaudit-assist.js
GET /assist/a11yaudit-assist.js.map
```

These are **public, unauthenticated, CSRF-exempt** GETs with `Access-Control-Allow-Origin: *` (and `Access-Control-Allow-Credentials: false`, spec-valid for `*`) and a `public, max-age=3600` cache. The route requires the widget package to be built (`pnpm build` produces `packages/assist-widget/dist/a11yaudit-assist.js`); if the bundle is missing the route returns `404`.

Customers embed the widget with one script tag pointing at the Audera server origin:

```html
<script src="https://<A11YAUDIT_SERVER_URL>/assist/a11yaudit-assist.js"
        data-project="<projectId>"
        data-position="bottom-right"
        data-language="tr"
        defer></script>
```

- `data-language` is `tr` or `en` and **defaults to `tr`** (falls back to the host page's `<html lang>` when not set, then `tr`).
- `data-position` (`bottom-right` default), `data-enabled-sections` (e.g. `content navigation color`), and `data-project` are optional. The widget is fully client-side (preferences in `localStorage`); `data-project` is an embedded label only — no server calls.

## Operational Boundaries

A11yAudit scans public HTTP/HTTPS targets and keeps the same SSRF-sensitive safety boundary described in `SECURITY.md`: localhost, private-network, link-local, unsupported protocol, and unsafe redirect targets are blocked.

Automated reports are technical audit artifacts. They should not be represented as legal opinions, certification, or proof of full WCAG conformance.
