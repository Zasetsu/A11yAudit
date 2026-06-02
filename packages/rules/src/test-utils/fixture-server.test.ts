import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { serveFixtureDirectory } from "./fixture-server.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("serveFixtureDirectory", () => {
  it("serves index.html for the fixture root", async () => {
    const rootDir = await createTempFixtureDirectory();
    await writeFile(join(rootDir, "index.html"), "<h1>Fixture page</h1>", "utf8");

    const server = await serveFixtureDirectory(rootDir);
    try {
      const response = await fetch(`${server.baseUrl}/`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toBe("<h1>Fixture page</h1>");
    } finally {
      await server.close();
    }
  });

  it("blocks traversal requests outside the fixture root", async () => {
    const rootDir = await createTempFixtureDirectory();
    await writeFile(join(rootDir, "index.html"), "<h1>Fixture page</h1>", "utf8");

    const server = await serveFixtureDirectory(rootDir);
    try {
      const response = await fetch(`${server.baseUrl}/../package.json`);

      expect(response.status).toBe(403);
    } finally {
      await server.close();
    }
  });
});

async function createTempFixtureDirectory(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "a11yaudit-fixture-"));
  tempDirs.push(rootDir);
  return rootDir;
}
