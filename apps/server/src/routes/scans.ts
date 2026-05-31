import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { assertSafeUrl } from "@a11yaudit/crawler";
import { DEFAULT_VIEWPORTS } from "@a11yaudit/core";
import type { SqliteDatabase } from "../db/client.js";
import { projects, scanRuns } from "../db/schema.js";
import type { LocalJobRunner } from "../jobs/local-job-runner.js";

const scanPayloadSchema = z.object({
  projectId: z.string().trim().min(1),
  url: z.string().trim().min(1),
  mode: z.enum(["single_url", "same_domain_crawl"]).default("single_url"),
  maxPages: z.number().int().min(1).max(250).default(10),
  maxDepth: z.number().int().min(0).max(5).default(1),
  viewports: z.array(z.enum(["desktop", "mobile"])).min(1).default(["desktop", "mobile"])
});

export interface ScanJobPayload {
  projectId: string;
  url: string;
  mode: "single_url" | "same_domain_crawl";
  maxPages: number;
  maxDepth: number;
  viewports: typeof DEFAULT_VIEWPORTS;
}

export interface ScanRouteOptions {
  db: SqliteDatabase;
  runner: LocalJobRunner<ScanJobPayload>;
}

function parseAuditUrl(input: string): string {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Scan URL must use http or https");
  }

  assertSafeUrl(url.href);

  return url.href;
}

function resolveViewports(names: z.infer<typeof scanPayloadSchema>["viewports"]): typeof DEFAULT_VIEWPORTS {
  return names.map((name) => {
    const viewport = DEFAULT_VIEWPORTS.find((candidate) => candidate.name === name);
    if (viewport === undefined) {
      throw new Error(`Unknown viewport: ${name}`);
    }

    return viewport;
  });
}

export async function registerScanRoutes(app: FastifyInstance, options: ScanRouteOptions): Promise<void> {
  const { db, runner } = options;

  app.get("/api/scans", async () => ({
    data: db
      .select({
        id: scanRuns.id,
        projectId: scanRuns.projectId,
        projectName: projects.name,
        url: scanRuns.url,
        status: scanRuns.status,
        mode: scanRuns.mode,
        maxPages: scanRuns.maxPages,
        maxDepth: scanRuns.maxDepth,
        viewports: scanRuns.viewports,
        pagesQueued: scanRuns.pagesQueued,
        pagesScanned: scanRuns.pagesScanned,
        findingsTotal: scanRuns.findingsTotal,
        score: scanRuns.score,
        createdAt: scanRuns.createdAt,
        startedAt: scanRuns.startedAt,
        finishedAt: scanRuns.finishedAt,
        errorMessage: scanRuns.errorMessage
      })
      .from(scanRuns)
      .leftJoin(projects, eq(scanRuns.projectId, projects.id))
      .orderBy(desc(scanRuns.createdAt))
      .all()
  }));

  app.post("/api/scans", async (request, reply) => {
    const parsed = scanPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid scan payload", issues: parsed.error.issues });
    }

    let url: string;
    try {
      url = parseAuditUrl(parsed.data.url);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid scan URL" });
    }

    const project = db.select().from(projects).where(eq(projects.id, parsed.data.projectId)).get();
    if (project === undefined) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const now = new Date().toISOString();
    const row = {
      id: `run-${nanoid(10)}`,
      projectId: parsed.data.projectId,
      url,
      status: "queued",
      mode: parsed.data.mode,
      maxPages: parsed.data.maxPages,
      maxDepth: parsed.data.maxDepth,
      viewports: parsed.data.viewports.join(","),
      pagesQueued: 0,
      pagesScanned: 0,
      findingsTotal: 0,
      score: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      errorMessage: null
    };

    db.insert(scanRuns).values(row).run();
    runner.enqueue(row.id, {
      projectId: row.projectId,
      url: row.url,
      mode: parsed.data.mode,
      maxPages: parsed.data.maxPages,
      maxDepth: parsed.data.maxDepth,
      viewports: resolveViewports(parsed.data.viewports)
    });

    return reply.code(201).send(row);
  });
}
