import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export interface FixtureServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const urlPrefix = "/__fixture__";

const contentTypes = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

export async function serveFixtureDirectory(rootDir: string): Promise<FixtureServer> {
  const fixtureRoot = await realpath(rootDir);
  const server = createServer((request, response) => {
    void handleRequest({ fixtureRoot, request, response });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    await closeServer(server);
    throw new Error("Fixture server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}${urlPrefix}`,
    close: () => closeServer(server)
  };
}

async function handleRequest({
  fixtureRoot,
  request,
  response
}: {
  fixtureRoot: string;
  request: IncomingMessage;
  response: ServerResponse;
}): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://fixture.local");
    if (!requestUrl.pathname.startsWith(`${urlPrefix}/`) && requestUrl.pathname !== urlPrefix) {
      sendStatus(response, 403);
      return;
    }

    const fixturePath = requestUrl.pathname.slice(urlPrefix.length) || "/";
    const relativePath = decodeURIComponent(fixturePath === "/" ? "/index.html" : fixturePath);
    const targetPath = resolve(fixtureRoot, `.${relativePath}`);

    if (!isPathInsideRoot(fixtureRoot, targetPath)) {
      sendStatus(response, 403);
      return;
    }

    let targetStat;
    try {
      targetStat = await stat(targetPath);
    } catch {
      sendStatus(response, 404);
      return;
    }

    if (!targetStat.isFile()) {
      sendStatus(response, 404);
      return;
    }

    const actualPath = await realpath(targetPath);
    if (!isPathInsideRoot(fixtureRoot, actualPath)) {
      sendStatus(response, 403);
      return;
    }

    const body = await readFile(actualPath);
    response.writeHead(200, {
      "content-type": contentTypes.get(extname(actualPath)) ?? "application/octet-stream"
    });
    response.end(body);
  } catch {
    sendStatus(response, 400);
  }
}

function isPathInsideRoot(rootDir: string, targetPath: string): boolean {
  return targetPath === rootDir || targetPath.startsWith(`${rootDir}${sep}`);
}

function sendStatus(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode);
  response.end();
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });
}
