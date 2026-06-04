# Dashboard-Managed Assist Widget Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace owner configure the embeddable Audera Assist widget (behavior + brand + custom CSS) from the dashboard, delivered to the customer's site via a serve-time inlined per-project bundle (`/assist/<projectId>.js`) with a live WYSIWYG preview.

**Architecture:** One shared config contract (`@a11yaudit/assist-widget`) is the single source of truth for the `WidgetConfig` type, defaults, and `normalizeWidgetConfig` validation — imported by the widget runtime, the server, and the web app. The server stores config in a new `widget_configs` table, serves `GET /assist/:projectId.js` (config prelude + shared bundle bytes, public, `max-age=60`), and exposes owner-only `GET/PUT …/widget-config`. The widget loader reads `window.__AA_ASSIST_CONFIG__` (falling back to `data-*` attributes). The dashboard adds an owner-only Widget panel with an iframe preview driven by draft form state.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), Fastify + better-sqlite3 + Drizzle, React 18 + Vite + TanStack Query, vitest. pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-06-05-dashboard-managed-widget-config-design.md`

---

## Conventions (read first)

- **Build before cross-package work.** `pnpm build` (or build the depended-on package) so `dist/` resolves. After editing `@a11yaudit/assist-widget`, rebuild it before server/web typecheck: `pnpm --filter @a11yaudit/assist-widget build`.
- **Relative imports use explicit `.js`** even from `.ts`.
- **Run a single test file:** `pnpm vitest run <path>`. Filter by name: `pnpm vitest run -t "<name>"`.
- Local note (this machine): pnpm is not on PATH — use `npx pnpm@9 …`, and `./node_modules/.bin/vitest`, `./node_modules/.bin/tsc`, `node_modules/.bin/vite`. CI/other machines use `pnpm` directly; commands below show `pnpm`.
- **Commit after each task.** Branch is `feature/widget-dashboard-config`.

## File Structure

**`packages/assist-widget/`** (shared contract + runtime)
- Create `src/widget-config.ts` — `WidgetConfig` type, `DEFAULT_WIDGET_CONFIG`, `normalizeWidgetConfig(input): WidgetConfig`, `WIDGET_CONFIG_CSS_MAX_BYTES`, the global name constant. The one source of truth.
- Modify `src/index.ts` — re-export the above.
- Modify `src/widget.ts` — `AssistWidgetOptions` carries a `config?: WidgetConfig`; apply brand (accent/theme/launcher), `disabledFeatures`, `customCss` into the shadow root.
- Modify `src/loader.ts` — read `window.__AA_ASSIST_CONFIG__`; map it to mount options; keep the `data-*` fallback.
- Modify `src/styles.ts` — add dark-theme tokens and a launcher-label rule.

**`apps/server/`**
- Modify `src/db/schema.ts` — `widgetConfigs` Drizzle table.
- Modify `src/db/client.ts` — `CREATE TABLE IF NOT EXISTS widget_configs` in `initializeDb`.
- Create `src/repositories/widget-config.ts` — `getWidgetConfig`, `getWidgetConfigForWorkspaceProject`, `upsertWidgetConfigForWorkspaceProject`.
- Modify `src/routes/assist.ts` — add the public `GET /assist/:projectId.js` route.
- Create `src/routes/widget-config.ts` — owner-only `GET/PUT …/widget-config`.
- Modify `src/app.ts` (or wherever routes register) — register the new route module.
- Add dependency `@a11yaudit/assist-widget` to `apps/server/package.json`.

**`apps/web/`**
- Add dependency `@a11yaudit/assist-widget` to `apps/web/package.json`.
- Modify `src/api/client.ts` — `getWidgetConfig`, `updateWidgetConfig`.
- Create `src/pages/widget-settings.tsx` — the owner-only Widget panel + form.
- Create `src/pages/widget-preview.tsx` — the iframe preview component.
- Modify `src/i18n/messages.ts` — add `widget.*` keys (tr + en).
- Modify `src/app.tsx` + nav — route + owner-gated entry for the page.

---

## Task 1: Shared widget config contract

**Files:**
- Create: `packages/assist-widget/src/widget-config.ts`
- Modify: `packages/assist-widget/src/index.ts`
- Test: `packages/assist-widget/src/widget-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/assist-widget/src/widget-config.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, WIDGET_CONFIG_CSS_MAX_BYTES } from "./widget-config.js";

describe("normalizeWidgetConfig", () => {
  it("returns defaults for undefined/empty input", () => {
    expect(normalizeWidgetConfig(undefined)).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(normalizeWidgetConfig({})).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("keeps valid fields and drops invalid ones", () => {
    const result = normalizeWidgetConfig({
      enabledSections: ["content", "color", "bogus"],
      disabledFeatures: ["magnifier", "not-a-feature"],
      position: "top-left",
      language: "en",
      brand: { accent: "#abcdef", theme: "dark", launcherLabel: "Help", launcherIcon: "default" },
      customCss: ".x{color:red}"
    });
    expect(result.enabledSections).toEqual(["content", "color"]);
    expect(result.disabledFeatures).toEqual(["magnifier"]);
    expect(result.position).toBe("top-left");
    expect(result.language).toBe("en");
    expect(result.brand.accent).toBe("#abcdef");
    expect(result.brand.theme).toBe("dark");
    expect(result.customCss).toBe(".x{color:red}");
  });

  it("falls back invalid scalars to defaults", () => {
    const result = normalizeWidgetConfig({ position: "middle", language: "fr", brand: { accent: "red", theme: "neon" } });
    expect(result.position).toBe(DEFAULT_WIDGET_CONFIG.position);
    expect(result.language).toBe(DEFAULT_WIDGET_CONFIG.language);
    expect(result.brand.accent).toBe(DEFAULT_WIDGET_CONFIG.brand.accent);
    expect(result.brand.theme).toBe(DEFAULT_WIDGET_CONFIG.brand.theme);
  });

  it("strips </style> and @import from customCss and enforces the byte cap", () => {
    const result = normalizeWidgetConfig({ customCss: '@import url(x); a{}</style><script>' });
    expect(result.customCss).not.toMatch(/@import/i);
    expect(result.customCss.toLowerCase()).not.toContain("</style");
    const big = normalizeWidgetConfig({ customCss: "a".repeat(WIDGET_CONFIG_CSS_MAX_BYTES + 100) });
    expect(big.customCss.length).toBeLessThanOrEqual(WIDGET_CONFIG_CSS_MAX_BYTES);
  });

  it("resets a non-svg launcherIcon to default", () => {
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "alert('x')" } }).brand.launcherIcon).toBe("default");
    expect(normalizeWidgetConfig({ brand: { launcherIcon: "<svg></svg>" } }).brand.launcherIcon).toBe("<svg></svg>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/assist-widget/src/widget-config.test.ts`
Expected: FAIL — `Cannot find module './widget-config.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/assist-widget/src/widget-config.ts
import { ASSIST_SECTIONS, CONTENT_FEATURES, NAVIGATION_FEATURES, COLOR_FEATURES, type AssistSection, type WidgetLocale } from "./config.js";
import type { WidgetPosition } from "./loader.js";

export const WIDGET_CONFIG_GLOBAL = "__AA_ASSIST_CONFIG__";
export const WIDGET_CONFIG_CSS_MAX_BYTES = 50_000;

export type WidgetTheme = "light" | "dark" | "auto";

export interface WidgetBrand {
  accent: string;            // #rrggbb
  theme: WidgetTheme;
  launcherLabel?: string;
  launcherIcon: "default" | string; // "default" or an inline <svg> string
}

export interface WidgetConfig {
  enabledSections: AssistSection[];
  disabledFeatures: string[];
  position: WidgetPosition;
  language: WidgetLocale;
  brand: WidgetBrand;
  customCss: string;
}

const POSITIONS: WidgetPosition[] = ["bottom-right", "bottom-left", "top-right", "top-left"];
const THEMES: WidgetTheme[] = ["light", "dark", "auto"];
const KNOWN_FEATURES = new Set<string>([...CONTENT_FEATURES, ...NAVIGATION_FEATURES, ...COLOR_FEATURES]);
const KNOWN_SECTIONS = new Set<string>(ASSIST_SECTIONS);

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  enabledSections: [...ASSIST_SECTIONS],
  disabledFeatures: [],
  position: "bottom-right",
  language: "tr",
  brand: { accent: "#2b56b0", theme: "light", launcherIcon: "default" },
  customCss: ""
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function sanitizeCss(value: unknown): string {
  if (typeof value !== "string") return "";
  let css = value.replace(/<\/style/gi, "").replace(/@import[^;]*;?/gi, "");
  if (css.length > WIDGET_CONFIG_CSS_MAX_BYTES) css = css.slice(0, WIDGET_CONFIG_CSS_MAX_BYTES);
  return css;
}

function sanitizeLauncherIcon(value: unknown): "default" | string {
  if (typeof value !== "string" || value === "default") return "default";
  const trimmed = value.trim();
  return /^<svg[\s>][\s\S]*<\/svg>\s*$/i.test(trimmed) ? trimmed : "default";
}

export function normalizeWidgetConfig(input: unknown): WidgetConfig {
  const raw = asRecord(input);
  const brand = asRecord(raw.brand);

  const enabledSections = Array.isArray(raw.enabledSections)
    ? raw.enabledSections.filter((s): s is AssistSection => typeof s === "string" && KNOWN_SECTIONS.has(s))
    : [...DEFAULT_WIDGET_CONFIG.enabledSections];

  const disabledFeatures = Array.isArray(raw.disabledFeatures)
    ? raw.disabledFeatures.filter((f): f is string => typeof f === "string" && KNOWN_FEATURES.has(f))
    : [];

  const accent = typeof brand.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(brand.accent)
    ? brand.accent
    : DEFAULT_WIDGET_CONFIG.brand.accent;

  return {
    enabledSections: enabledSections.length > 0 ? Array.from(new Set(enabledSections)) : [...DEFAULT_WIDGET_CONFIG.enabledSections],
    disabledFeatures: Array.from(new Set(disabledFeatures)),
    position: POSITIONS.includes(raw.position as WidgetPosition) ? (raw.position as WidgetPosition) : DEFAULT_WIDGET_CONFIG.position,
    language: raw.language === "tr" || raw.language === "en" ? raw.language : DEFAULT_WIDGET_CONFIG.language,
    brand: {
      accent,
      theme: THEMES.includes(brand.theme as WidgetTheme) ? (brand.theme as WidgetTheme) : DEFAULT_WIDGET_CONFIG.brand.theme,
      launcherLabel: typeof brand.launcherLabel === "string" && brand.launcherLabel.trim() !== "" ? brand.launcherLabel.trim().slice(0, 60) : undefined,
      launcherIcon: sanitizeLauncherIcon(brand.launcherIcon)
    },
    customCss: sanitizeCss(raw.customCss)
  };
}
```

- [ ] **Step 4: Re-export from the package index**

In `packages/assist-widget/src/index.ts`, append:

```ts
export type { WidgetConfig, WidgetBrand, WidgetTheme } from "./widget-config.js";
export { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, WIDGET_CONFIG_GLOBAL, WIDGET_CONFIG_CSS_MAX_BYTES } from "./widget-config.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/assist-widget/src/widget-config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Build the package so server/web can import it later**

Run: `pnpm --filter @a11yaudit/assist-widget build`
Expected: tsc + vite build succeed; `dist/widget-config.js` and `dist/index.d.ts` exist.

- [ ] **Step 7: Commit**

```bash
git add packages/assist-widget/src/widget-config.ts packages/assist-widget/src/widget-config.test.ts packages/assist-widget/src/index.ts
git commit -m "feat(assist-widget): shared WidgetConfig contract + normalize/defaults"
```

---

## Task 2: `widget_configs` table + schema

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/db/client.ts` (inside `initializeDb`)
- Test: `apps/server/src/db/widget-config-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/db/widget-config-schema.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { initializeDb } from "./client.js";

describe("widget_configs schema", () => {
  it("is created by initializeDb and stores one row per project", () => {
    const sqlite = new Database(":memory:");
    initializeDb(sqlite);
    sqlite.prepare("INSERT INTO workspaces (id, name, slug, created_at) VALUES ('w','W','w','t')").run();
    sqlite.prepare("INSERT INTO projects (id, workspace_id, name, url, domain, created_at) VALUES ('p','w','P','https://x.com','x.com','t')").run();
    sqlite.prepare("INSERT INTO widget_configs (project_id, config, updated_at) VALUES ('p','{}','t')").run();
    const row = sqlite.prepare("SELECT project_id, config FROM widget_configs WHERE project_id='p'").get() as { project_id: string; config: string };
    expect(row.project_id).toBe("p");
    expect(row.config).toBe("{}");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/server/src/db/widget-config-schema.test.ts`
Expected: FAIL — `no such table: widget_configs`.

- [ ] **Step 3: Add the `CREATE TABLE` to `initializeDb`**

In `apps/server/src/db/client.ts`, inside the `sqlite.exec(\`…\`)` block in `initializeDb` (after the `reports`/`evidence_artifacts` table definitions), add:

```sql
      CREATE TABLE IF NOT EXISTS widget_configs (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        config TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
```

- [ ] **Step 4: Add the Drizzle table to `schema.ts`**

In `apps/server/src/db/schema.ts`, after the `projects` table, add:

```ts
export const widgetConfigs = sqliteTable("widget_configs", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  config: text("config").notNull(),
  updatedAt: text("updated_at").notNull()
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run apps/server/src/db/widget-config-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/client.ts apps/server/src/db/widget-config-schema.test.ts
git commit -m "feat(server): widget_configs table"
```

---

## Task 3: Widget-config repository

**Files:**
- Create: `apps/server/src/repositories/widget-config.ts`
- Test: `apps/server/src/repositories/widget-config.test.ts`
- Prereq: add `"@a11yaudit/assist-widget": "workspace:*"` to `apps/server/package.json` `dependencies`, then `pnpm install`.

- [ ] **Step 1: Add the dependency**

Edit `apps/server/package.json` dependencies to include `"@a11yaudit/assist-widget": "workspace:*"`. Run `pnpm install`.

- [ ] **Step 2: Write the failing test**

```ts
// apps/server/src/repositories/widget-config.test.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DEFAULT_WIDGET_CONFIG } from "@a11yaudit/assist-widget";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeDb } from "../db/client.js";
import { getWidgetConfig, getWidgetConfigForWorkspaceProject, upsertWidgetConfigForWorkspaceProject } from "./widget-config.js";

function setup() {
  const sqlite = new Database(":memory:");
  initializeDb(sqlite);
  sqlite.prepare("INSERT INTO workspaces (id, name, slug, created_at) VALUES ('w','W','acme','t')").run();
  sqlite.prepare("INSERT INTO projects (id, workspace_id, name, url, domain, created_at) VALUES ('p','w','P','https://x.com','x.com','t')").run();
  return drizzle(sqlite);
}

describe("widget-config repository", () => {
  let db: ReturnType<typeof setup>;
  beforeEach(() => { db = setup(); });

  it("getWidgetConfig returns defaults when no row exists", () => {
    expect(getWidgetConfig(db, "p")).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("getWidgetConfig returns defaults for an unknown project", () => {
    expect(getWidgetConfig(db, "nope")).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("upsert (workspace-scoped) writes and getWidgetConfig reads back normalized", () => {
    const saved = upsertWidgetConfigForWorkspaceProject(db, "acme", "p", { position: "top-left", customCss: "@import url(x); a{}" });
    expect(saved.position).toBe("top-left");
    expect(saved.customCss).not.toMatch(/@import/i);
    expect(getWidgetConfig(db, "p").position).toBe("top-left");
  });

  it("upsert throws when the project is not in the workspace", () => {
    expect(() => upsertWidgetConfigForWorkspaceProject(db, "other-slug", "p", {})).toThrow();
  });

  it("getWidgetConfig returns defaults when the stored JSON is malformed", () => {
    upsertWidgetConfigForWorkspaceProject(db, "acme", "p", {});
    // corrupt it
    (db as any).$client?.prepare?.("UPDATE widget_configs SET config='{bad' WHERE project_id='p'").run?.();
    expect(getWidgetConfig(db, "p")).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});
```

> Note: if `db.$client` is not exposed in this Drizzle version, corrupt the row by passing the raw `sqlite` handle out of `setup()` instead. Keep the assertion: malformed JSON ⇒ defaults.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run apps/server/src/repositories/widget-config.test.ts`
Expected: FAIL — `Cannot find module './widget-config.js'`.

- [ ] **Step 4: Implement the repository**

```ts
// apps/server/src/repositories/widget-config.ts
import { and, eq } from "drizzle-orm";
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, type WidgetConfig } from "@a11yaudit/assist-widget";
import type { SqliteDatabase } from "../db/client.js";
import { projects, widgetConfigs, workspaces } from "../db/schema.js";

/** Public read: config for a project id, or defaults when absent/malformed. Not workspace-scoped (the public bundle route uses it). */
export function getWidgetConfig(db: SqliteDatabase, projectId: string): WidgetConfig {
  const row = db.select({ config: widgetConfigs.config }).from(widgetConfigs).where(eq(widgetConfigs.projectId, projectId)).get();
  if (!row) return DEFAULT_WIDGET_CONFIG;
  try {
    return normalizeWidgetConfig(JSON.parse(row.config));
  } catch {
    return DEFAULT_WIDGET_CONFIG;
  }
}

function assertProjectInWorkspace(db: SqliteDatabase, workspaceSlug: string, projectId: string): void {
  const row = db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(projects.id, projectId), eq(workspaces.slug, workspaceSlug)))
    .get();
  if (!row) throw new Error("Project not found in workspace");
}

/** Owner read: config for a workspace project (defaults when absent). Verifies the project belongs to the workspace. */
export function getWidgetConfigForWorkspaceProject(db: SqliteDatabase, workspaceSlug: string, projectId: string): WidgetConfig {
  assertProjectInWorkspace(db, workspaceSlug, projectId);
  return getWidgetConfig(db, projectId);
}

/** Owner write: normalize + upsert. Verifies the project belongs to the workspace (IDOR boundary). Returns the stored (normalized) config. */
export function upsertWidgetConfigForWorkspaceProject(db: SqliteDatabase, workspaceSlug: string, projectId: string, input: unknown): WidgetConfig {
  assertProjectInWorkspace(db, workspaceSlug, projectId);
  const config = normalizeWidgetConfig(input);
  const now = new Date().toISOString();
  db.insert(widgetConfigs)
    .values({ projectId, config: JSON.stringify(config), updatedAt: now })
    .onConflictDoUpdate({ target: widgetConfigs.projectId, set: { config: JSON.stringify(config), updatedAt: now } })
    .run();
  return config;
}
```

> Check the exact `SqliteDatabase` type export name in `apps/server/src/db/client.ts` and match it (the projects route imports `type { SqliteDatabase }` from there).

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run apps/server/src/repositories/widget-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/package.json apps/server/src/repositories/widget-config.ts apps/server/src/repositories/widget-config.test.ts
git commit -m "feat(server): widget-config repository (get/upsert, defaults, workspace-scoped)"
```

---

## Task 4: Public `GET /assist/:projectId.js` route

**Files:**
- Modify: `apps/server/src/routes/assist.ts`
- Test: `apps/server/src/routes/assist.test.ts` (create if absent; otherwise extend) — but prefer an integration test in the existing server app test. Use a focused unit test here.

The route needs the DB. `registerAssistRoutes` currently takes only `server`. Add an options object `{ db }` (mirror `registerProjectRoutes(app, { db })`). Update its registration call site in `app.ts` to pass `db`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/routes/assist.test.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { initializeDb } from "../db/client.js";
import { upsertWidgetConfigForWorkspaceProject } from "../repositories/widget-config.js";
import { registerAssistRoutes } from "./assist.js";

function buildApp() {
  const sqlite = new Database(":memory:");
  initializeDb(sqlite);
  sqlite.prepare("INSERT INTO workspaces (id, name, slug, created_at) VALUES ('w','W','acme','t')").run();
  sqlite.prepare("INSERT INTO projects (id, workspace_id, name, url, domain, created_at) VALUES ('proj','w','P','https://x.com','x.com','t')").run();
  const db = drizzle(sqlite);
  const app = Fastify();
  return { app, db };
}

describe("GET /assist/:projectId.js", () => {
  it("inlines the project config before the shared bundle with cache + cors headers", async () => {
    const { app, db } = buildApp();
    upsertWidgetConfigForWorkspaceProject(db, "acme", "proj", { position: "top-left" });
    await registerAssistRoutes(app, { db });
    const res = await app.inject({ method: "GET", url: "/assist/proj.js" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("javascript");
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.body).toMatch(/^window\.__AA_ASSIST_CONFIG__\s*=/);
    expect(res.body).toContain('"position":"top-left"');
    await app.close();
  });

  it("serves default config for an unknown project (never 404 on a typo)", async () => {
    const { app, db } = buildApp();
    await registerAssistRoutes(app, { db });
    const res = await app.inject({ method: "GET", url: "/assist/does-not-exist.js" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('"position":"bottom-right"');
    await app.close();
  });
});
```

> The shared bundle must be built for the body to include it; the assertions above only check the inlined prelude and headers, so they pass even if the bundle file is absent only when you make a missing bundle return the prelude + 404… Instead: ensure the bundle exists by running `pnpm --filter @a11yaudit/assist-widget build` before this test, OR have the route still emit the prelude and a `console.warn`-style comment when the bundle is missing. Decision: **if the bundle is missing, return 404** (consistent with the existing routes). To keep the test independent of a built bundle, assert only on the prelude/headers and run the build in Step 4's verification.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/server/src/routes/assist.test.ts`
Expected: FAIL — route not found (404) / `registerAssistRoutes` signature mismatch.

- [ ] **Step 3: Implement the route**

Rewrite `apps/server/src/routes/assist.ts` `registerAssistRoutes` to take options and add the per-project route. Add these imports at the top:

```ts
import { normalizeWidgetConfig } from "@a11yaudit/assist-widget";
import type { SqliteDatabase } from "../db/client.js";
import { getWidgetConfig } from "../repositories/widget-config.js";
```

Replace the `registerAssistRoutes` signature and body:

```ts
export interface AssistRouteOptions {
  db: SqliteDatabase;
}

export async function registerAssistRoutes(server: FastifyInstance, options: AssistRouteOptions): Promise<void> {
  const { db } = options;

  server.get("/assist/a11yaudit-assist.js", async (_request, reply) =>
    serveAsset(resolveBundlePath, "", "text/javascript; charset=utf-8", reply)
  );

  server.get("/assist/a11yaudit-assist.js.map", async (_request, reply) =>
    serveAsset(resolveBundlePath, ".map", "application/json; charset=utf-8", reply)
  );

  // Per-project bundle: inline config prelude + the shared bundle bytes.
  server.get<{ Params: { projectId: string } }>("/assist/:projectId.js", async (request, reply) => {
    const { projectId } = request.params;
    // Don't shadow the shared bundle path.
    if (projectId === "a11yaudit-assist") {
      return serveAsset(resolveBundlePath, "", "text/javascript; charset=utf-8", reply);
    }

    const bundlePath = resolveBundlePath();
    if (bundlePath === undefined) {
      return reply.code(404).send({ error: "assist widget bundle not built" });
    }

    const config = getWidgetConfig(db, projectId);
    const prelude = `window.__AA_ASSIST_CONFIG__=${JSON.stringify(config)};\n`;

    try {
      const bundle = await readFile(bundlePath, "utf8");
      return reply
        .header("content-type", "text/javascript; charset=utf-8")
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-credentials", "false")
        .header("cache-control", "public, max-age=60")
        .send(prelude + bundle);
    } catch {
      return reply.code(404).send({ error: "assist widget bundle not built" });
    }
  });
}
```

> Fastify route ordering: register the literal `/assist/a11yaudit-assist.js` routes before the parametric `/assist/:projectId.js`. Fastify's radix router prefers static over parametric regardless of order, but the explicit `projectId === "a11yaudit-assist"` guard makes intent obvious and is a safety net. The `.js.map` request for the per-project bundle is not needed (source maps point at the shared bundle, served by its own route).

- [ ] **Step 4: Update the registration call site**

In `apps/server/src/app.ts`, find `registerAssistRoutes(...)` and pass the db, e.g. `await registerAssistRoutes(app, { db });` (use the same `db` instance the other route registrations use).

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @a11yaudit/assist-widget build && pnpm vitest run apps/server/src/routes/assist.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/assist.ts apps/server/src/routes/assist.test.ts apps/server/src/app.ts
git commit -m "feat(server): public per-project assist bundle route (config prelude + bundle)"
```

---

## Task 5: Owner-only `GET/PUT …/widget-config` route

**Files:**
- Create: `apps/server/src/routes/widget-config.ts`
- Modify: `apps/server/src/app.ts` (register the route module)
- Test: extend `apps/server/src/app.test.ts` (integration, real auth + roles), following the existing project/members route tests.

- [ ] **Step 1: Write the failing test (integration, mirrors existing app.test.ts cases)**

Add to `apps/server/src/app.test.ts` a `describe("widget config routes", …)` block. Use the existing helpers in that file for signing up an owner, creating a workspace + project, and inviting a member (copy the setup pattern from the nearby project/members tests). Assertions:

```ts
// inside app.test.ts, using existing test helpers (ownerAgent, memberAgent, workspaceSlug, projectId)
it("owner can PUT then GET widget config; member is forbidden", async () => {
  const put = await ownerAgent.inject({
    method: "PUT",
    url: `/api/workspaces/${slug}/projects/${projectId}/widget-config`,
    headers: csrfHeaders(ownerAgent),
    payload: { position: "top-left", brand: { accent: "#abcdef" }, customCss: "@import url(x); a{}" }
  });
  expect(put.statusCode).toBe(200);
  expect(put.json().config.position).toBe("top-left");
  expect(put.json().config.customCss).not.toMatch(/@import/i);

  const get = await ownerAgent.inject({ method: "GET", url: `/api/workspaces/${slug}/projects/${projectId}/widget-config` });
  expect(get.json().config.position).toBe("top-left");

  const memberPut = await memberAgent.inject({
    method: "PUT",
    url: `/api/workspaces/${slug}/projects/${projectId}/widget-config`,
    headers: csrfHeaders(memberAgent),
    payload: { position: "top-right" }
  });
  expect(memberPut.statusCode).toBe(403);
});

it("rejects an invalid accent", async () => {
  const res = await ownerAgent.inject({
    method: "PUT",
    url: `/api/workspaces/${slug}/projects/${projectId}/widget-config`,
    headers: csrfHeaders(ownerAgent),
    payload: { brand: { accent: "red" } }
  });
  expect(res.statusCode).toBe(400);
});
```

> Match the exact helper names already used in `app.test.ts` (e.g. how it builds the agent, sets CSRF headers, signs up, creates a project). Reuse them; do not invent new harness code.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/server/src/app.test.ts -t "widget config"`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Implement the route**

```ts
// apps/server/src/routes/widget-config.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import { getWidgetConfigForWorkspaceProject, upsertWidgetConfigForWorkspaceProject } from "../repositories/widget-config.js";
import { requireWorkspaceMembership, requireWorkspaceOwner, workspaceParamsSchema } from "./workspace-access.js";

const paramsSchema = workspaceParamsSchema.extend({ projectId: z.string().trim().min(1) });

// Strict input shape: reject obviously bad scalars at the edge with 400; deeper
// normalization (drop unknown features, strip CSS) happens in normalizeWidgetConfig.
const brandSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  theme: z.enum(["light", "dark", "auto"]).optional(),
  launcherLabel: z.string().max(60).optional(),
  launcherIcon: z.string().optional()
}).strict().optional();

const configPayloadSchema = z.object({
  enabledSections: z.array(z.string()).optional(),
  disabledFeatures: z.array(z.string()).optional(),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional(),
  language: z.enum(["tr", "en"]).optional(),
  brand: brandSchema,
  customCss: z.string().optional()
}).strict();

export interface WidgetConfigRouteOptions {
  db: SqliteDatabase;
}

export async function registerWidgetConfigRoutes(app: FastifyInstance, options: WidgetConfigRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/workspaces/:workspaceSlug/projects/:projectId/widget-config", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid parameters", issues: params.error.issues });
    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;
    try {
      const config = getWidgetConfigForWorkspaceProject(db, params.data.workspaceSlug, params.data.projectId);
      return reply.send({ config });
    } catch {
      return reply.code(404).send({ error: "Project not found" });
    }
  });

  app.put("/api/workspaces/:workspaceSlug/projects/:projectId/widget-config", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid parameters", issues: params.error.issues });
    const owner = await requireWorkspaceOwner(db, user.id, params.data.workspaceSlug, reply);
    if (!owner) return undefined;
    const payload = configPayloadSchema.safeParse(request.body);
    if (!payload.success) return reply.code(400).send({ error: "Invalid widget config", issues: payload.error.issues });
    try {
      const config = upsertWidgetConfigForWorkspaceProject(db, params.data.workspaceSlug, params.data.projectId, payload.data);
      return reply.send({ config });
    } catch {
      return reply.code(404).send({ error: "Project not found" });
    }
  });
}
```

> Verify the exact signatures of `requireWorkspaceMembership` / `requireWorkspaceOwner` in `apps/server/src/routes/workspace-access.ts` and match argument order / return shape (the projects route uses `requireWorkspaceMembership(db, user.id, slug, reply)` and a context object). Adjust if the real signature differs.

- [ ] **Step 4: Register the route module**

In `apps/server/src/app.ts`, alongside `registerProjectRoutes(app, { db })`, add `await registerWidgetConfigRoutes(app, { db });` and import it.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run apps/server/src/app.test.ts -t "widget config"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/widget-config.ts apps/server/src/app.ts apps/server/src/app.test.ts
git commit -m "feat(server): owner-only widget-config GET/PUT route"
```

---

## Task 6: Widget loader reads `__AA_ASSIST_CONFIG__`

**Files:**
- Modify: `packages/assist-widget/src/loader.ts`
- Modify: `packages/assist-widget/src/widget.ts` (options carry `config`)
- Test: `packages/assist-widget/src/loader.test.ts` (extend existing)

- [ ] **Step 1: Write the failing test**

Add to `packages/assist-widget/src/loader.test.ts`:

```ts
import { DEFAULT_WIDGET_CONFIG, WIDGET_CONFIG_GLOBAL } from "./widget-config.js";
import { resolveWidgetConfig } from "./loader.js";

describe("resolveWidgetConfig", () => {
  afterEach(() => { delete (window as any).__AA_ASSIST_CONFIG__; });

  it("prefers window.__AA_ASSIST_CONFIG__ when present (normalized)", () => {
    (window as any)[WIDGET_CONFIG_GLOBAL] = { position: "top-left", brand: { accent: "#abcdef" } };
    const config = resolveWidgetConfig(undefined);
    expect(config.position).toBe("top-left");
    expect(config.brand.accent).toBe("#abcdef");
  });

  it("falls back to data-* attributes when the global is absent", () => {
    const script = document.createElement("script");
    script.dataset.position = "bottom-left";
    script.dataset.language = "en";
    script.dataset.enabledSections = "content color";
    const config = resolveWidgetConfig(script);
    expect(config.position).toBe("bottom-left");
    expect(config.language).toBe("en");
    expect(config.enabledSections).toEqual(["content", "color"]);
  });

  it("returns defaults when neither is present", () => {
    expect(resolveWidgetConfig(undefined)).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/assist-widget/src/loader.test.ts`
Expected: FAIL — `resolveWidgetConfig` not exported.

- [ ] **Step 3: Implement `resolveWidgetConfig` and wire it into init**

In `packages/assist-widget/src/loader.ts` add imports and the resolver:

```ts
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, WIDGET_CONFIG_GLOBAL, type WidgetConfig } from "./widget-config.js";

/**
 * The effective config: the inlined per-project global wins; otherwise build one
 * from the legacy data-* attributes; otherwise defaults.
 */
export function resolveWidgetConfig(script: HTMLScriptElement | undefined): WidgetConfig {
  const injected = typeof window !== "undefined" ? (window as Record<string, unknown>)[WIDGET_CONFIG_GLOBAL] : undefined;
  if (injected !== undefined) return normalizeWidgetConfig(injected);
  if (!script) return DEFAULT_WIDGET_CONFIG;
  const opts = parseLoaderOptions(script);
  return normalizeWidgetConfig({
    enabledSections: opts.enabledSections,
    position: opts.position,
    language: opts.language
  });
}
```

Then, where the loader auto-initialises from the script tag (the bottom of `loader.ts` / wherever `initAssistWidget` is invoked with parsed options), pass the resolved config through to `mountAssistWidget`. In `initAssistWidget`, change the mount call to include `config`:

```ts
  const config = options.config ?? DEFAULT_WIDGET_CONFIG;
  const mountedInstance = mountAssistWidget({
    projectId: options.projectId,
    position: config.position,
    language: config.language,
    enabledSections: config.enabledSections,
    config
  });
```

And update the auto-init site (find where the script reads `document.currentScript` / iterates script tags) to compute `resolveWidgetConfig(script)` and pass `{ config, projectId }` to `initAssistWidget`. (Search `loader.ts` for the existing bootstrap that calls `parseLoaderOptions` and `initAssistWidget`; replace its option construction with the resolved config.)

- [ ] **Step 4: Extend `AssistWidgetOptions`**

In `packages/assist-widget/src/widget.ts`, add to `AssistWidgetOptions`:

```ts
  config?: import("./widget-config.js").WidgetConfig;
```

(Brand/customCss application is Task 7; this task only threads the type so it compiles.)

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run packages/assist-widget/src/loader.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/assist-widget/src/loader.ts packages/assist-widget/src/widget.ts packages/assist-widget/src/loader.test.ts
git commit -m "feat(assist-widget): loader prefers __AA_ASSIST_CONFIG__ over data-attrs"
```

---

## Task 7: Apply brand + disabledFeatures + customCss in the widget

**Files:**
- Modify: `packages/assist-widget/src/widget.ts`
- Modify: `packages/assist-widget/src/styles.ts` (dark tokens, launcher label rule)
- Test: `packages/assist-widget/src/widget.test.ts` (extend existing DOM test)

- [ ] **Step 1: Write the failing test**

Add to `packages/assist-widget/src/widget.test.ts` (it already mounts into jsdom; reuse its setup):

```ts
it("applies accent, custom css, launcher label and hides disabled features", () => {
  const instance = mountAssistWidget({
    config: {
      enabledSections: ["content"],
      disabledFeatures: ["magnifier"],
      position: "bottom-right",
      language: "tr",
      brand: { accent: "#123456", theme: "light", launcherLabel: "Erişilebilirlik", launcherIcon: "default" },
      customCss: ".aa-custom-probe{color:rgb(1,2,3)}"
    }
  });
  const root = document.getElementById("aa-assist-root")!;
  const shadow = root.shadowRoot!;
  // accent var
  const host = shadow.host as HTMLElement;
  expect(host.style.getPropertyValue("--aa-acc")).toBe("#123456");
  // custom css injected
  expect(shadow.querySelector("style[data-aa-custom]")?.textContent).toContain("aa-custom-probe");
  // launcher label
  expect(shadow.querySelector(".aa-assist-launcher")?.getAttribute("aria-label")).toBe("Erişilebilirlik");
  // disabled feature control absent
  expect(shadow.querySelector('[data-aa-feature="magnifier"]')).toBeNull();
  instance.unmount();
});
```

> Match the real DOM hooks in `widget.ts`: the launcher class, how feature controls are rendered, and whether they carry a `data-aa-feature` attribute. If controls are not currently tagged with a feature id, add `data-aa-feature="<id>"` when rendering each control (small, also useful for `disabledFeatures`). Adjust the selector in the test to the real attribute.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/assist-widget/src/widget.test.ts -t "applies accent"`
Expected: FAIL.

- [ ] **Step 3: Implement application in `mountAssistWidget`**

In `packages/assist-widget/src/widget.ts`, after the shadow root + base style are created and before/after controls render, add (using `options.config`, default to `DEFAULT_WIDGET_CONFIG`):

```ts
import { DEFAULT_WIDGET_CONFIG } from "./widget-config.js";
// …
const config = options.config ?? DEFAULT_WIDGET_CONFIG;

// 1) accent
(root as HTMLElement).style.setProperty("--aa-acc", config.brand.accent);

// 2) theme: set an attribute the stylesheet keys off (see styles.ts dark tokens)
root.dataset.theme = config.brand.theme;

// 3) custom css into the shadow root, after the base stylesheet
if (config.customCss) {
  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-aa-custom", "true");
  styleEl.textContent = config.customCss;
  shadowRoot.appendChild(styleEl);
}

// 4) launcher label
if (config.brand.launcherLabel) {
  launcher.setAttribute("aria-label", config.brand.launcherLabel);
}

// 5) launcher icon
if (config.brand.launcherIcon && config.brand.launcherIcon !== "default") {
  launcher.innerHTML = config.brand.launcherIcon; // sanitized to a single <svg> at write time
}
```

For `disabledFeatures`: where each feature control is created, tag it `control.dataset.aaFeature = featureId;` and skip rendering when `config.disabledFeatures.includes(featureId)`. (Use the existing per-section render loop; the feature id is the same string used in `config.ts` `CONTENT_FEATURES`/etc.)

> `root` is the host element (`#aa-assist-root`); `shadowRoot` is its shadow; `launcher` is the launcher button element. Use the variable names already present in `widget.ts`.

- [ ] **Step 4: Add dark-theme tokens + launcher rule in styles.ts**

In `packages/assist-widget/src/styles.ts`, add after the `:host { --aa-acc… }` rule:

```css
:host([data-theme="dark"]) .aa-assist-panel { background:#1b1d22; color:#e8eaed; border-color:#2c2f36; }
:host([data-theme="dark"]) .aa-assist-control { background:#23262d; color:#e8eaed; border-color:#2c2f36; }
:host([data-theme="dark"]) .aa-assist-header { border-color:#2c2f36; }
:host([data-theme="dark"]) .aa-assist-close { background:#23262d; color:#aeb3bb; border-color:#2c2f36; }
```

(`auto` leaves the default light tokens; honoring OS `prefers-color-scheme` for `auto` is a later refinement — not in scope.)

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run packages/assist-widget/src/widget.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 6: Rebuild the bundle**

Run: `pnpm --filter @a11yaudit/assist-widget build`
Expected: success; the IIFE bundle now applies config.

- [ ] **Step 7: Commit**

```bash
git add packages/assist-widget/src/widget.ts packages/assist-widget/src/styles.ts packages/assist-widget/src/widget.test.ts
git commit -m "feat(assist-widget): apply brand, disabled features, custom css from config"
```

---

## Task 8: Web API client methods

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/package.json` (add `@a11yaudit/assist-widget` dep)
- Test: `apps/web/src/api/client.test.ts` (extend existing)

- [ ] **Step 1: Add the dependency**

Add `"@a11yaudit/assist-widget": "workspace:*"` to `apps/web/package.json` dependencies. Run `pnpm install`.

- [ ] **Step 2: Write the failing test**

Mirror the existing client tests in `apps/web/src/api/client.test.ts` (they stub `fetch` / use the test base). Add:

```ts
it("getWidgetConfig GETs the workspace project widget-config", async () => {
  // arrange fetch mock to return { config: DEFAULT_WIDGET_CONFIG }
  const config = await getWidgetConfig("acme", "p1");
  expect(lastFetchUrl()).toContain("/api/workspaces/acme/projects/p1/widget-config");
  expect(config.position).toBe("bottom-right");
});

it("updateWidgetConfig PUTs with CSRF and returns the saved config", async () => {
  const config = await updateWidgetConfig("acme", "p1", { position: "top-left" });
  expect(lastFetchMethod()).toBe("PUT");
  expect(config.position).toBeDefined();
});
```

> Use the exact mock/harness helpers already in `client.test.ts` (how it stubs fetch and reads the last request). Reuse them.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run apps/web/src/api/client.test.ts -t "widget"`
Expected: FAIL — methods not exported.

- [ ] **Step 4: Implement the client methods**

In `apps/web/src/api/client.ts` add (using the existing `apiFetch` helper that attaches credentials + CSRF, and `normalizeWidgetConfig` for safety):

```ts
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, type WidgetConfig } from "@a11yaudit/assist-widget";

export async function getWidgetConfig(workspaceSlug: string, projectId: string): Promise<WidgetConfig> {
  const res = await apiFetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/widget-config`, { method: "GET" });
  if (!res) return DEFAULT_WIDGET_CONFIG;
  const body = (await res.json()) as { config?: unknown };
  return normalizeWidgetConfig(body.config);
}

export async function updateWidgetConfig(workspaceSlug: string, projectId: string, input: Partial<WidgetConfig>): Promise<WidgetConfig> {
  const res = await apiFetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/widget-config`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  if (!res) throw new Error("Widget config update failed");
  const body = (await res.json()) as { config?: unknown };
  return normalizeWidgetConfig(body.config);
}
```

> Match how the other mutating methods in this file call `apiFetch` (header construction, error handling, the `skipCsrf` flag). Mirror them exactly.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run apps/web/src/api/client.test.ts -t "widget"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/api/client.ts apps/web/src/api/client.test.ts
git commit -m "feat(web): widget-config API client methods"
```

---

## Task 9: i18n keys for the Widget panel

**Files:**
- Modify: `apps/web/src/i18n/messages.ts`
- Test: `apps/web/src/i18n/messages.test.ts` (it already asserts tr/en parity — extend or rely on it)

- [ ] **Step 1: Add keys to the `Messages` interface and both locale objects**

Add the following keys (interface + tr + en). Keep parity (the existing `messages.test.ts` enforces that both locales have identical keys):

```
"widget.title"            tr "Widget" / en "Widget"
"widget.subtitle"         tr "Sitenize gömülü erişilebilirlik widget'ını buradan yönetin." / en "Manage the accessibility widget embedded on your site."
"widget.sections"         tr "Bölümler" / en "Sections"
"widget.features"         tr "Özellikler" / en "Features"
"widget.position"         tr "Konum" / en "Position"
"widget.language"         tr "Dil" / en "Language"
"widget.accent"           tr "Vurgu rengi" / en "Accent color"
"widget.theme"            tr "Tema" / en "Theme"
"widget.themeLight"       tr "Açık" / en "Light"
"widget.themeDark"        tr "Koyu" / en "Dark"
"widget.themeAuto"        tr "Otomatik" / en "Auto"
"widget.launcherLabel"    tr "Buton etiketi" / en "Launcher label"
"widget.launcherIcon"     tr "Buton ikonu (SVG)" / en "Launcher icon (SVG)"
"widget.customCss"        tr "Özel CSS" / en "Custom CSS"
"widget.embed"            tr "Gömme kodu" / en "Embed snippet"
"widget.embedCopy"        tr "Kopyala" / en "Copy"
"widget.preview"          tr "Canlı önizleme" / en "Live preview"
"widget.save"             tr "Kaydet" / en "Save"
"widget.saved"            tr "Kaydedildi — ~1 dk içinde canlı." / en "Saved — live within ~1 minute."
"widget.ownerOnly"        tr "Bu ayarları yalnızca workspace sahibi düzenleyebilir." / en "Only the workspace owner can edit these settings."
"nav.widget"              tr "Widget" / en "Widget"
```

> Note: no em-dashes in copy — the catalog uses ":" / "," elsewhere; "Kaydedildi — …" above uses an em-dash. Replace with ":" → "Kaydedildi: ~1 dk içinde canlı." / "Saved: live within ~1 minute." (project rule: no em-dash in user-facing copy).

- [ ] **Step 2: Run to verify parity test passes**

Run: `pnpm vitest run apps/web/src/i18n/messages.test.ts`
Expected: PASS (tr/en key parity holds).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/messages.ts
git commit -m "feat(web): i18n keys for widget settings panel"
```

---

## Task 10: Widget settings page (form + embed snippet)

**Files:**
- Create: `apps/web/src/pages/widget-settings.tsx`
- Modify: `apps/web/src/app.tsx` (route) + the nav/shell (owner-gated entry, like the existing members page)
- Test: `apps/web/src/pages/widget-settings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/pages/widget-settings.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithLocale } from "../test-utils/render-with-locale"; // reuse existing helper
import { WidgetSettingsPage } from "./widget-settings.js";

vi.mock("../api/client", () => ({
  getWidgetConfig: vi.fn().mockResolvedValue({ enabledSections: ["content","navigation","color"], disabledFeatures: [], position: "bottom-right", language: "tr", brand: { accent: "#2b56b0", theme: "light", launcherIcon: "default" }, customCss: "" }),
  updateWidgetConfig: vi.fn().mockResolvedValue({ position: "top-left" }),
  getArtifactDownloadUrl: vi.fn()
}));

it("renders the embed snippet with the project id and saves on submit", async () => {
  renderWithLocale(<WidgetSettingsPage workspaceSlug="acme" project={{ id: "p1", name: "P", domain: "x.com" } as any} role="owner" />);
  await waitFor(() => expect(screen.getByText(/assist\/p1\.js/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /Kaydet|Save/ }));
  const { updateWidgetConfig } = await import("../api/client");
  await waitFor(() => expect(updateWidgetConfig).toHaveBeenCalledWith("acme", "p1", expect.any(Object)));
});

it("is read-only for members", () => {
  renderWithLocale(<WidgetSettingsPage workspaceSlug="acme" project={{ id: "p1", name: "P", domain: "x.com" } as any} role="member" />);
  expect(screen.getByText(/yalnızca workspace sahibi|Only the workspace owner/)).toBeInTheDocument();
});
```

> Match the real prop contract of other pages (how `workspaceSlug`, `project`, and the current user `role` reach a page in this app — see `members.tsx` / `PageProps`). Adjust the props and the `renderWithLocale` usage to the existing convention.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/web/src/pages/widget-settings.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the page**

Build `WidgetSettingsPage` using the existing design components (`PageHeader`, `Panel`, `Field`, `Button`, toggles/selects from `design/ui.tsx`) and the `useT()` hook. Structure:

- Load config with TanStack Query (`useQuery(["widget-config", slug, projectId], () => getWidgetConfig(slug, projectId))`).
- Hold an editable draft in `useState<WidgetConfig>` seeded from the query (sync on load).
- For `role !== "owner"`: render the `widget.ownerOnly` note and the form **disabled** (read-only).
- Controls (each updates draft): section checkboxes (`enabledSections`), feature checkboxes grouped by section (toggles `disabledFeatures`), `position` select (4 values), `language` select (tr/en), `accent` `<input type="color">`, `theme` select, `launcherLabel` text input, `launcherIcon` `<textarea>` (SVG), `customCss` `<textarea>`.
- Embed snippet block: compute `origin` from `window.location.origin` and show `<script src="${origin}/assist/${project.id}.js" defer></script>` with a copy button (`navigator.clipboard.writeText`).
- Save button: `useMutation(() => updateWidgetConfig(slug, projectId, draft))`; on success show the `widget.saved` toast/inline message and `queryClient.invalidateQueries(["widget-config", …])`.
- Render `<WidgetPreview config={draft} />` (Task 11) in a side/below pane.

Keep the file focused; if it grows past ~250 lines, extract the form fields into a `widget-settings-form.tsx` sibling. Use the exact patterns from `members.tsx` for query/mutation/owner-gating.

- [ ] **Step 4: Wire the route + owner-gated nav entry**

In `apps/web/src/app.tsx`, add a `widget-settings` page to the route union and render `WidgetSettingsPage` for it (mirror how `members` is wired: parse path → page object → render). Add a nav entry using `t("nav.widget")` shown when a project is selected (and, like members, gated so members can still open it but see read-only). Follow the existing `members` nav pattern exactly.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run apps/web/src/pages/widget-settings.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/widget-settings.tsx apps/web/src/app.tsx
git commit -m "feat(web): widget settings page (form + embed snippet, owner-gated)"
```

---

## Task 11: Live preview iframe

**Files:**
- Create: `apps/web/src/pages/widget-preview.tsx`
- Test: `apps/web/src/pages/widget-preview.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/pages/widget-preview.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildPreviewSrcdoc } from "./widget-preview.js";

const cfg = { enabledSections: ["content"], disabledFeatures: [], position: "bottom-right", language: "tr", brand: { accent: "#123456", theme: "light", launcherIcon: "default" }, customCss: ".x{}" } as any;

describe("buildPreviewSrcdoc", () => {
  it("inlines the draft config global and points at the shared bundle", () => {
    const html = buildPreviewSrcdoc(cfg, "https://app.example.com");
    expect(html).toContain("window.__AA_ASSIST_CONFIG__");
    expect(html).toContain('"accent":"#123456"');
    expect(html).toContain("https://app.example.com/assist/a11yaudit-assist.js");
    // not the per-project route — preview uses the draft, not stored config
    expect(html).not.toMatch(/assist\/p1\.js/);
  });

  it("escapes </script> in custom css to avoid breaking the srcdoc", () => {
    const html = buildPreviewSrcdoc({ ...cfg, customCss: "a{}</script>" }, "https://app.example.com");
    expect(html).not.toContain("</script><");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run apps/web/src/pages/widget-preview.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the preview**

```tsx
// apps/web/src/pages/widget-preview.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { WidgetConfig } from "@a11yaudit/assist-widget";

const SAMPLE_BODY = `
  <main style="max-width:640px;margin:40px auto;font-family:system-ui;padding:0 20px">
    <h1>Örnek sayfa</h1>
    <p>Bu, widget'ın gerçek bir sayfada nasıl göründüğünü gösteren önizlemedir. Metni okuyun, butona tıklayın, tercihleri deneyin.</p>
    <p><a href="#">Örnek bağlantı</a> ve <button type="button">Örnek buton</button>.</p>
  </main>`;

// JSON embedded in <script> must not contain a literal </script>.
function safeJson(config: WidgetConfig): string {
  return JSON.stringify(config).replace(/<\/script/gi, "<\\/script");
}

export function buildPreviewSrcdoc(config: WidgetConfig, origin: string): string {
  return `<!doctype html><html lang="${config.language}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>${SAMPLE_BODY}
<script>window.__AA_ASSIST_CONFIG__=${safeJson(config)};</script>
<script src="${origin}/assist/a11yaudit-assist.js" defer></script>
</body></html>`;
}

export function WidgetPreview({ config }: { config: WidgetConfig }): JSX.Element {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [srcdoc, setSrcdoc] = useState(() => buildPreviewSrcdoc(config, origin));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce re-renders so typing in the CSS box doesn't reload on every keystroke.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSrcdoc(buildPreviewSrcdoc(config, origin)), 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [config, origin]);

  return (
    <iframe
      title="widget-preview"
      srcDoc={srcdoc}
      style={{ width: "100%", height: 520, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }}
    />
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run apps/web/src/pages/widget-preview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/widget-preview.tsx apps/web/src/pages/widget-preview.test.tsx
git commit -m "feat(web): live widget preview iframe (draft config, shared bundle)"
```

---

## Task 12: Full build, full test, docs, deploy note

**Files:**
- Modify: `docs/deployment.md` (one line about the per-project route)
- Modify: `docs/ROADMAP.md` (tick the item if listed)

- [ ] **Step 1: Full monorepo build + typecheck**

Run: `pnpm build && pnpm typecheck`
Expected: clean. Fix any cross-package type drift (e.g. `SqliteDatabase` name, `requireWorkspaceOwner` signature).

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all green (existing + new).

- [ ] **Step 3: Document the route in deployment.md**

Under the "Accessibility widget (embeddable)" section of `docs/deployment.md`, add:

```text
GET /assist/<projectId>.js   → per-project bundle: inlines window.__AA_ASSIST_CONFIG__
                                (owner-managed config) before the shared bundle.
                                Public, CORS *, Cache-Control: public, max-age=60.
                                Unknown projectId serves default config (never 404 on a typo).
```

- [ ] **Step 4: Commit**

```bash
git add docs/deployment.md docs/ROADMAP.md
git commit -m "docs: per-project assist bundle route + roadmap"
```

- [ ] **Step 5: Manual end-to-end verification (local), then deploy**

1. `pnpm dev:server` + `pnpm dev:web`. As an owner, open a project → Widget panel. Toggle features, change accent/position, add `.aa-assist-launcher{border-radius:4px}` custom CSS, set a launcher label → the iframe preview updates.
2. Save. `curl -s localhost:7842/assist/<projectId>.js | head -1` shows `window.__AA_ASSIST_CONFIG__=…` with your values; header `cache-control: public, max-age=60`.
3. Embed `<script src="…/assist/<projectId>.js" defer></script>` on a scratch HTML page → the widget reflects the saved config.
4. Deploy with `scripts/deploy.sh` (builds web with the API base, rebuilds the widget bundle + server, syncs, restarts). Note: the server change (assist route now needs `db`) means a **server restart is required** — `deploy.sh` already restarts.

---

## Self-Review

**Spec coverage:** scope (behavior+brand+customCss) → Tasks 1,7,10; delivery (serve-time inlined per-project bundle) → Task 4; instant-live + max-age=60 → Task 4; `widget_configs` table → Task 2; defaults + unknown→defaults → Tasks 1,3,4; owner-only write + validation → Tasks 1,5; loader reads global + data-attr fallback → Task 6; brand/dark/launcher/customCss apply → Task 7; dashboard form + embed snippet → Task 10; live preview iframe → Task 11; custom-CSS sanitization (strip `@import`/`</style>`, cap, svg-only icon) → Task 1; i18n tr/en → Task 9; testing across server/widget/web → Tasks 2–11; deploy note → Task 12. No uncovered spec requirement.

**Type consistency:** `WidgetConfig`/`DEFAULT_WIDGET_CONFIG`/`normalizeWidgetConfig`/`WIDGET_CONFIG_GLOBAL`/`WIDGET_CONFIG_CSS_MAX_BYTES` defined in Task 1 and used verbatim in Tasks 3,4,6,7,8,11. Route paths `/api/workspaces/:workspaceSlug/projects/:projectId/widget-config` consistent across Tasks 5,8. Public route `/assist/:projectId.js` consistent across Tasks 4,11,12.

**Open items the implementer must confirm against real code (flagged inline, not placeholders):** exact `SqliteDatabase` export name; `requireWorkspaceMembership`/`requireWorkspaceOwner` signatures + return shape; `app.test.ts` auth/CSRF helper names; `widget.ts` variable names (`root`/`shadowRoot`/`launcher`) and how feature controls render (add `data-aa-feature`); `client.test.ts` fetch-mock helpers; page prop/routing convention (`members.tsx`). These are "match the existing pattern" confirmations, with the pattern's source file named in each task.
```
