# Dashboard-Managed Assist Widget Configuration — Design

**Date:** 2026-06-05
**Status:** Approved (design)

## Goal

Let a workspace **owner** configure the embeddable Audera Assist widget from the
dashboard — which features are on, position, language, brand (accent, theme,
launcher), and custom CSS — and have the embedded widget on the customer's site
pick up that configuration without the customer editing their script tag.

Today the widget is a single shared bundle (`/assist/a11yaudit-assist.js`)
configured entirely through `data-*` attributes on the customer's embed tag, with
**no server calls**. This feature moves configuration into the dashboard/DB and
delivers it to the widget at load time.

## Reference

The owner pointed at efilli's per-customer bundle model
(`bundles.efilli.com/<domain>.prod.js`): a server-compiled, per-domain JS file
with the whole config inlined as `window.efilliSdkConfig = {…}`, single script
tag, no data-attributes. We adopt the **inlined-config-per-project** idea but
serve it at request time (no separate build/CDN pipeline).

## Decisions (locked during brainstorming)

1. **Scope:** behavior + brand + custom CSS (efilli-level breadth).
2. **Delivery:** serve-time inlined per-project bundle —
   `GET /assist/<projectId>.js` returns `window.__AA_ASSIST_CONFIG__ = {…};`
   followed by the shared widget bundle bytes.
3. **Publish model:** instant-live, short cache (`Cache-Control: public,
   max-age=60`). One "Save"; no draft/publish workflow.
4. **Storage:** dedicated `widget_configs` table (1:1 with project), not a column
   on `projects` — keeps `projects` lean and leaves room for later versioning.
5. **Unknown projectId:** serve the bundle with **default config** (never break
   the customer page on a typo), not a 404.

## Architecture & Data Flow

```
Owner edits in dashboard ──PUT──> widget_configs (DB, JSON)
                                        │
Customer site: <script src="https://<origin>/assist/<projectId>.js" defer></script>
                                        │  public, CORS *, max-age=60
Server GET /assist/:projectId.js:
   load config (or defaults) → "window.__AA_ASSIST_CONFIG__=<json>;\n" + shared bundle bytes
                                        │  application/javascript
Widget mounts → reads window.__AA_ASSIST_CONFIG__ → applies behavior + brand + customCss
   (falls back to data-* attributes when the global is absent — back-compat)
```

The existing shared route `GET /assist/a11yaudit-assist.js` is **unchanged**;
existing `data-*` embeds keep working.

## Config Schema

Single typed object, stored as JSON in `widget_configs.config`, also the shape of
`window.__AA_ASSIST_CONFIG__`:

```ts
interface WidgetConfig {
  enabledSections: ("content" | "navigation" | "color")[];
  disabledFeatures: string[];        // per-feature opt-out within an enabled section
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  language: "tr" | "en";
  brand: {
    accent: string;                  // #rrggbb (validated)
    theme: "light" | "dark" | "auto";
    launcherLabel?: string;          // visible/aria label
    launcherIcon?: "default" | string; // "default" or an inline <svg> string
  };
  customCss: string;                 // injected into the widget Shadow DOM, capped
}
```

**Defaults** (used when no row exists, or a stored config is malformed): all
sections enabled, no disabled features, `bottom-right`, `tr`, accent `#2b56b0`,
theme `light`, `launcherIcon: "default"`, empty `customCss`. A brand-new project
serves a working widget with zero configuration.

## Data Model

New table, created by `initializeDb` (`CREATE TABLE IF NOT EXISTS`, additive —
does not touch existing tables; consistent with the hand-written schema mechanism):

```sql
CREATE TABLE IF NOT EXISTS widget_configs (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  config     TEXT NOT NULL,            -- JSON
  updated_at TEXT NOT NULL
);
```

A Drizzle schema entry mirrors this for typed queries. One row per project; absent
row ⇒ defaults.

## Server

### Public read — `GET /assist/:projectId.js`

- Unauthenticated, CSRF-exempt, `Access-Control-Allow-Origin: *`,
  `Access-Control-Allow-Credentials: false`, `Cache-Control: public, max-age=60`,
  `Content-Type: application/javascript; charset=utf-8`.
- Resolves config: look up `widget_configs` by `project_id`; if absent or invalid,
  use defaults. **Never 404 on unknown project** — defaults keep the widget alive.
- Response body: `window.__AA_ASSIST_CONFIG__=<JSON.stringify(config)>;\n` +
  the shared bundle bytes read from disk (same file the existing `/assist`
  route serves). Bundle missing ⇒ 404 (same as today).
- Only widget config is exposed; no workspace/user data. `projectId` is opaque;
  enumeration only reveals widget presentation config (low sensitivity). Route
  must not require or accept the customer's credentials.

### Owner write — `PUT /api/workspaces/:workspaceSlug/projects/:projectId/widget-config`

- Authenticated, workspace-scoped, **owner-only** (reuses the existing role
  authorization used by other owner-gated routes; members get 403).
- Goes through a workspace-scoped repository function that verifies the project
  belongs to the workspace before writing (preserve the IDOR boundary — never
  trust the projectId alone).
- Validates the payload (see Validation), then upserts `widget_configs`.
- A matching `GET …/widget-config` returns the current config (or defaults) so the
  dashboard form can load it.

### Validation

- `enabledSections` ⊆ `{content,navigation,color}`; `position` ∈ the 4 enum
  values; `language` ∈ `{tr,en}`; `theme` ∈ `{light,dark,auto}`.
- `accent` matches `^#[0-9a-fA-F]{6}$`.
- `disabledFeatures` entries must be known feature ids (from
  `assist-widget/config.ts`); unknown ids dropped.
- `customCss`: length cap (50 KB); strip `</style` (case-insensitive) and
  `@import` to prevent style-tag breakout and remote imports. `@font-face`/`url()`
  remain allowed (custom fonts are a real need, cf. efilli's BentonSans).
- `launcherIcon`: `"default"` or a string that parses as a single `<svg>` element;
  otherwise reset to `"default"`.

## Widget Loader Changes (`packages/assist-widget`)

- On mount, prefer `window.__AA_ASSIST_CONFIG__`; when absent, fall back to the
  existing `parseLoaderOptions(script)` data-attribute path (back-compat).
- Extend the mounted options / state to support:
  - `disabledFeatures` — hide individual feature controls within an enabled
    section (state model currently toggles whole sections; add per-feature
    visibility).
  - `brand.accent` → set the `--aa-acc` CSS custom property (already used by the
    styles).
  - `brand.theme` → light/dark/auto token set for the panel (add dark tokens).
  - `brand.launcherLabel` → launcher visible label / `aria-label`.
  - `brand.launcherIcon` → replace the launcher SVG when a custom icon is given.
  - `customCss` → inject a `<style>` into the widget Shadow DOM **after** the base
    stylesheet (Shadow DOM keeps it scoped away from the host page).
- `mountAssistWidget` options widen to carry the full `WidgetConfig`.

## Dashboard UI (`apps/web`)

- New per-project **Widget** settings panel (a section/tab on the project),
  **owner-only** (hidden or read-only for members, matching existing owner-gated
  UI).
- Controls: section toggles, per-feature toggles, position select, language
  select, accent color picker, theme select, launcher label, launcher icon
  (`default` or pasted `<svg>`), custom-CSS textarea.
- **Embed snippet** box with copy button:
  `<script src="https://<origin>/assist/<projectId>.js" defer></script>`.
- Save → `PUT …/widget-config`; success toast noting "live within ~1 minute".
- All copy localized via the existing typed catalog (`apps/web/src/i18n`), tr/en.
- **Live preview is Phase 2** (mounting the real widget with the draft config);
  Phase 1 ships the form + embed snippet only (YAGNI).

## Phasing

The spec is one feature; the implementation plan ships in two phases.

- **Phase 1 (core):** `widget_configs` table + repo + defaults; public
  `/assist/:projectId.js` route; owner-only write route + validation; loader reads
  `__AA_ASSIST_CONFIG__` and applies behavior + brand + customCss; minimal
  dashboard form + embed snippet. End-to-end: owner configures → customer site
  reflects it.
- **Phase 2 (polish):** live preview, launcher-icon UX niceties.

## Testing

- **Server:** repo get/upsert + defaults; public route inlines config correctly,
  sets `max-age=60` + content-type, unknown project → defaults, missing bundle →
  404, existing shared `/assist/a11yaudit-assist.js` route unaffected; write route
  owner-gate (member → 403, non-member → 403/404), validation (bad accent/position
  rejected, customCss capped, `@import`/`</style>` stripped, unknown disabled
  features dropped).
- **Widget:** loader prefers `__AA_ASSIST_CONFIG__` over data-attrs; applies accent
  var, hides disabled features, applies position/language, injects customCss into
  the Shadow DOM; falls back to data-attrs when the global is absent.
- **Web:** widget settings panel renders, is owner-gated, Save calls the PUT, embed
  snippet shows the correct per-project URL.

## Edge Cases

- No config row, or malformed stored JSON ⇒ defaults (+ server log on malformed).
- Custom CSS over the cap ⇒ rejected at write time with a clear error.
- Unknown projectId on the public route ⇒ default config, working widget.
- Public route is a simple `GET` ⇒ no CORS preflight needed.
- Deploy note: the shared bundle must exist on disk for both `/assist/…` routes;
  the public per-project route reads the same file.

## Non-Goals

- Authenticated/login-gated scans (separate, deferred epic).
- Draft/publish workflow and per-domain pre-built/CDN bundles (chosen against in
  favor of instant-live + short cache).
- Per-feature config beyond on/off (e.g. per-feature parameters) — out of scope.
