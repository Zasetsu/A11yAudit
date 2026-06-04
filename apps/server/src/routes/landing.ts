import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the static landing site root (`apps/landing`) by walking up from this
 * module's directory until we find the nearest ancestor that contains
 * `apps/landing/index.html`.
 *
 * Anchoring on `import.meta.url` (not the process cwd) keeps resolution stable
 * whether the server runs from `src` (tsx, dev), `dist` (built, prod), or a test
 * runner with an arbitrary working directory.
 */
function findLandingRoot(): string | null {
  let dir = HERE;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "apps/landing");
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function registerLandingRoutes(server: FastifyInstance): Promise<void> {
  const root = findLandingRoot();
  if (root === null) {
    server.get("/", async (_req, reply) => reply.code(404).send({ error: "landing not built" }));
    return;
  }

  // `wildcard: false` registers one route per file/dir (e.g. `/`, `/index.html`,
  // `/landing/*`, `/assets/*`, `/demo/*`) instead of a single `/*` catch-all,
  // so the static plugin never shadows `/api`, `/assist`, `/health`, or `/app`.
  await server.register(fastifyStatic, {
    root,
    prefix: "/",
    index: ["index.html"],
    wildcard: false
  });
}
