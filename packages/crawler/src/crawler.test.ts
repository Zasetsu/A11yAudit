import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crawlSameDomain, crawlStaticSeed } from "./crawler";

vi.mock("./network-safety.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./network-safety.js")>();

  const assertSafeUrl = vi.fn((input: string) => {
    const hostname = new URL(input).hostname.toLowerCase();
    if (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]") {
      return;
    }

    actual.assertSafeUrl(input);
  });

  return {
    ...actual,
    assertSafeUrl,
    assertSafeResolvedUrl: vi.fn(async (input: string) => {
      assertSafeUrl(input);
    })
  };
});

function html(body: string): string {
  return `<!doctype html><html><body>${body}</body></html>`;
}

describe("crawlSameDomain", () => {
  let server: ReturnType<typeof createServer>;
  let origin: string;
  let stalledResponses: ServerResponse[];
  let stalledTimers: NodeJS.Timeout[];

  beforeEach(async () => {
    stalledResponses = [];
    stalledTimers = [];
    server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const path = request.url ?? "/";

      if (path === "/robots.txt") {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("User-agent: *\nDisallow: /private\n");
        return;
      }

      if (path === "/") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(html(`
          <a href="/about?utm_source=newsletter#team">About</a>
          <a href="/docs.pdf">PDF</a>
          <a href="https://offsite.example/contact">Offsite</a>
          <a href="/private">Private</a>
        `));
        return;
      }

      if (path === "/about") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html(`
          <a href="/contact/">Contact</a>
          <a href="/">Home duplicate</a>
        `));
        return;
      }

      if (path === "/contact") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(html('<a href="/deep">Deep</a>'));
        return;
      }

      if (path === "/private") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(html("private"));
        return;
      }

      if (path === "/redirect-private") {
        response.writeHead(302, { location: "http://10.0.0.1/private" });
        response.end();
        return;
      }

      if (path === "/oversize") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(html("x".repeat(128) + '<a href="/oversize-child">Oversize child</a>'));
        return;
      }

      if (path === "/oversize-child") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(html("child"));
        return;
      }

      if (path === "/slow-body") {
        response.writeHead(200, { "content-type": "text/html" });
        response.flushHeaders();
        stalledResponses.push(response);
        stalledTimers.push(setTimeout(() => {
          response.end(html('<a href="/slow-child">Slow child</a>'));
        }, 500));
        return;
      }

      if (path === "/slow-child") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(html("slow child"));
        return;
      }

      response.writeHead(404, { "content-type": "text/html" });
      response.end(html("not found"));
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const timer of stalledTimers) {
      clearTimeout(timer);
    }

    for (const response of stalledResponses) {
      response.destroy();
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("discovers same-origin HTML pages in deterministic order and records skipped URLs", async () => {
    const result = await crawlSameDomain({
      startUrl: origin,
      maxPages: 10,
      maxDepth: 2
    });

    expect(result.urls).toEqual([origin + "/", origin + "/about", origin + "/contact"]);
    expect(result.skipped).toEqual(expect.arrayContaining([
      { url: origin + "/docs.pdf", reason: "asset" },
      { url: "https://offsite.example/contact", reason: "external_origin" },
      { url: origin + "/private", reason: "robots" },
      { url: origin + "/", reason: "duplicate" },
      { url: origin + "/deep", reason: "depth" }
    ]));
  });

  it("does not fetch robots.txt when robots are disabled", async () => {
    const result = await crawlSameDomain({
      startUrl: origin,
      maxPages: 10,
      maxDepth: 1,
      respectRobotsTxt: false
    });

    expect(result.urls).toContain(origin + "/private");
    expect(result.skipped).not.toContainEqual({ url: origin + "/private", reason: "robots" });
  });

  it("rejects non-loopback private targets", async () => {
    await expect(crawlSameDomain({ startUrl: "http://10.0.0.1/" }))
      .rejects.toThrow("Blocked unsafe audit target");
  });

  it("does not follow redirects to private network targets", async () => {
    const result = await crawlSameDomain({
      startUrl: origin + "/redirect-private",
      respectRobotsTxt: false,
      pageTimeoutMs: 100
    });

    expect(result.urls).not.toContain(origin + "/redirect-private");
    expect(result.skipped).toContainEqual({ url: origin + "/redirect-private", reason: "unsafe" });
  });

  it("skips oversized HTML bodies without discovering links from them", async () => {
    const result = await crawlSameDomain({
      startUrl: origin + "/oversize",
      respectRobotsTxt: false,
      maxHtmlBytes: 64
    });

    expect(result.urls).toEqual([]);
    expect(result.skipped).toContainEqual({ url: origin + "/oversize", reason: "unsafe" });
  });

  it("times out stalled response bodies after headers", async () => {
    const startedAt = Date.now();
    const result = await crawlSameDomain({
      startUrl: origin + "/slow-body",
      respectRobotsTxt: false,
      pageTimeoutMs: 25
    });

    expect(Date.now() - startedAt).toBeLessThan(250);
    expect(result.urls).toEqual([]);
    expect(result.skipped).toContainEqual({ url: origin + "/slow-body", reason: "unsafe" });
  });
});

describe("crawlStaticSeed", () => {
  it("keeps compatibility with the single normalized seed URL result", async () => {
    await expect(crawlStaticSeed({ startUrl: "http://127.0.0.1:1/?utm_source=x#top" }))
      .resolves.toEqual({ urls: ["http://127.0.0.1:1/"], skipped: [] });
  });

  it("rejects non-loopback private targets", async () => {
    await expect(crawlStaticSeed({ startUrl: "http://10.0.0.1/" }))
      .rejects.toThrow("Blocked unsafe audit target");
  });
});
