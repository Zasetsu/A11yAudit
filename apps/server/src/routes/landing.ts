import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply } from "fastify";

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

/**
 * Resolve the built dashboard SPA root (`apps/web/dist`) by walking up from this
 * module's directory until we find the nearest ancestor whose
 * `apps/web/dist/index.html` exists. Mirrors {@link findLandingRoot}; anchoring
 * on `import.meta.url` keeps resolution stable across `src` (tsx) / `dist`
 * (built) / test-runner working directories.
 *
 * Returns `null` when the web app has not been built.
 */
function findWebDist(): string | null {
  let dir = HERE;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "apps/web/dist");
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Serve the built dashboard SPA (`apps/web/dist`) under `/app/` with client-route
 * fallback:
 *  - real assets (`/app/assets/*`, `/app/favicon.svg`, …) stream from disk with
 *    the correct content-type;
 *  - `/app` and extensionless client routes (`/app/login`, `/app/w/x/scan-runs`)
 *    return the SPA `index.html` so the client router renders them;
 *  - missing files with an extension (`/app/missing.js`) return 404.
 *
 * The `@fastify/static` registration uses `decorateReply: false` because the
 * landing registration (run first, in the same Fastify instance) already added
 * the `reply.sendFile` decorator — registering it twice with the default `true`
 * throws "reply.sendFile already added". `wildcard: false` makes the static
 * plugin register one route per real file instead of a `/app/*` catch-all, which
 * leaves the explicit `/app/*` GET below free to own the SPA fallback.
 */
async function registerWebAppRoutes(server: FastifyInstance): Promise<void> {
  const webDist = findWebDist();
  if (webDist === null) {
    // Web app not built — answer /app routes with 404 rather than crashing.
    server.get("/app", async (_req, reply) => reply.code(404).send({ error: "web app not built" }));
    server.get("/app/*", async (_req, reply) => reply.code(404).send({ error: "web app not built" }));
    return;
  }

  await server.register(fastifyStatic, {
    root: webDist,
    prefix: "/app/",
    index: false,
    wildcard: false,
    decorateReply: false
  });

  const indexHtml = path.join(webDist, "index.html");
  const sendShell = async (reply: FastifyReply): Promise<void> => {
    reply.type("text/html; charset=utf-8").send(await readFile(indexHtml));
  };

  server.get("/app", async (_req, reply) => sendShell(reply));
  server.get("/app/*", async (req, reply) => {
    // Requests with a file extension that reached this handler are missing
    // assets (the static plugin already claimed every real file) → 404.
    // Extensionless paths are client routes → serve the SPA shell.
    const rel = req.url.replace(/^\/app\//, "").split("?")[0];
    if (/\.[a-zA-Z0-9]+$/.test(rel)) {
      reply.code(404).send({ error: "not found" });
      return;
    }
    await sendShell(reply);
  });
}

export async function registerLandingRoutes(server: FastifyInstance): Promise<void> {
  // Register the dashboard SPA at `/app` BEFORE the `/` landing static. Both are
  // `@fastify/static` registrations on the same instance; the `/app` one passes
  // `decorateReply: false` so only the landing registration adds `sendFile`.
  await registerWebAppRoutes(server);

  const root = findLandingRoot();
  if (root === null) {
    server.get("/", async (_req, reply) => reply.code(404).send({ error: "landing not built" }));
    return;
  }

  // `wildcard: false` registers one route per file/dir (e.g. `/`, `/index.html`,
  // `/landing/*`, `/assist/*`) instead of a single `/*` catch-all,
  // so the static plugin never shadows `/api`, `/assist`, `/health`, or `/app`.
  await server.register(fastifyStatic, {
    root,
    prefix: "/",
    index: ["index.html"],
    wildcard: false,
    // The landing HTML always revalidates so it points at the current asset
    // versions; CSS/JS are version-busted via `?v=<hash>` and also revalidate
    // (cheap 304) so an edit is never served stale. Images cache for a day.
    setHeaders: (res, filePath) => {
      if (/\.(html|css|js)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    }
  });
}
