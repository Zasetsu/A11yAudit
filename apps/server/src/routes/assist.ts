import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { SqliteDatabase } from "../db/client.js";
import { getWidgetConfig } from "../repositories/widget-config.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_RELATIVE = "packages/assist-widget/dist/a11yaudit-assist.js";

/**
 * Resolve the built assist-widget bundle by walking up from this module's
 * directory until we find the nearest ancestor that contains
 * `packages/assist-widget/dist/a11yaudit-assist.js`.
 *
 * This works identically whether the server runs from `src` (tsx, dev) or
 * `dist` (built, prod) since both live under the same repo root and the
 * search anchors on the bundle location, not a fixed relative depth.
 *
 * Returns `undefined` when the bundle is not built.
 */
function resolveBundlePath(): string | undefined {
  let dir = HERE;
  for (let i = 0; i < 12; i += 1) {
    const candidate = path.join(dir, BUNDLE_RELATIVE);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

async function serveAsset(
  resolvePath: () => string | undefined,
  suffix: string,
  contentType: string,
  reply: FastifyReply
): Promise<void> {
  const base = resolvePath();
  const file = base === undefined ? undefined : `${base}${suffix}`;

  if (file === undefined) {
    reply.code(404).send({ error: "assist widget bundle not built" });
    return;
  }

  try {
    const body = await readFile(file);
    reply
      .header("content-type", contentType)
      .header("access-control-allow-origin", "*")
      .header("access-control-allow-credentials", "false")
      .header("cache-control", "public, max-age=3600")
      .send(body);
  } catch {
    reply.code(404).send({ error: "assist widget bundle not built" });
  }
}

export interface AssistRouteOptions {
  db: SqliteDatabase;
}

export async function registerAssistRoutes(server: FastifyInstance, options: AssistRouteOptions): Promise<void> {
  const { db } = options;

  server.get("/assist/a11yaudit-assist.js", async (_request, reply) =>
    serveAsset(resolveBundlePath, "", "text/javascript; charset=utf-8", reply)
  );

  server.get("/assist/a11yaudit-assist.js.map", async (_request, reply) =>
    serveAsset(resolveBundlePath, ".map", "application/json; charset=utf-8", reply)
  );

  // Per-project bundle: inline config prelude + the shared bundle bytes.
  server.get<{ Params: { projectId: string } }>("/assist/:projectId.js", async (request, reply) => {
    const { projectId } = request.params;
    if (projectId === "a11yaudit-assist") {
      return serveAsset(resolveBundlePath, "", "text/javascript; charset=utf-8", reply);
    }

    const bundlePath = resolveBundlePath();
    if (bundlePath === undefined) {
      return reply.code(404).send({ error: "assist widget bundle not built" });
    }

    const config = getWidgetConfig(db, projectId);
    const prelude = `window.__AA_ASSIST_CONFIG__=${JSON.stringify(config)};\n`;

    try {
      const bundle = await readFile(bundlePath, "utf8");
      return reply
        .header("content-type", "text/javascript; charset=utf-8")
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-credentials", "false")
        .header("cache-control", "public, max-age=60")
        .send(prelude + bundle);
    } catch {
      return reply.code(404).send({ error: "assist widget bundle not built" });
    }
  });
}
