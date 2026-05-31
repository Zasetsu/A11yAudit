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
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      created_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
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

    CREATE INDEX IF NOT EXISTS idx_projects_domain ON projects(domain);
    CREATE INDEX IF NOT EXISTS idx_scan_runs_project_created ON scan_runs(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_findings_scan_status ON findings(scan_run_id, status);
    CREATE INDEX IF NOT EXISTS idx_reports_scan_created ON reports(scan_run_id, created_at);
  `);

  addColumnIfMissing(sqlite, "scan_runs", "score", "INTEGER");
  addColumnIfMissing(sqlite, "scan_runs", "max_pages", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing(sqlite, "scan_runs", "max_depth", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(sqlite, "scan_runs", "viewports", "TEXT NOT NULL DEFAULT 'desktop,mobile'");
  addColumnIfMissing(sqlite, "findings", "viewport", "TEXT NOT NULL DEFAULT 'desktop'");
  addColumnIfMissing(sqlite, "findings", "certainty", "TEXT NOT NULL DEFAULT 'automatic_violation'");
  addColumnIfMissing(sqlite, "findings", "evidence", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(sqlite, "findings", "fingerprint", "TEXT NOT NULL DEFAULT ''");
}

function addColumnIfMissing(sqlite: Database.Database, table: string, column: string, definition: string): void {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((row) => row.name === column)) {
    return;
  }

  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
