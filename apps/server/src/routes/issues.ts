import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SqliteDatabase } from "../db/client.js";
import { issues } from "../db/schema.js";

const issueQuerySchema = z.object({
  projectId: z.string().optional(),
  scanRunId: z.string().optional()
});

type IssueRow = typeof issues.$inferSelect;
type IssueResponse = Omit<IssueRow, "sampleUrls"> & { sampleUrls: string[] };

export interface IssueRouteOptions {
  db: SqliteDatabase;
}

function parseSampleUrls(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((url): url is string => typeof url === "string");
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string") : [];
  } catch {
    return [];
  }
}

function mapIssueRow(row: IssueRow): IssueResponse {
  return {
    ...row,
    sampleUrls: parseSampleUrls(row.sampleUrls)
  };
}

export async function registerIssueRoutes(app: FastifyInstance, options: IssueRouteOptions): Promise<void> {
  const { db } = options;

  app.get("/api/issues", async (request, reply) => {
    const parsed = issueQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid issue query", issues: parsed.error.issues });
    }

    if (parsed.data.projectId === undefined && parsed.data.scanRunId === undefined) {
      return reply.code(400).send({ error: "Issue query requires a projectId or scanRunId filter" });
    }

    if (parsed.data.projectId !== undefined && parsed.data.scanRunId !== undefined) {
      return {
        data: db
          .select()
          .from(issues)
          .where(and(eq(issues.projectId, parsed.data.projectId), eq(issues.scanRunId, parsed.data.scanRunId)))
          .orderBy(desc(issues.occurrences))
          .all()
          .map(mapIssueRow)
      };
    }

    if (parsed.data.scanRunId !== undefined) {
      return {
        data: db
          .select()
          .from(issues)
          .where(eq(issues.scanRunId, parsed.data.scanRunId))
          .orderBy(desc(issues.occurrences))
          .all()
          .map(mapIssueRow)
      };
    }

    if (parsed.data.projectId !== undefined) {
      return {
        data: db
          .select()
          .from(issues)
          .where(eq(issues.projectId, parsed.data.projectId))
          .orderBy(desc(issues.occurrences))
          .all()
          .map(mapIssueRow)
      };
    }

  });

  app.get("/api/issues/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const issue = db.select().from(issues).where(eq(issues.id, id)).get();
    if (issue === undefined) {
      return reply.code(404).send({ error: "Issue not found" });
    }

    return mapIssueRow(issue);
  });
}
