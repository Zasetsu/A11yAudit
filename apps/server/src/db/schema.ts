import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  createdAt: text("created_at").notNull()
});

export const scanRuns = sqliteTable("scan_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  status: text("status").notNull(),
  mode: text("mode").notNull(),
  maxPages: integer("max_pages").notNull().default(10),
  maxDepth: integer("max_depth").notNull().default(1),
  viewports: text("viewports").notNull().default("desktop,mobile"),
  pagesQueued: integer("pages_queued").notNull().default(0),
  pagesScanned: integer("pages_scanned").notNull().default(0),
  findingsTotal: integer("findings_total").notNull().default(0),
  score: integer("score"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  errorMessage: text("error_message")
});

export const findings = sqliteTable("findings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id")
    .notNull()
    .references(() => scanRuns.id, { onDelete: "cascade" }),
  pageUrl: text("page_url").notNull(),
  ruleId: text("rule_id").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  viewport: text("viewport").notNull().default("desktop"),
  certainty: text("certainty").notNull().default("automatic_violation"),
  wcagCriteria: text("wcag_criteria").notNull(),
  selector: text("selector"),
  description: text("description"),
  helpUrl: text("help_url"),
  evidence: text("evidence").notNull().default("[]"),
  fingerprint: text("fingerprint").notNull().default(""),
  instances: integer("instances").notNull().default(1),
  createdAt: text("created_at").notNull()
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id")
    .notNull()
    .references(() => scanRuns.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  artifactKey: text("artifact_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull()
});
