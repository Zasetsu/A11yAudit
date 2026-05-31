import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCliProgram, runCli } from "./index.js";

const { runScanMock } = vi.hoisted(() => ({
  runScanMock: vi.fn()
}));

vi.mock("@a11yaudit/audit", () => ({
  runScan: runScanMock
}));

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const tsxBin = resolve(rootDir, "apps/cli/node_modules/.bin/tsx");

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a11yaudit-cli-"));
  tempDirs.push(dir);
  return dir;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function execFileRejects(
  file: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number | undefined }> {
  try {
    await execFileAsync(file, args, { cwd: rootDir });
    throw new Error("Expected command to fail");
  } catch (error) {
    if (error instanceof Error && "stderr" in error && "stdout" in error) {
      const childError = error as Error & { stderr: string; stdout: string; code?: number };
      return { stdout: childError.stdout, stderr: childError.stderr, code: childError.code };
    }

    throw error;
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  runScanMock.mockReset();
});

describe("a11y-audit scan", () => {
  function mockCompletedScan(overrides: Record<string, unknown> = {}): void {
    runScanMock.mockResolvedValue({
      runId: "cli-1",
      projectId: null,
      targetUrl: "https://example.com/",
      mode: "single_url",
      pages: [{ url: "https://example.com/", errorMessage: null }],
      findings: [],
      reports: [],
      score: 100,
      startedAt: "2026-05-31T00:00:00.000Z",
      finishedAt: "2026-05-31T00:00:01.000Z",
      ...overrides
    });
  }

  it("passes a safe public URL to the audit engine and prints findings and score", async () => {
    mockCompletedScan({
      findings: [{ id: "finding-1" }, { id: "finding-2" }],
      reports: [
        { kind: "html", artifactKey: "runs/cli-1/report/report.html", mimeType: "text/html", sizeBytes: 1 },
        { kind: "pdf", artifactKey: "runs/cli-1/report/report.pdf", mimeType: "application/pdf", sizeBytes: 1 }
      ],
      score: 82
    });
    const outDir = await makeTempDir();
    const program = createCliProgram();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let output = "";

    try {
      await program.parseAsync([
        "node",
        "a11y-audit",
        "scan",
        "https://example.com/",
        "--out",
        outDir,
        "--no-mobile",
        "--max-pages",
        "1",
        "--max-depth",
        "0"
      ]);
      output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    } finally {
      logSpy.mockRestore();
    }

    expect(runScanMock).toHaveBeenCalledTimes(1);
    expect(runScanMock.mock.calls[0]?.[0]).toMatchObject({
      request: {
        projectId: null,
        targetUrl: "https://example.com/",
        mode: "single_url",
        maxPages: 1,
        maxDepth: 0,
        respectRobotsTxt: true,
        viewports: [{ name: "desktop", width: 1440, height: 900 }]
      }
    });
    expect(runScanMock.mock.calls[0]?.[0]).not.toHaveProperty("allowLocalhost");
    expect(output).toContain("A11yAudit completed: 1 page viewport(s) processed");
    expect(output).toContain("Findings: 2");
    expect(output).toContain("Score: 82");
  });

  it("uses both default viewports", async () => {
    mockCompletedScan({ pages: [{}, {}] });
    const outDir = await makeTempDir();

    await createCliProgram().parseAsync(["node", "a11y-audit", "scan", "https://example.com/", "--out", outDir]);

    expect(runScanMock.mock.calls[0]?.[0]).toMatchObject({
      request: {
        viewports: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "mobile", width: 390, height: 844 }
        ]
      }
    });
  });

  it("supports mobile-only scans with --no-desktop", async () => {
    mockCompletedScan();
    const outDir = await makeTempDir();

    await createCliProgram().parseAsync([
      "node",
      "a11y-audit",
      "scan",
      "https://example.com/",
      "--out",
      outDir,
      "--no-desktop"
    ]);

    expect(runScanMock.mock.calls[0]?.[0]).toMatchObject({
      request: {
        viewports: [{ name: "mobile", width: 390, height: 844 }]
      }
    });
  });

  it("maps same-domain-crawl mode to the audit request", async () => {
    mockCompletedScan();
    const outDir = await makeTempDir();

    await createCliProgram().parseAsync([
      "node",
      "a11y-audit",
      "scan",
      "https://example.com/",
      "--out",
      outDir,
      "--mode",
      "same-domain-crawl",
      "--max-pages",
      "7",
      "--max-depth",
      "2"
    ]);

    expect(runScanMock.mock.calls[0]?.[0]).toMatchObject({
      request: {
        mode: "same_domain_crawl",
        maxPages: 7,
        maxDepth: 2
      }
    });
  });

  it("rejects blocked URLs when run as a command", async () => {
    const outDir = await makeTempDir();
    const program = createCliProgram();

    await expect(
      program.parseAsync(["node", "a11y-audit", "scan", "http://127.0.0.1", "--out", outDir])
    ).rejects.toThrow("Blocked unsafe audit target");
  });

  it("rejects unsupported protocols before creating the output directory", async () => {
    const outRoot = await makeTempDir();
    const outDir = join(outRoot, "file-blocked");
    const program = createCliProgram();

    await expect(
      program.parseAsync(["node", "a11y-audit", "scan", "file:///etc/passwd", "--out", outDir])
    ).rejects.toThrow("Unsupported audit URL protocol");
    await expect(pathExists(outDir)).resolves.toBe(false);
  });

  it("handles pnpm script separators and writes relative output from the invocation directory", async () => {
    mockCompletedScan();
    const outRoot = await makeTempDir();
    const previousInitCwd = process.env.INIT_CWD;
    process.env.INIT_CWD = outRoot;

    try {
      await runCli([
        "node",
        "a11y-audit",
        "--",
        "scan",
        "https://example.com/",
        "--out",
        "smoke-report",
        "--no-mobile",
        "--max-pages",
        "1",
        "--max-depth",
        "0"
      ]);

      await expect(pathExists(join(outRoot, "smoke-report"))).resolves.toBe(true);
    } finally {
      if (previousInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = previousInitCwd;
      }
    }
  }, 60_000);

  it("requires at least one viewport", async () => {
    const outDir = await makeTempDir();
    const program = createCliProgram();

    await expect(
      program.parseAsync(["node", "a11y-audit", "scan", "https://example.com", "--out", outDir, "--no-mobile", "--no-desktop"])
    ).rejects.toThrow("At least one viewport must be selected");
  });

  it("rejects invalid scan mode and numeric options before creating output", async () => {
    const outRoot = await makeTempDir();

    await expect(
      createCliProgram().parseAsync([
        "node",
        "a11y-audit",
        "scan",
        "https://example.com",
        "--out",
        join(outRoot, "invalid-mode"),
        "--mode",
        "full-site"
      ])
    ).rejects.toThrow("Invalid scan mode: full-site");
    await expect(pathExists(join(outRoot, "invalid-mode"))).resolves.toBe(false);

    await expect(
      createCliProgram().parseAsync([
        "node",
        "a11y-audit",
        "scan",
        "https://example.com",
        "--out",
        join(outRoot, "invalid-pages"),
        "--max-pages",
        "0"
      ])
    ).rejects.toThrow("Invalid max pages: 0");
    await expect(pathExists(join(outRoot, "invalid-pages"))).resolves.toBe(false);
  });

  it("rejects empty, float, and negative numeric options before creating output", async () => {
    const outRoot = await makeTempDir();
    const cases = [
      {
        outDir: "empty-depth",
        args: ["--max-depth="],
        message: "Invalid max depth: . Expected a non-negative integer."
      },
      {
        outDir: "float-pages",
        args: ["--max-pages", "1.5"],
        message: "Invalid max pages: 1.5. Expected a positive integer."
      },
      {
        outDir: "negative-depth",
        args: ["--max-depth=-1"],
        message: "Invalid max depth: -1. Expected a non-negative integer."
      }
    ];

    for (const testCase of cases) {
      const outDir = join(outRoot, testCase.outDir);
      await expect(
        createCliProgram().parseAsync([
          "node",
          "a11y-audit",
          "scan",
          "https://example.com",
          "--out",
          outDir,
          ...testCase.args
        ])
      ).rejects.toThrow(testCase.message);
      await expect(pathExists(outDir)).resolves.toBe(false);
    }
  });

  it("prints concise executable errors without stack traces for blocked URLs", async () => {
    const outRoot = await makeTempDir();
    const outDir = join(outRoot, "blocked-report");

    const result = await execFileRejects(tsxBin, [
      "apps/cli/src/index.ts",
      "scan",
      "http://127.0.0.1",
      "--out",
      outDir
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("Error: Blocked unsafe audit target: 127.0.0.1");
    expect(result.stderr).not.toContain("at ");
    await expect(pathExists(outDir)).resolves.toBe(false);
  });

  it("prints concise executable errors without creating output for unsupported protocols", async () => {
    const outRoot = await makeTempDir();
    const outDir = join(outRoot, "file-blocked-report");

    const result = await execFileRejects(tsxBin, [
      "apps/cli/src/index.ts",
      "scan",
      "file:///etc/passwd",
      "--out",
      outDir
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("Error: Unsupported audit URL protocol: file:");
    expect(result.stderr).not.toContain("at ");
    await expect(pathExists(outDir)).resolves.toBe(false);
  });
});
