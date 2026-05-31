import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SqliteDatabase } from "../db/client.js";
import { findings } from "../db/schema.js";

const findingQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

export interface FindingRouteOptions {
  db: SqliteDatabase;
}

export async function registerFindingRoutes(app: FastifyInstance, options: FindingRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/findings", async (request, reply) => {
    const parsed = findingQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid finding query", issues: parsed.error.issues });
    }

    if (parsed.data.scanRunId !== undefined) {
      return {
        data: db.select().from(findings).where(eq(findings.scanRunId, parsed.data.scanRunId)).orderBy(desc(findings.createdAt)).all()
      };
    }

    if (parsed.data.projectId !== undefined) {
      return {
        data: db.select().from(findings).where(eq(findings.projectId, parsed.data.projectId)).orderBy(desc(findings.createdAt)).all()
      };
    }

    return { data: db.select().from(findings).orderBy(desc(findings.createdAt)).all() };
  });
}
