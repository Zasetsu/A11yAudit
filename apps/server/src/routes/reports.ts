import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { StorageAdapter } from "@a11yaudit/storage";
import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import { getReportForWorkspace, listReportsForWorkspace } from "../repositories/reports.js";
import { requireWorkspaceMembership, workspaceParamsSchema } from "./workspace-access.js";

const reportQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

const reportParamsSchema = workspaceParamsSchema.extend({
  reportId: z.string().trim().min(1)
});

export interface ReportRouteOptions {
  db: SqliteDatabase;
  storage: StorageAdapter;
}

export async function registerReportRoutes(app: FastifyInstance, options: ReportRouteOptions): Promise<void> {
  const { db, storage } = options;

  app.get("/api/workspaces/:workspaceSlug/reports", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid workspace parameters", issues: params.error.issues });
    }

    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid report query", issues: parsed.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    return { data: await listReportsForWorkspace(db, context.workspaceId, parsed.data) };
  });

  app.get("/api/workspaces/:workspaceSlug/reports/:reportId/download", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return undefined;

    const params = reportParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid report parameters", issues: params.error.issues });
    }

    const context = await requireWorkspaceMembership(db, user.id, params.data.workspaceSlug, reply);
    if (!context) return undefined;

    const report = await getReportForWorkspace(db, context.workspaceId, params.data.reportId);
    if (!report) {
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
