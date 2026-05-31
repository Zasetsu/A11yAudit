import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { StorageAdapter } from "@a11yaudit/storage";
import type { SqliteDatabase } from "../db/client.js";
import { findings, reports } from "../db/schema.js";

const artifactQuerySchema = z.object({
  key: z.string().trim().min(1)
});

interface EvidenceArtifactRow {
  artifactKey?: unknown;
}

export interface ArtifactRouteOptions {
  db: SqliteDatabase;
  storage: StorageAdapter;
}

function evidenceReferencesKey(evidence: string, key: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(evidence);
  } catch {
    return false;
  }

  if (!Array.isArray(parsed)) return false;

  return parsed.some((item: unknown) => {
    if (item === null || typeof item !== "object") return false;
    return (item as EvidenceArtifactRow).artifactKey === key;
  });
}

function isReferencedArtifact(db: SqliteDatabase, key: string): boolean {
  const report = db.select({ id: reports.id }).from(reports).where(eq(reports.artifactKey, key)).get();
  if (report !== undefined) return true;

  return db
    .select({ evidence: findings.evidence })
    .from(findings)
    .all()
    .some((row) => evidenceReferencesKey(row.evidence, key));
}

export async function registerArtifactRoutes(app: FastifyInstance, options: ArtifactRouteOptions): Promise<void> {
  const { db, storage } = options;

  app.get("/api/artifacts/download", async (request, reply) => {
    const parsed = artifactQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid artifact query", issues: parsed.error.issues });
    }

    const key = parsed.data.key;
    if (!isReferencedArtifact(db, key)) {
      return reply.code(404).send({ error: "Artifact not found" });
    }

    let body: Buffer;
    try {
      body = await storage.get(key);
    } catch {
      return reply.code(404).send({ error: "Artifact not found" });
    }

    const mimeType = key.endsWith(".png") ? "image/png" : key.endsWith(".txt") ? "text/plain; charset=utf-8" : "application/octet-stream";
    return reply
      .header("content-type", mimeType)
      .header("content-length", body.byteLength)
      .send(body);
  });
}
