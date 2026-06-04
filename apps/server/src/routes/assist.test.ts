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
  return { app: Fastify(), db: drizzle(sqlite) };
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

  it("still serves the shared bundle route", async () => {
    const { app, db } = buildApp();
    await registerAssistRoutes(app, { db });
    const res = await app.inject({ method: "GET", url: "/assist/a11yaudit-assist.js" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    await app.close();
  });
});
