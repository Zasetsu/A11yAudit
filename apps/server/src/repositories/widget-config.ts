import { and, eq } from "drizzle-orm";
import { DEFAULT_WIDGET_CONFIG, normalizeWidgetConfig, type WidgetConfig } from "@a11yaudit/assist-widget";
import type { SqliteDatabase } from "../db/client.js";
import { projects, widgetConfigs, workspaces } from "../db/schema.js";

/** Public read: config for a project id, or defaults when absent/malformed. Not workspace-scoped (used by the public bundle route). */
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
  const serialized = JSON.stringify(config);
  db.insert(widgetConfigs)
    .values({ projectId, config: serialized, updatedAt: now })
    .onConflictDoUpdate({ target: widgetConfigs.projectId, set: { config: serialized, updatedAt: now } })
    .run();
  return config;
}
