import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { StorageAdapter } from "@a11yaudit/storage";
import type { SqliteDatabase } from "../db/client.js";
import { projects, reports } from "../db/schema.js";

const reportQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

export interface ReportRouteOptions {
  db: SqliteDatabase;
  storage: StorageAdapter;
}

export async function registerReportRoutes(app: FastifyInstance, options: ReportRouteOptions): Promise<void> {
  const { db, storage } = options;

  app.get("/api/reports", async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid report query", issues: parsed.error.issues });
    }

    if (parsed.data.scanRunId !== undefined) {
      return {
        data: db
          .select({
            id: reports.id,
            projectId: reports.projectId,
            projectName: projects.name,
            scanRunId: reports.scanRunId,
            kind: reports.kind,
            artifactKey: reports.artifactKey,
            mimeType: reports.mimeType,
            sizeBytes: reports.sizeBytes,
            createdAt: reports.createdAt
          })
          .from(reports)
          .leftJoin(projects, eq(reports.projectId, projects.id))
          .where(eq(reports.scanRunId, parsed.data.scanRunId))
          .orderBy(desc(reports.createdAt))
          .all()
      };
    }

    if (parsed.data.projectId !== undefined) {
      return {
        data: db
          .select({
            id: reports.id,
            projectId: reports.projectId,
            projectName: projects.name,
            scanRunId: reports.scanRunId,
            kind: reports.kind,
            artifactKey: reports.artifactKey,
            mimeType: reports.mimeType,
            sizeBytes: reports.sizeBytes,
            createdAt: reports.createdAt
          })
          .from(reports)
          .leftJoin(projects, eq(reports.projectId, projects.id))
          .where(eq(reports.projectId, parsed.data.projectId))
          .orderBy(desc(reports.createdAt))
          .all()
      };
    }

    return {
      data: db
        .select({
          id: reports.id,
          projectId: reports.projectId,
          projectName: projects.name,
          scanRunId: reports.scanRunId,
          kind: reports.kind,
          artifactKey: reports.artifactKey,
          mimeType: reports.mimeType,
          sizeBytes: reports.sizeBytes,
          createdAt: reports.createdAt
        })
        .from(reports)
        .leftJoin(projects, eq(reports.projectId, projects.id))
        .orderBy(desc(reports.createdAt))
        .all()
    };
  });

  app.get("/api/reports/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = db.select().from(reports).where(eq(reports.id, id)).get();
    if (report === undefined) {
      return reply.code(404).send({ error: "Report not found" });
    }

    let body: Buffer;
    try {
      body = await storage.get(report.artifactKey);
    } catch {
      return reply.code(404).send({ error: "Report artifact not found" });
    }

    return reply
      .header("content-type", report.mimeType)
      .header("content-length", body.byteLength)
      .send(body);
  });
}
