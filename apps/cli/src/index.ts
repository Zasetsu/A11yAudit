#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runScan } from "@a11yaudit/audit";
import { DEFAULT_VIEWPORTS, type ScanMode, type Viewport } from "@a11yaudit/core";
import { assertSafeUrl } from "@a11yaudit/crawler";
import { Command } from "commander";
import { LocalStorageAdapter } from "@a11yaudit/storage";

function resolveOutputDir(outDir: string): string {
  if (isAbsolute(outDir)) return outDir;
  return resolve(process.env.INIT_CWD ?? process.cwd(), outDir);
}

function parseAuditUrl(input: string): URL {
  const url = new URL(input);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported audit URL protocol: ${url.protocol}`);
  }

  assertSafeUrl(url.href);

  return url;
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}. Expected a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${label}: ${value}. Expected a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string, label: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}. Expected a non-negative integer.`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}: ${value}. Expected a non-negative integer.`);
  }

  return parsed;
}

function resolveMode(value: string): ScanMode {
  if (value === "single-url") return "single_url";
  if (value === "same-domain-crawl") return "same_domain_crawl";
  throw new Error(`Invalid scan mode: ${value}. Expected single-url or same-domain-crawl.`);
}

function resolveViewports(options: { mobile?: boolean; desktop?: boolean }): Viewport[] {
  const selectedNames = new Set<string>();
  if (options.desktop !== false) selectedNames.add("desktop");
  if (options.mobile !== false) selectedNames.add("mobile");

  const viewports = DEFAULT_VIEWPORTS.filter((viewport) => selectedNames.has(viewport.name));
  if (viewports.length === 0) {
    throw new Error("At least one viewport must be selected");
  }

  return viewports;
}

function cliErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name("a11y-audit")
    .description("Self-hosted WCAG 2.2 technical accessibility audit tool")
    .version("0.1.0");

  program
    .command("scan")
    .argument("<url>", "public URL to audit")
    .option("--pdf", "accepted for compatibility; scans always write HTML and PDF reports")
    .option("--out <dir>", "artifact output directory", ".a11yaudit")
    .option("--mobile", "include mobile viewport", true)
    .option("--no-mobile", "exclude mobile viewport")
    .option("--desktop", "include desktop viewport", true)
    .option("--no-desktop", "exclude desktop viewport")
    .option("--mode <mode>", "scan mode: single-url or same-domain-crawl", "single-url")
    .option("--max-pages <number>", "maximum pages for crawl mode", "10")
    .option("--max-depth <number>", "maximum crawl depth", "1")
    .action(async (url: string, options: {
      pdf?: boolean;
      out: string;
      mobile?: boolean;
      desktop?: boolean;
      mode: string;
      maxPages: string;
      maxDepth: string;
    }) => {
      const auditUrl = parseAuditUrl(url);
      const mode = resolveMode(options.mode);
      const maxPages = parsePositiveInteger(options.maxPages, "max pages");
      const maxDepth = parseNonNegativeInteger(options.maxDepth, "max depth");
      const viewports = resolveViewports(options);
      const outputDir = resolveOutputDir(options.out);
      await mkdir(outputDir, { recursive: true });
      const storage = new LocalStorageAdapter({ rootDir: outputDir });

      const result = await runScan({
        request: {
          runId: `cli-${Date.now()}`,
          projectId: null,
          targetUrl: auditUrl.href,
          mode,
          viewports,
          maxPages,
          maxDepth,
          respectRobotsTxt: true
        },
        storage
      });

      console.log(`A11yAudit completed: ${result.pages.length} page viewport(s) processed`);
      console.log(`Findings: ${result.findings.length}`);
      console.log(`Score: ${result.score}`);
      console.log(`Artifacts written to ${outputDir}`);
    });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const normalizedArgv = argv[2] === "--" ? [argv[0] ?? "node", argv[1] ?? "a11y-audit", ...argv.slice(3)] : argv;
  await createCliProgram().parseAsync(normalizedArgv);
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (import.meta.url === entryPoint) {
  try {
    await runCli();
  } catch (error) {
    console.error(`Error: ${cliErrorMessage(error)}`);
    process.exitCode = 1;
  }
}
