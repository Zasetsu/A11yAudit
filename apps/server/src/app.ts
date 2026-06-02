import { pathToFileURL } from "node:url";
import { runScan } from "@a11yaudit/audit";
import { aggregateScanIssues } from "@a11yaudit/core";
import { LocalStorageAdapter } from "@a11yaudit/storage";
import { eq, inArray } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { getTrustedBrowserOrigin, readAuthFromRequest, validateCsrf } from "./auth/session.js";
import { createDb, initializeDb, type DbClient } from "./db/client.js";
import { findings, issues, reports, scanRuns } from "./db/schema.js";
import { LocalJobRunner } from "./jobs/local-job-runner.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerFindingRoutes } from "./routes/findings.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerIssueRoutes } from "./routes/issues.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerScanRoutes, type ScanJobPayload } from "./routes/scans.js";

export interface BuildServerOptions {
  dbPath?: string;
  dbClient?: DbClient;
  logger?: boolean;
  storageRoot?: string;
  executeScans?: boolean;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function shouldSkipCsrf(requestUrl: string): boolean {
  const pathname = requestUrl.startsWith("http") ? new URL(requestUrl).pathname : requestUrl.split("?")[0];
  return pathname === "/health"
    || pathname === "/api/auth/login"
    || pathname === "/api/auth/signup";
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const dbClient = options.dbClient ?? createDb(options.dbPath);
  const ownsDbClient = options.dbClient === undefined;
  const storage = new LocalStorageAdapter({ rootDir: options.storageRoot ?? ".a11yaudit/artifacts" });
  const runner = new LocalJobRunner<ScanJobPayload>({
    execute: options.executeScans === false
      ? undefined
      : async (job) => {
        try {
          const result = await runScan({
            request: {
              runId: job.id,
              projectId: job.payload.projectId,
              targetUrl: job.payload.url,
              mode: job.payload.mode,
              viewports: job.payload.viewports,
              maxPages: job.payload.maxPages,
              maxDepth: job.payload.maxDepth,
              respectRobotsTxt: true
            },
            storage,
            onProgress: (event) => {
              dbClient.db
                .update(scanRuns)
                .set({
                  status: event.status,
                  pagesQueued: event.pagesQueued,
                  pagesScanned: event.pagesScanned,
                  findingsTotal: event.findingsTotal,
                  startedAt: new Date().toISOString()
                })
                .where(eq(scanRuns.id, job.id))
                .run();
            }
          });

          const completedAt = result.finishedAt;
          dbClient.db.transaction((tx) => {
            const projectId = result.projectId ?? job.payload.projectId;
            const issueIdByFingerprint = new Map<string, string>();

            if (result.findings.length > 0) {
              const issueRows = aggregateScanIssues(result.findings, { auditedPages: result.pages }).map((issue) => {
                const issueId = `${result.runId}-${issue.id}`;

                for (const fingerprint of issue.occurrenceFingerprints) {
                  if (fingerprint) {
                    issueIdByFingerprint.set(fingerprint, issueId);
                  }
                }

                return {
                  id: issueId,
                  projectId,
                  scanRunId: result.runId,
                  issueKey: issue.issueKey,
                  title: issue.title,
                  severity: issue.severity,
                  source: issue.source,
                  certainty: issue.certainty,
                  ruleId: issue.ruleId,
                  wcagCriteria: issue.wcagCriteria.join(","),
                  description: issue.description,
                  recommendation: issue.recommendation,
                  likelyScope: issue.likelyScope,
                  urlScopeGroup: issue.urlScopeGroup,
                  componentArea: issue.componentArea,
                  cmsHint: issue.cmsHint,
                  confidence: issue.confidence,
                  affectedPages: issue.affectedPages,
                  occurrences: issue.occurrences,
                  viewportSummary: issue.viewportSummary,
                  representativeUrl: issue.representativeUrl,
                  representativeSelector: issue.representativeSelector,
                  representativeHtmlSnippet: issue.representativeHtmlSnippet,
                  sampleUrls: JSON.stringify(issue.sampleUrls),
                  createdAt: completedAt
                };
              });

              for (const chunk of chunkArray(issueRows, 200)) {
                tx.insert(issues).values(chunk).run();
              }
            }

            if (result.findings.length > 0) {
              const findingRows = result.findings.map((finding) => ({
                id: `${result.runId}-${finding.id}`,
                projectId,
                scanRunId: result.runId,
                issueId: issueIdByFingerprint.get(finding.fingerprint) ?? null,
                pageUrl: finding.pageUrl,
                ruleId: finding.ruleId,
                title: finding.title,
                severity: finding.severity,
                status: finding.status,
                viewport: finding.viewport,
                certainty: finding.certainty,
                wcagCriteria: finding.wcagCriteria.join(","),
                selector: finding.selector,
                description: finding.description,
                helpUrl: finding.helpUrl,
                evidence: JSON.stringify(finding.evidence),
                fingerprint: finding.fingerprint,
                instances: finding.instances,
                createdAt: completedAt
              }));

              for (const chunk of chunkArray(findingRows, 200)) {
                tx.insert(findings).values(chunk).run();
              }
            }

            if (result.reports.length > 0) {
              tx
                .insert(reports)
                .values(result.reports.map((report) => ({
                  id: `report-${nanoid(10)}`,
                  projectId,
                  scanRunId: result.runId,
                  kind: report.kind,
                  artifactKey: report.artifactKey,
                  mimeType: report.mimeType,
                  sizeBytes: report.sizeBytes,
                  createdAt: completedAt
                })))
                .run();
            }

            tx
              .update(scanRuns)
              .set({
                status: "completed",
                pagesQueued: result.pages.length,
                pagesScanned: result.pages.length,
                findingsTotal: result.findings.length,
                score: result.score,
                startedAt: result.startedAt,
                finishedAt: completedAt,
                errorMessage: result.reportWarnings?.length ? result.reportWarnings.join("\n") : null
              })
              .where(eq(scanRuns.id, job.id))
              .run();
          });
        } catch (error) {
          dbClient.db
            .update(scanRuns)
            .set({
              status: "failed",
              errorMessage: error instanceof Error ? error.message : String(error),
              finishedAt: new Date().toISOString()
            })
            .where(eq(scanRuns.id, job.id))
            .run();
          throw error;
        }
      }
  });

  initializeDb(dbClient.sqlite);
  markInterruptedScansFailed(dbClient);
  const trustedBrowserOrigin = getTrustedBrowserOrigin();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", trustedBrowserOrigin);
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type,Accept,X-CSRF-Token");
    reply.header("Access-Control-Allow-Credentials", "true");

    request.auth = readAuthFromRequest(dbClient.db, request);

    if (shouldSkipCsrf(request.url)) {
      return;
    }

    const csrf = validateCsrf(dbClient.db, request, { trustedBrowserOrigin });
    if (!csrf.valid) {
      await reply.code(csrf.statusCode).send({ error: csrf.error });
    }
  });

  app.options("/*", async (_request, reply) => reply.code(204).send());

  app.addHook("onClose", async () => {
    await runner.waitForIdle();
    if (ownsDbClient) {
      dbClient.close();
    }
  });

  app.get("/health", async () => ({
    ok: true,
    name: "A11yAudit",
    version: "0.1.0"
  }));

  await registerAuthRoutes(app, { db: dbClient.db });
  await registerProjectRoutes(app, { db: dbClient.db });
  await registerScanRoutes(app, { db: dbClient.db, runner });
  await registerFindingRoutes(app, { db: dbClient.db });
  await registerIssueRoutes(app, { db: dbClient.db });
  await registerReportRoutes(app, { db: dbClient.db, storage });
  await registerArtifactRoutes(app, { db: dbClient.db, storage });

  return app;
}

function markInterruptedScansFailed(dbClient: DbClient): void {
  dbClient.db
    .update(scanRuns)
    .set({
      status: "failed",
      errorMessage: "Scan interrupted before completion",
      finishedAt: new Date().toISOString()
    })
    .where(inArray(scanRuns.status, ["queued", "crawling", "auditing", "reporting"]))
    .run();
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (import.meta.url === entryPoint) {
  const app = await buildServer({ logger: true });
  await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 7842) });
}
