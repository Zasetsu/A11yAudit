import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type SqliteDatabase = ReturnType<typeof createDb>["db"];

export interface DbClient {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
  close: () => void;
}

function isMemoryDatabase(path: string): boolean {
  return path === ":memory:" || path.startsWith("file::memory:");
}

export function createDb(path = ".a11yaudit/a11yaudit.db"): DbClient {
  const fileBacked = !isMemoryDatabase(path);

  if (fileBacked) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");

  if (fileBacked) {
    sqlite.pragma("journal_mode = WAL");
  }

  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
    close: () => sqlite.close()
  };
}

export function initializeDb(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default-workspace' REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO workspaces (id, name, slug, created_at)
    VALUES ('default-workspace', 'Default Workspace', 'default-workspace', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      revoked_at TEXT,
      invited_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS scan_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      max_pages INTEGER NOT NULL DEFAULT 10,
      max_depth INTEGER NOT NULL DEFAULT 1,
      viewports TEXT NOT NULL DEFAULT 'desktop,mobile',
      pages_queued INTEGER NOT NULL DEFAULT 0,
      pages_scanned INTEGER NOT NULL DEFAULT 0,
      findings_total INTEGER NOT NULL DEFAULT 0,
      score INTEGER,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
      issue_key TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      source TEXT NOT NULL,
      certainty TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      wcag_criteria TEXT NOT NULL,
      description TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      likely_scope TEXT NOT NULL,
      url_scope_group TEXT NOT NULL,
      component_area TEXT NOT NULL,
      cms_hint TEXT NOT NULL,
      confidence TEXT NOT NULL,
      affected_pages INTEGER NOT NULL,
      occurrences INTEGER NOT NULL,
      viewport_summary TEXT NOT NULL,
      representative_url TEXT NOT NULL,
      representative_selector TEXT,
      representative_html_snippet TEXT,
      sample_urls TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
      issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
      page_url TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      viewport TEXT NOT NULL DEFAULT 'desktop',
      certainty TEXT NOT NULL DEFAULT 'automatic_violation',
      wcag_criteria TEXT NOT NULL,
      selector TEXT,
      description TEXT,
      help_url TEXT,
      evidence TEXT NOT NULL DEFAULT '[]',
      fingerprint TEXT NOT NULL DEFAULT '',
      instances INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      artifact_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_artifacts (
      id TEXT PRIMARY KEY,
      artifact_key TEXT NOT NULL,
      finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_domain ON projects(domain);
    CREATE UNIQUE INDEX IF NOT EXISTS projects_workspace_domain_unique ON projects(workspace_id, domain);
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_unique ON workspace_members(workspace_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_scan_runs_project_created ON scan_runs(project_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS scan_runs_active_project_unique
      ON scan_runs(project_id)
      WHERE status IN ('queued', 'crawling', 'auditing', 'reporting');
    CREATE INDEX IF NOT EXISTS idx_issues_scan_severity ON issues(scan_run_id, severity);
    CREATE INDEX IF NOT EXISTS idx_issues_project_created ON issues(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_findings_scan_status ON findings(scan_run_id, status);
    CREATE INDEX IF NOT EXISTS idx_reports_scan_created ON reports(scan_run_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_key ON evidence_artifacts(artifact_key);
  `);
}
