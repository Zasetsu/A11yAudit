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
