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
  return { db: drizzle(sqlite), sqlite };
}

describe("widget-config repository", () => {
  let db: ReturnType<typeof setup>["db"];
  let sqlite: ReturnType<typeof setup>["sqlite"];
  beforeEach(() => { ({ db, sqlite } = setup()); });

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

  it("upsert is idempotent and overwrites the prior row", () => {
    upsertWidgetConfigForWorkspaceProject(db, "acme", "p", { position: "top-left" });
    upsertWidgetConfigForWorkspaceProject(db, "acme", "p", { position: "bottom-left" });
    expect(getWidgetConfig(db, "p").position).toBe("bottom-left");
  });

  it("upsert throws when the project is not in the workspace", () => {
    expect(() => upsertWidgetConfigForWorkspaceProject(db, "other-slug", "p", {})).toThrow();
  });

  it("getWidgetConfigForWorkspaceProject throws when project not in workspace", () => {
    expect(() => getWidgetConfigForWorkspaceProject(db, "other-slug", "p")).toThrow();
  });

  it("getWidgetConfig returns defaults when the stored JSON is malformed", () => {
    upsertWidgetConfigForWorkspaceProject(db, "acme", "p", {});
    sqlite.prepare("UPDATE widget_configs SET config='{bad' WHERE project_id='p'").run();
    expect(getWidgetConfig(db, "p")).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});
