import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { assertSafeUrl } from "@a11yaudit/crawler";
import type { SqliteDatabase } from "../db/client.js";
import { findings, projects, reports, scanRuns } from "../db/schema.js";

const projectPayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
    domain: z.string().trim().min(1).optional()
  })
  .refine((payload) => payload.url !== undefined || payload.domain !== undefined, {
    message: "url or domain is required"
  });

function assertSafeTarget(url: string): void {
  assertSafeUrl(url);
}

function parseProjectTarget(payload: z.infer<typeof projectPayloadSchema>): { url: string; domain: string } {
  if (payload.url !== undefined) {
    const url = new URL(payload.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Project URL must use http or https");
    }
    assertSafeTarget(url.href);
    return { url: url.href, domain: url.hostname };
  }

  const url = new URL(`https://${payload.domain}`);
  if (!url.hostname.includes(".")) {
    throw new Error("Project domain must be a valid hostname");
  }
  assertSafeTarget(url.href);
  return { url: url.href, domain: url.hostname };
}

export interface ProjectRouteOptions {
  db: SqliteDatabase;
}

export async function registerProjectRoutes(app: FastifyInstance, options: ProjectRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/projects", async () => {
    const rows = db
      .select({
        id: projects.id,
        name: projects.name,
        url: projects.url,
        domain: projects.domain,
        createdAt: projects.createdAt,
        score: sql<number | null>`(
          select ${scanRuns.score}
          from ${scanRuns}
          where ${scanRuns.projectId} = ${projects.id} and ${scanRuns.score} is not null
          order by ${scanRuns.createdAt} desc
          limit 1
        )`,
        openFindings: sql<number>`count(distinct case when ${findings.status} != 'resolved' then ${findings.id} end)`,
        reports: sql<number>`count(distinct ${reports.id})`,
        lastScan: sql<string | null>`max(${scanRuns.createdAt})`,
        crawlLimit: sql<number | null>`(
          select ${scanRuns.maxPages}
          from ${scanRuns}
          where ${scanRuns.projectId} = ${projects.id}
          order by ${scanRuns.createdAt} desc
          limit 1
        )`,
        viewports: sql<string | null>`(
          select ${scanRuns.viewports}
          from ${scanRuns}
          where ${scanRuns.projectId} = ${projects.id}
          order by ${scanRuns.createdAt} desc
          limit 1
        )`
      })
      .from(projects)
      .leftJoin(scanRuns, eq(scanRuns.projectId, projects.id))
      .leftJoin(findings, eq(findings.projectId, projects.id))
      .leftJoin(reports, eq(reports.projectId, projects.id))
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt))
      .all();

    return { data: rows };
  });

  app.post("/api/projects", async (request, reply) => {
    const parsed = projectPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid project payload", issues: parsed.error.issues });
    }

    let target: { url: string; domain: string };
    try {
      target = parseProjectTarget(parsed.data);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid project target" });
    }

    const now = new Date().toISOString();
    const row = {
      id: `proj-${nanoid(10)}`,
      name: parsed.data.name ?? target.domain,
      url: target.url,
      domain: target.domain,
      createdAt: now
    };

    db.insert(projects).values(row).run();

    return reply.code(201).send({ ...row, openFindings: 0, lastScan: null });
  });
}
