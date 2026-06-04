import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";

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
      .header("cache-control", "public, max-age=3600")
      .send(body);
  } catch {
    reply.code(404).send({ error: "assist widget bundle not built" });
  }
}

export async function registerAssistRoutes(server: FastifyInstance): Promise<void> {
  server.get("/assist/a11yaudit-assist.js", async (_request, reply) =>
    serveAsset(resolveBundlePath, "", "text/javascript; charset=utf-8", reply)
  );

  server.get("/assist/a11yaudit-assist.js.map", async (_request, reply) =>
    serveAsset(resolveBundlePath, ".map", "application/json; charset=utf-8", reply)
  );
}
