import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull()
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull()
});

export const workspaceMembers = sqliteTable("workspace_members", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull(),
  createdAt: text("created_at").notNull()
}, (table) => ({
  workspaceUserUnique: uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId)
}));

export const workspaceInvitations = sqliteTable("workspace_invitations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["member"] }).notNull().default("member"),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  revokedAt: text("revoked_at"),
  invitedByUserId: text("invited_by_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull()
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  csrfTokenHash: text("csrf_token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  revokedAt: text("revoked_at")
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().default("default-workspace").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  createdAt: text("created_at").notNull()
}, (table) => ({
  workspaceDomainUnique: uniqueIndex("projects_workspace_domain_unique").on(table.workspaceId, table.domain)
}));

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

export const issues = sqliteTable("issues", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id")
    .notNull()
    .references(() => scanRuns.id, { onDelete: "cascade" }),
  issueKey: text("issue_key").notNull(),
  status: text("status").notNull().default("new"),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  source: text("source").notNull(),
  certainty: text("certainty").notNull(),
  ruleId: text("rule_id").notNull(),
  wcagCriteria: text("wcag_criteria").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
  likelyScope: text("likely_scope").notNull(),
  urlScopeGroup: text("url_scope_group").notNull(),
  componentArea: text("component_area").notNull(),
  cmsHint: text("cms_hint").notNull(),
  confidence: text("confidence").notNull(),
  affectedPages: integer("affected_pages").notNull(),
  occurrences: integer("occurrences").notNull(),
  viewportSummary: text("viewport_summary").notNull(),
  representativeUrl: text("representative_url").notNull(),
  representativeSelector: text("representative_selector"),
  representativeHtmlSnippet: text("representative_html_snippet"),
  sampleUrls: text("sample_urls").notNull(),
  createdAt: text("created_at").notNull()
});

export const findings = sqliteTable("findings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id")
    .notNull()
    .references(() => scanRuns.id, { onDelete: "cascade" }),
  issueId: text("issue_id").references(() => issues.id, { onDelete: "set null" }),
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

export const evidenceArtifacts = sqliteTable("evidence_artifacts", {
  id: text("id").primaryKey(),
  artifactKey: text("artifact_key").notNull(),
  findingId: text("finding_id").notNull().references(() => findings.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scanRunId: text("scan_run_id").notNull().references(() => scanRuns.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull()
}, (table) => ({
  artifactKeyIndex: index("idx_evidence_artifacts_key").on(table.artifactKey)
}));
