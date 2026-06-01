# Interaction Rules and Fixture Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file-based fixture coverage and an initial Playwright-powered A11yAudit interaction rule engine alongside axe-core.

**Architecture:** Keep axe-core as the static rule engine and add `packages/rules/src/interaction/*` as a separate custom browser interaction engine. Each rule is developed fixture-first with local HTTP fixtures, then `auditPage()` merges axe findings and custom interaction findings into the existing `ScanFinding` shape.

**Tech Stack:** TypeScript, Vitest, Playwright Chromium, Node HTTP server, existing `@a11yaudit/core` finding model.

---

## File Structure

Create:

- `packages/rules/fixtures/interaction/keyboard-unreachable-clickable.fail.html`
- `packages/rules/fixtures/interaction/keyboard-unreachable-clickable.pass.html`
- `packages/rules/fixtures/interaction/focus-obscured.fail.html`
- `packages/rules/fixtures/interaction/focus-obscured.pass.html`
- `packages/rules/fixtures/interaction/focus-visible.fail.html`
- `packages/rules/fixtures/interaction/focus-visible.pass.html`
- `packages/rules/fixtures/interaction/keyboard-trap.fail.html`
- `packages/rules/fixtures/interaction/keyboard-trap.pass.html`
- `packages/rules/fixtures/interaction-lab/index.html`
- `packages/rules/src/test-utils/fixture-server.ts`
- `packages/rules/src/test-utils/fixture-server.test.ts`
- `packages/rules/src/interaction/types.ts`
- `packages/rules/src/interaction/dom-utils.ts`
- `packages/rules/src/interaction/keyboard-unreachable-clickable.ts`
- `packages/rules/src/interaction/keyboard-unreachable-clickable.test.ts`
- `packages/rules/src/interaction/focus-obscured.ts`
- `packages/rules/src/interaction/focus-obscured.test.ts`
- `packages/rules/src/interaction/focus-visible.ts`
- `packages/rules/src/interaction/focus-visible.test.ts`
- `packages/rules/src/interaction/keyboard-trap.ts`
- `packages/rules/src/interaction/keyboard-trap.test.ts`
- `packages/rules/src/interaction/index.ts`
- `packages/rules/src/audit-page-interaction.test.ts`

Modify:

- `packages/rules/src/audit-page.ts` — run interaction rules and map custom findings to `ScanFinding`.
- `packages/rules/src/index.ts` — export interaction runner if needed by tests.
- `packages/rules/src/audit-page.test.ts` — keep existing axe normalization test stable.
- `docs/superpowers/specs/2026-06-01-interaction-rules-fixtures-design.md` — update only if implementation reveals a necessary clarification.

---

### Task 1: Fixture Server Utility

**Files:**
- Create: `packages/rules/src/test-utils/fixture-server.ts`
- Create: `packages/rules/src/test-utils/fixture-server.test.ts`

- [ ] **Step 1: Write failing fixture server test**

Create `packages/rules/src/test-utils/fixture-server.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { serveFixtureDirectory } from "./fixture-server.js";

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("serveFixtureDirectory", () => {
  it("serves files from a fixture directory over HTTP", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-fixtures-"));
    await writeFile(join(tempDir, "index.html"), "<!doctype html><h1>Fixture</h1>");

    const server = await serveFixtureDirectory(tempDir);
    try {
      const response = await fetch(`${server.baseUrl}/index.html`);

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<h1>Fixture</h1>");
    } finally {
      await server.close();
    }
  });

  it("blocks path traversal outside the fixture directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "a11yaudit-fixtures-"));
    await mkdir(join(tempDir, "safe"));
    await writeFile(join(tempDir, "safe", "index.html"), "<!doctype html><h1>Safe</h1>");

    const server = await serveFixtureDirectory(tempDir);
    try {
      const response = await fetch(`${server.baseUrl}/../package.json`);

      expect(response.status).toBe(403);
    } finally {
      await server.close();
    }
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/test-utils/fixture-server.test.ts
```

Expected: FAIL because `fixture-server.ts` does not exist.

- [ ] **Step 3: Implement fixture server**

Create `packages/rules/src/test-utils/fixture-server.ts`:

```ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";

export interface FixtureServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

export async function serveFixtureDirectory(rootDir: string): Promise<FixtureServer> {
  const root = resolve(rootDir);
  const server = createServer(async (request, response) => {
    const rawPath = decodeURIComponent(new URL(request.url ?? "/", "http://fixtures.local").pathname);
    const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
    const filePath = normalize(join(root, requestedPath));
    const relativePath = relative(root, filePath);

    if (relativePath.startsWith("..") || relativePath === "" || filePath === root) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
        "content-length": String(fileStat.size)
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  const baseUrl = await listen(server);
  return {
    baseUrl,
    close: () => closeServer(server)
  };
}

function listen(server: Server): Promise<string> {
  return new Promise((resolveUrl, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Unable to determine fixture server address"));
        return;
      }

      resolveUrl(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveClose();
    });
  });
}
```

- [ ] **Step 4: Run fixture server tests**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/test-utils/fixture-server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add packages/rules/src/test-utils/fixture-server.ts packages/rules/src/test-utils/fixture-server.test.ts
rtk git commit -m "Add interaction fixture server"
```

---

### Task 2: Shared Interaction Types and DOM Utilities

**Files:**
- Create: `packages/rules/src/interaction/types.ts`
- Create: `packages/rules/src/interaction/dom-utils.ts`
- Create: `packages/rules/src/interaction/index.ts`
- Modify: `packages/rules/src/index.ts`

- [ ] **Step 1: Add shared interaction types**

Create `packages/rules/src/interaction/types.ts`:

```ts
import type { FindingCertainty, Severity, Viewport } from "@a11yaudit/core";
import type { Page } from "playwright";

export interface InteractionRuleInput {
  page: Page;
  url: string;
  normalizedUrl: string;
  viewport: Viewport;
}

export interface InteractionRuleFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  certainty: FindingCertainty;
  wcagCriteria: string[];
  description: string;
  recommendation: string;
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
}

export type InteractionRule = (input: InteractionRuleInput) => Promise<InteractionRuleFinding[]>;
```

- [ ] **Step 2: Add DOM utility module**

Create `packages/rules/src/interaction/dom-utils.ts`:

```ts
import type { Page } from "playwright";

export interface FocusedElementSnapshot {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getFocusedElementSnapshot(page: Page): Promise<FocusedElementSnapshot | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;
    const rect = element.getBoundingClientRect();
    return {
      selector: buildSelector(element),
      htmlSnippet: element.outerHTML.slice(0, 500),
      visibleText: element.innerText?.trim().slice(0, 200) || null,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  });
}

export async function collectTabStops(page: Page, maxStops = 80): Promise<FocusedElementSnapshot[]> {
  const stops: FocusedElementSnapshot[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < maxStops; index += 1) {
    await page.keyboard.press("Tab");
    const snapshot = await getFocusedElementSnapshot(page);
    if (snapshot === null) continue;
    const key = `${snapshot.selector}|${snapshot.x}|${snapshot.y}|${snapshot.width}|${snapshot.height}`;
    if (seen.has(key)) break;
    seen.add(key);
    stops.push(snapshot);
  }

  return stops;
}

export async function resetFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  });
}

export function selectorFromSnapshot(snapshot: FocusedElementSnapshot | null): string | null {
  return snapshot?.selector ?? null;
}
```

Append browser-side helper inside `page.evaluate` string by defining `buildSelector` within the evaluated function:

```ts
function buildSelector(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && parts.length < 4) {
    const tag = current.tagName.toLowerCase();
    const classes = [...current.classList].slice(0, 2).map((className) => `.${CSS.escape(className)}`).join("");
    parts.unshift(`${tag}${classes}`);
    current = current.parentElement;
  }
  return parts.join(" > ");
}
```

- [ ] **Step 3: Export interaction modules**

Create `packages/rules/src/interaction/index.ts`:

```ts
export * from "./types.js";
export * from "./dom-utils.js";
```

Modify `packages/rules/src/index.ts`:

```ts
export * from "./interaction/index.js";
```

Keep existing exports and add this line only.

- [ ] **Step 4: Run typecheck**

```bash
rtk npm exec pnpm@9 -- --filter @a11yaudit/rules typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add packages/rules/src/interaction/types.ts packages/rules/src/interaction/dom-utils.ts packages/rules/src/interaction/index.ts packages/rules/src/index.ts
rtk git commit -m "Add interaction rule types"
```

---

### Task 3: keyboard-unreachable-clickable Rule

**Files:**
- Create: `packages/rules/fixtures/interaction/keyboard-unreachable-clickable.fail.html`
- Create: `packages/rules/fixtures/interaction/keyboard-unreachable-clickable.pass.html`
- Create: `packages/rules/src/interaction/keyboard-unreachable-clickable.ts`
- Create: `packages/rules/src/interaction/keyboard-unreachable-clickable.test.ts`
- Modify: `packages/rules/src/interaction/index.ts`

- [ ] **Step 1: Add fail fixture**

Create `packages/rules/fixtures/interaction/keyboard-unreachable-clickable.fail.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Keyboard Unreachable Clickable Fail</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; }
      .fake-button { display: inline-block; padding: 10px 14px; border: 1px solid #333; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Keyboard Unreachable Clickable Fail</h1>
      <button>Reachable control</button>
      <div class="fake-button" onclick="window.__clicked = true">Open inaccessible menu</div>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Add pass fixture**

Create `packages/rules/fixtures/interaction/keyboard-unreachable-clickable.pass.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Keyboard Unreachable Clickable Pass</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; }
      button { padding: 10px 14px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Keyboard Unreachable Clickable Pass</h1>
      <button>Open accessible menu</button>
      <a href="#details">Read details</a>
    </main>
  </body>
</html>
```

- [ ] **Step 3: Write failing rule test**

Create `packages/rules/src/interaction/keyboard-unreachable-clickable.test.ts`:

```ts
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runKeyboardUnreachableClickableRule } from "./keyboard-unreachable-clickable.js";

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await serveFixtureDirectory(join(process.cwd(), "fixtures", "interaction"));
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("runKeyboardUnreachableClickableRule", () => {
  it("flags visible clickable controls that are not keyboard reachable", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/keyboard-unreachable-clickable.fail.html`);

      const findings = await runKeyboardUnreachableClickableRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "keyboard-unreachable-clickable",
        wcagCriteria: ["2.1.1"],
        certainty: "automatic_violation"
      });
      expect(findings[0]?.selector).toContain(".fake-button");
    } finally {
      await page.close();
    }
  });

  it("does not flag native keyboard reachable controls", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/keyboard-unreachable-clickable.pass.html`);

      const findings = await runKeyboardUnreachableClickableRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings).toHaveLength(0);
    } finally {
      await page.close();
    }
  });
});
```

- [ ] **Step 4: Run test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/keyboard-unreachable-clickable.test.ts
```

Expected: FAIL because `keyboard-unreachable-clickable.ts` does not exist.

- [ ] **Step 5: Implement rule**

Create `packages/rules/src/interaction/keyboard-unreachable-clickable.ts`:

```ts
import type { InteractionRuleFinding, InteractionRuleInput } from "./types.js";

interface ClickableCandidate {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
}

export async function runKeyboardUnreachableClickableRule(input: InteractionRuleInput): Promise<InteractionRuleFinding[]> {
  const candidates = await collectClickableCandidates(input.page);
  const reachableSelectors = new Set(await collectReachableSelectors(input.page));
  const unreachable = candidates.filter((candidate) => candidate.selector !== null && !reachableSelectors.has(candidate.selector));

  return unreachable.map((candidate) => ({
    ruleId: "keyboard-unreachable-clickable",
    title: "Clickable control is not reachable by keyboard",
    severity: "serious",
    certainty: "automatic_violation",
    wcagCriteria: ["2.1.1"],
    description: "A visible clickable control was not reached during sequential keyboard navigation.",
    recommendation: "Use a native interactive element or add keyboard focus and keyboard activation support.",
    selector: candidate.selector,
    htmlSnippet: candidate.htmlSnippet,
    visibleText: candidate.visibleText
  }));
}

async function collectClickableCandidates(page: InteractionRuleInput["page"]): Promise<ClickableCandidate[]> {
  return page.evaluate(() => {
    const selector = [
      "button",
      "a[href]",
      "input",
      "select",
      "textarea",
      "[role='button']",
      "[role='link']",
      "[onclick]"
    ].join(",");

    return [...document.querySelectorAll(selector)]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden"
          && style.display !== "none"
          && rect.width > 0
          && rect.height > 0
          && !element.hasAttribute("disabled")
          && element.getAttribute("aria-hidden") !== "true";
      })
      .map((element) => ({
        selector: buildSelector(element),
        htmlSnippet: element.outerHTML.slice(0, 500),
        visibleText: element.innerText?.trim().slice(0, 200) || null
      }));

    function buildSelector(element: HTMLElement): string {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts: string[] = [];
      let current: HTMLElement | null = element;
      while (current && current !== document.body && parts.length < 4) {
        const tag = current.tagName.toLowerCase();
        const classes = [...current.classList].slice(0, 2).map((className) => `.${CSS.escape(className)}`).join("");
        parts.unshift(`${tag}${classes}`);
        current = current.parentElement;
      }
      return parts.join(" > ");
    }
  });
}

async function collectReachableSelectors(page: InteractionRuleInput["page"]): Promise<string[]> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });

  const selectors: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press("Tab");
    const selector = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts: string[] = [];
      let current: HTMLElement | null = element;
      while (current && current !== document.body && parts.length < 4) {
        const tag = current.tagName.toLowerCase();
        const classes = [...current.classList].slice(0, 2).map((className) => `.${CSS.escape(className)}`).join("");
        parts.unshift(`${tag}${classes}`);
        current = current.parentElement;
      }
      return parts.join(" > ");
    });
    if (selector === null || seen.has(selector)) break;
    seen.add(selector);
    selectors.push(selector);
  }

  return selectors;
}
```

- [ ] **Step 6: Export rule**

Modify `packages/rules/src/interaction/index.ts`:

```ts
export * from "./keyboard-unreachable-clickable.js";
```

- [ ] **Step 7: Run rule test**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/keyboard-unreachable-clickable.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
rtk git add packages/rules/fixtures/interaction/keyboard-unreachable-clickable.fail.html packages/rules/fixtures/interaction/keyboard-unreachable-clickable.pass.html packages/rules/src/interaction/keyboard-unreachable-clickable.ts packages/rules/src/interaction/keyboard-unreachable-clickable.test.ts packages/rules/src/interaction/index.ts
rtk git commit -m "Add keyboard unreachable clickable rule"
```

---

### Task 4: focus-obscured-or-offscreen Rule

**Files:**
- Create: `packages/rules/fixtures/interaction/focus-obscured.fail.html`
- Create: `packages/rules/fixtures/interaction/focus-obscured.pass.html`
- Create: `packages/rules/src/interaction/focus-obscured.ts`
- Create: `packages/rules/src/interaction/focus-obscured.test.ts`
- Modify: `packages/rules/src/interaction/index.ts`

- [ ] **Step 1: Add fail fixture**

Create `packages/rules/fixtures/interaction/focus-obscured.fail.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Focus Obscured Fail</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; }
      header { position: fixed; inset: 0 0 auto 0; height: 96px; background: #111; color: white; z-index: 10; }
      main { padding-top: 24px; }
      a { display: inline-block; margin: 24px; }
    </style>
  </head>
  <body>
    <header>Fixed header covering the first focus target</header>
    <main>
      <a href="#covered">Covered focus target</a>
      <button>Next target</button>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Add pass fixture**

Create `packages/rules/fixtures/interaction/focus-obscured.pass.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Focus Obscured Pass</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; }
      header { position: fixed; inset: 0 0 auto 0; height: 72px; background: #111; color: white; z-index: 10; }
      main { padding-top: 120px; }
      a, button { display: inline-block; margin: 24px; }
    </style>
  </head>
  <body>
    <header>Fixed header with sufficient offset</header>
    <main>
      <a href="#visible">Visible focus target</a>
      <button>Next target</button>
    </main>
  </body>
</html>
```

- [ ] **Step 3: Write failing rule test**

Create `packages/rules/src/interaction/focus-obscured.test.ts`:

```ts
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runFocusObscuredRule } from "./focus-obscured.js";

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await serveFixtureDirectory(join(process.cwd(), "fixtures", "interaction"));
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("runFocusObscuredRule", () => {
  it("flags focused elements covered by fixed content", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.goto(`${server.baseUrl}/focus-obscured.fail.html`);

      const findings = await runFocusObscuredRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1280, height: 720 }
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "focus-obscured-or-offscreen",
        wcagCriteria: ["2.4.11"],
        certainty: "needs_manual_verification"
      });
    } finally {
      await page.close();
    }
  });

  it("does not flag visible focus targets", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.goto(`${server.baseUrl}/focus-obscured.pass.html`);

      const findings = await runFocusObscuredRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1280, height: 720 }
      });

      expect(findings).toHaveLength(0);
    } finally {
      await page.close();
    }
  });
});
```

- [ ] **Step 4: Run test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/focus-obscured.test.ts
```

Expected: FAIL because `focus-obscured.ts` does not exist.

- [ ] **Step 5: Implement rule**

Create `packages/rules/src/interaction/focus-obscured.ts`:

```ts
import type { InteractionRuleFinding, InteractionRuleInput } from "./types.js";

interface FocusProblem {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
}

export async function runFocusObscuredRule(input: InteractionRuleInput): Promise<InteractionRuleFinding[]> {
  const problems: FocusProblem[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < 80; index += 1) {
    await input.page.keyboard.press("Tab");
    const result = await input.page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const inViewport = rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < window.innerHeight
        && rect.left < window.innerWidth;
      const topElement = inViewport ? document.elementFromPoint(centerX, centerY) : null;
      const covered = topElement !== null && topElement !== element && !element.contains(topElement) && !topElement.contains(element);
      const selector = buildSelector(element);

      return {
        covered,
        htmlSnippet: element.outerHTML.slice(0, 500),
        inViewport,
        selector,
        visibleText: element.innerText?.trim().slice(0, 200) || null
      };

      function buildSelector(target: HTMLElement): string {
        if (target.id) return `#${CSS.escape(target.id)}`;
        const parts: string[] = [];
        let current: HTMLElement | null = target;
        while (current && current !== document.body && parts.length < 4) {
          const tag = current.tagName.toLowerCase();
          const classes = [...current.classList].slice(0, 2).map((className) => `.${CSS.escape(className)}`).join("");
          parts.unshift(`${tag}${classes}`);
          current = current.parentElement;
        }
        return parts.join(" > ");
      }
    });

    if (result === null) continue;
    if (seen.has(result.selector)) break;
    seen.add(result.selector);
    if (!result.inViewport || result.covered) {
      problems.push({
        selector: result.selector,
        htmlSnippet: result.htmlSnippet,
        visibleText: result.visibleText
      });
    }
  }

  return problems.slice(0, 5).map((problem) => ({
    ruleId: "focus-obscured-or-offscreen",
    title: "Focused element appears offscreen or obscured",
    severity: "serious",
    certainty: "needs_manual_verification",
    wcagCriteria: ["2.4.11"],
    description: "A focused element appears outside the visible viewport or covered by another element.",
    recommendation: "Ensure focused controls scroll into view and are not hidden under fixed or sticky content.",
    selector: problem.selector,
    htmlSnippet: problem.htmlSnippet,
    visibleText: problem.visibleText
  }));
}
```

- [ ] **Step 6: Export rule and run tests**

Modify `packages/rules/src/interaction/index.ts`:

```ts
export * from "./focus-obscured.js";
```

Run:

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/focus-obscured.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
rtk git add packages/rules/fixtures/interaction/focus-obscured.fail.html packages/rules/fixtures/interaction/focus-obscured.pass.html packages/rules/src/interaction/focus-obscured.ts packages/rules/src/interaction/focus-obscured.test.ts packages/rules/src/interaction/index.ts
rtk git commit -m "Add focus obscured interaction rule"
```

---

### Task 5: focus-visible-missing Rule

**Files:**
- Create: `packages/rules/fixtures/interaction/focus-visible.fail.html`
- Create: `packages/rules/fixtures/interaction/focus-visible.pass.html`
- Create: `packages/rules/src/interaction/focus-visible.ts`
- Create: `packages/rules/src/interaction/focus-visible.test.ts`
- Modify: `packages/rules/src/interaction/index.ts`

- [ ] **Step 1: Add fixtures**

Create `packages/rules/fixtures/interaction/focus-visible.fail.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Focus Visible Fail</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; }
      button:focus { outline: none; box-shadow: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Focus Visible Fail</h1>
      <button>No visible focus</button>
    </main>
  </body>
</html>
```

Create `packages/rules/fixtures/interaction/focus-visible.pass.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Focus Visible Pass</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; }
      button:focus-visible { outline: 3px solid #005fcc; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Focus Visible Pass</h1>
      <button>Visible focus</button>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Write failing test**

Create `packages/rules/src/interaction/focus-visible.test.ts`:

```ts
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runFocusVisibleRule } from "./focus-visible.js";

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await serveFixtureDirectory(join(process.cwd(), "fixtures", "interaction"));
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("runFocusVisibleRule", () => {
  it("flags focusable controls without detectable focus indicators", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/focus-visible.fail.html`);

      const findings = await runFocusVisibleRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "focus-visible-missing",
        wcagCriteria: ["2.4.7"],
        certainty: "needs_manual_verification"
      });
    } finally {
      await page.close();
    }
  });

  it("does not flag controls with outline focus indicators", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/focus-visible.pass.html`);

      const findings = await runFocusVisibleRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings).toHaveLength(0);
    } finally {
      await page.close();
    }
  });
});
```

- [ ] **Step 3: Run test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/focus-visible.test.ts
```

Expected: FAIL because `focus-visible.ts` does not exist.

- [ ] **Step 4: Implement rule**

Create `packages/rules/src/interaction/focus-visible.ts`:

```ts
import type { InteractionRuleFinding, InteractionRuleInput } from "./types.js";

interface FocusVisibleProblem {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
}

export async function runFocusVisibleRule(input: InteractionRuleInput): Promise<InteractionRuleFinding[]> {
  const problems: FocusVisibleProblem[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < 80; index += 1) {
    await input.page.keyboard.press("Tab");
    const snapshot = await input.page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const style = window.getComputedStyle(element);
      const hasOutline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth || "0") > 0;
      const hasBoxShadow = style.boxShadow !== "none";
      const hasVisibleBorder = parseFloat(style.borderTopWidth || "0") > 1
        || parseFloat(style.borderRightWidth || "0") > 1
        || parseFloat(style.borderBottomWidth || "0") > 1
        || parseFloat(style.borderLeftWidth || "0") > 1;
      const selector = buildSelector(element);
      return {
        selector,
        hasIndicator: hasOutline || hasBoxShadow || hasVisibleBorder,
        htmlSnippet: element.outerHTML.slice(0, 500),
        visibleText: element.innerText?.trim().slice(0, 200) || null
      };

      function buildSelector(target: HTMLElement): string {
        if (target.id) return `#${CSS.escape(target.id)}`;
        const parts: string[] = [];
        let current: HTMLElement | null = target;
        while (current && current !== document.body && parts.length < 4) {
          const tag = current.tagName.toLowerCase();
          const classes = [...current.classList].slice(0, 2).map((className) => `.${CSS.escape(className)}`).join("");
          parts.unshift(`${tag}${classes}`);
          current = current.parentElement;
        }
        return parts.join(" > ");
      }
    });

    if (snapshot === null) continue;
    if (seen.has(snapshot.selector)) break;
    seen.add(snapshot.selector);
    if (!snapshot.hasIndicator) {
      problems.push(snapshot);
    }
  }

  return problems.slice(0, 5).map((problem) => ({
    ruleId: "focus-visible-missing",
    title: "Focused element has no detectable focus indicator",
    severity: "serious",
    certainty: "needs_manual_verification",
    wcagCriteria: ["2.4.7"],
    description: "A keyboard-focused element has no detectable outline, box shadow, or border focus indicator.",
    recommendation: "Provide a visible focus indicator using outline, box-shadow, border, or another clear visual state.",
    selector: problem.selector,
    htmlSnippet: problem.htmlSnippet,
    visibleText: problem.visibleText
  }));
}
```

- [ ] **Step 5: Export rule and run tests**

Modify `packages/rules/src/interaction/index.ts`:

```ts
export * from "./focus-visible.js";
```

Run:

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/focus-visible.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
rtk git add packages/rules/fixtures/interaction/focus-visible.fail.html packages/rules/fixtures/interaction/focus-visible.pass.html packages/rules/src/interaction/focus-visible.ts packages/rules/src/interaction/focus-visible.test.ts packages/rules/src/interaction/index.ts
rtk git commit -m "Add focus visible interaction rule"
```

---

### Task 6: keyboard-trap-suspected Rule

**Files:**
- Create: `packages/rules/fixtures/interaction/keyboard-trap.fail.html`
- Create: `packages/rules/fixtures/interaction/keyboard-trap.pass.html`
- Create: `packages/rules/src/interaction/keyboard-trap.ts`
- Create: `packages/rules/src/interaction/keyboard-trap.test.ts`
- Modify: `packages/rules/src/interaction/index.ts`

- [ ] **Step 1: Add fixtures**

Create `packages/rules/fixtures/interaction/keyboard-trap.fail.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Keyboard Trap Fail</title>
  </head>
  <body>
    <main>
      <h1>Keyboard Trap Fail</h1>
      <button id="first">First trapped button</button>
      <button id="second">Second trapped button</button>
      <script>
        const first = document.getElementById("first");
        const second = document.getElementById("second");
        first.focus();
        document.addEventListener("keydown", (event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            if (document.activeElement === first) second.focus();
            else first.focus();
          }
        });
      </script>
    </main>
  </body>
</html>
```

Create `packages/rules/fixtures/interaction/keyboard-trap.pass.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Keyboard Trap Pass</title>
  </head>
  <body>
    <main>
      <h1>Keyboard Trap Pass</h1>
      <button>First button</button>
      <button>Second button</button>
      <a href="#done">Final link</a>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Write failing test**

Create `packages/rules/src/interaction/keyboard-trap.test.ts`:

```ts
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runKeyboardTrapRule } from "./keyboard-trap.js";

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await serveFixtureDirectory(join(process.cwd(), "fixtures", "interaction"));
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("runKeyboardTrapRule", () => {
  it("flags repeated small focus cycles as suspected traps", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/keyboard-trap.fail.html`);

      const findings = await runKeyboardTrapRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        ruleId: "keyboard-trap-suspected",
        wcagCriteria: ["2.1.2"],
        certainty: "needs_manual_verification"
      });
    } finally {
      await page.close();
    }
  });

  it("does not flag normal tab flow", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/keyboard-trap.pass.html`);

      const findings = await runKeyboardTrapRule({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings).toHaveLength(0);
    } finally {
      await page.close();
    }
  });
});
```

- [ ] **Step 3: Run test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/keyboard-trap.test.ts
```

Expected: FAIL because `keyboard-trap.ts` does not exist.

- [ ] **Step 4: Implement rule**

Create `packages/rules/src/interaction/keyboard-trap.ts`:

```ts
import type { InteractionRuleFinding, InteractionRuleInput } from "./types.js";

export async function runKeyboardTrapRule(input: InteractionRuleInput): Promise<InteractionRuleFinding[]> {
  const sequence: string[] = [];
  const htmlBySelector = new Map<string, { htmlSnippet: string | null; visibleText: string | null }>();

  for (let index = 0; index < 24; index += 1) {
    await input.page.keyboard.press("Tab");
    const snapshot = await input.page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const selector = element.id ? `#${CSS.escape(element.id)}` : element.tagName.toLowerCase();
      return {
        selector,
        htmlSnippet: element.outerHTML.slice(0, 500),
        visibleText: element.innerText?.trim().slice(0, 200) || null
      };
    });

    if (snapshot === null) continue;
    sequence.push(snapshot.selector);
    htmlBySelector.set(snapshot.selector, {
      htmlSnippet: snapshot.htmlSnippet,
      visibleText: snapshot.visibleText
    });
  }

  const unique = new Set(sequence);
  const suspected = sequence.length >= 12 && unique.size <= 3;
  if (!suspected) return [];

  await input.page.keyboard.press("Escape");
  await input.page.keyboard.press("Tab");
  const afterEscape = await input.page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;
    return element.id ? `#${CSS.escape(element.id)}` : element.tagName.toLowerCase();
  });

  if (afterEscape !== null && !unique.has(afterEscape)) return [];

  const firstSelector = sequence[0] ?? null;
  const representative = firstSelector ? htmlBySelector.get(firstSelector) : undefined;
  return [{
    ruleId: "keyboard-trap-suspected",
    title: "Potential keyboard trap detected",
    severity: "critical",
    certainty: "needs_manual_verification",
    wcagCriteria: ["2.1.2"],
    description: "Sequential keyboard navigation appears to remain within a small repeated focus cycle.",
    recommendation: "Ensure keyboard users can move focus away from the component, and provide Escape behavior for modal or popup interfaces.",
    selector: firstSelector,
    htmlSnippet: representative?.htmlSnippet ?? null,
    visibleText: representative?.visibleText ?? null
  }];
}
```

- [ ] **Step 5: Export rule and run tests**

Modify `packages/rules/src/interaction/index.ts`:

```ts
export * from "./keyboard-trap.js";
```

Run:

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/keyboard-trap.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
rtk git add packages/rules/fixtures/interaction/keyboard-trap.fail.html packages/rules/fixtures/interaction/keyboard-trap.pass.html packages/rules/src/interaction/keyboard-trap.ts packages/rules/src/interaction/keyboard-trap.test.ts packages/rules/src/interaction/index.ts
rtk git commit -m "Add keyboard trap interaction rule"
```

---

### Task 7: Interaction Runner and auditPage Integration

**Files:**
- Modify: `packages/rules/src/interaction/index.ts`
- Modify: `packages/rules/src/audit-page.ts`
- Create: `packages/rules/src/audit-page-interaction.test.ts`

- [ ] **Step 1: Write failing auditPage integration test**

Create `packages/rules/src/audit-page-interaction.test.ts`:

```ts
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditPage } from "./audit-page.js";
import { serveFixtureDirectory, type FixtureServer } from "./test-utils/fixture-server.js";

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await serveFixtureDirectory(join(process.cwd(), "fixtures", "interaction"));
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("auditPage interaction rules", () => {
  it("returns custom interaction findings alongside axe findings", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(`${server.baseUrl}/keyboard-unreachable-clickable.fail.html`);

      const result = await auditPage({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(result.findings.some((finding) => finding.source === "custom")).toBe(true);
      expect(result.findings.some((finding) => finding.ruleId === "keyboard-unreachable-clickable")).toBe(true);
      const custom = result.findings.find((finding) => finding.ruleId === "keyboard-unreachable-clickable");
      expect(custom).toMatchObject({
        source: "custom",
        status: "new",
        pageUrl: page.url(),
        viewport: "desktop",
        wcagCriteria: ["2.1.1"]
      });
    } finally {
      await page.close();
    }
  });
});
```

- [ ] **Step 2: Run integration test and verify it fails**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/audit-page-interaction.test.ts
```

Expected: FAIL because `auditPage()` does not run interaction rules yet.

- [ ] **Step 3: Add interaction runner**

Modify `packages/rules/src/interaction/index.ts`:

```ts
import type { InteractionRuleFinding, InteractionRuleInput } from "./types.js";
import { runFocusObscuredRule } from "./focus-obscured.js";
import { runFocusVisibleRule } from "./focus-visible.js";
import { runKeyboardTrapRule } from "./keyboard-trap.js";
import { runKeyboardUnreachableClickableRule } from "./keyboard-unreachable-clickable.js";

export * from "./types.js";
export * from "./dom-utils.js";
export * from "./focus-obscured.js";
export * from "./focus-visible.js";
export * from "./keyboard-trap.js";
export * from "./keyboard-unreachable-clickable.js";

const INTERACTION_RULES = [
  runKeyboardUnreachableClickableRule,
  runFocusObscuredRule,
  runFocusVisibleRule,
  runKeyboardTrapRule
];

export async function runInteractionRules(input: InteractionRuleInput): Promise<InteractionRuleFinding[]> {
  const findings: InteractionRuleFinding[] = [];
  for (const rule of INTERACTION_RULES) {
    try {
      findings.push(...await rule(input));
    } catch {
      // Interaction rules should not fail the page audit in the MVP.
    }
  }
  return findings;
}
```

- [ ] **Step 4: Map interaction findings in auditPage**

Modify `packages/rules/src/audit-page.ts`.

Add imports:

```ts
import { runInteractionRules, type InteractionRuleFinding } from "./interaction/index.js";
```

Inside `auditPage()` after axe findings:

```ts
const axeFindings = results.violations.flatMap((violation) => mapViolationToFindings(violation, input));
const interactionFindings = mapInteractionFindings(await runInteractionRules(input), input);
const findings = [...axeFindings, ...interactionFindings];
```

Add helper:

```ts
function mapInteractionFindings(findings: InteractionRuleFinding[], input: AuditPageInput): ScanFinding[] {
  return findings.map((finding) => {
    const elementSignature = finding.selector ?? finding.htmlSnippet ?? finding.title;
    const fingerprint = createFindingFingerprint({
      normalizedUrl: input.normalizedUrl,
      viewport: input.viewport.name,
      ruleId: finding.ruleId,
      wcagCriteria: finding.wcagCriteria,
      elementSignature
    });

    return {
      id: createStableFindingId(fingerprint),
      title: finding.title,
      severity: finding.severity,
      status: "new",
      source: "custom",
      certainty: finding.certainty,
      origin: "unknown",
      wcagCriteria: finding.wcagCriteria,
      ruleId: finding.ruleId,
      description: finding.description,
      recommendation: finding.recommendation,
      pageUrl: input.url,
      viewport: input.viewport.name,
      selector: finding.selector,
      htmlSnippet: finding.htmlSnippet,
      visibleText: finding.visibleText,
      helpUrl: null,
      fingerprint,
      evidence: [],
      instances: 1
    };
  });
}
```

- [ ] **Step 5: Run integration and existing audit tests**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/audit-page-interaction.test.ts packages/rules/src/audit-page.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
rtk git add packages/rules/src/interaction/index.ts packages/rules/src/audit-page.ts packages/rules/src/audit-page-interaction.test.ts
rtk git commit -m "Run interaction rules during page audits"
```

---

### Task 8: Combined Interaction Lab Fixture

**Files:**
- Create: `packages/rules/fixtures/interaction-lab/index.html`
- Create: `packages/rules/src/interaction/interaction-lab.test.ts`

- [ ] **Step 1: Add combined lab page**

Create `packages/rules/fixtures/interaction-lab/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>A11yAudit Interaction Lab</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; }
      header { position: fixed; inset: 0 0 auto 0; height: 88px; background: #111; color: white; z-index: 10; padding: 16px; }
      main { padding: 24px; }
      .fake-button { display: inline-block; padding: 10px 14px; border: 1px solid #333; cursor: pointer; }
      .no-focus:focus { outline: none; box-shadow: none; }
      .covered { display: inline-block; margin-top: 12px; }
      .spacer { height: 120px; }
    </style>
  </head>
  <body>
    <header>Fixed header that can obscure early focus targets</header>
    <main>
      <h1>A11yAudit Interaction Lab</h1>
      <a class="covered" href="#covered">Covered focus target</a>
      <div class="spacer"></div>
      <div class="fake-button" onclick="window.__clicked = true">Unreachable fake button</div>
      <button class="no-focus">Button without visible focus</button>
      <section aria-label="Trap fixture">
        <button id="trap-one">Trap one</button>
        <button id="trap-two">Trap two</button>
      </section>
      <script>
        const one = document.getElementById("trap-one");
        const two = document.getElementById("trap-two");
        document.addEventListener("keydown", (event) => {
          if (document.activeElement === one || document.activeElement === two) {
            if (event.key === "Tab") {
              event.preventDefault();
              if (document.activeElement === one) two.focus();
              else one.focus();
            }
          }
        });
      </script>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Add lab integration test**

Create `packages/rules/src/interaction/interaction-lab.test.ts`:

```ts
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFixtureDirectory, type FixtureServer } from "../test-utils/fixture-server.js";
import { runInteractionRules } from "./index.js";

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await serveFixtureDirectory(join(process.cwd(), "fixtures", "interaction-lab"));
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

describe("interaction lab", () => {
  it("exercises multiple interaction rules from one file-based fixture", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(`${server.baseUrl}/index.html`);

      const findings = await runInteractionRules({
        page,
        url: page.url(),
        normalizedUrl: page.url(),
        viewport: { name: "desktop", width: 1440, height: 900 }
      });

      expect(findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
        "keyboard-unreachable-clickable",
        "focus-visible-missing"
      ]));
    } finally {
      await page.close();
    }
  });
});
```

- [ ] **Step 3: Run lab test**

```bash
rtk npm exec pnpm@9 -- test packages/rules/src/interaction/interaction-lab.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Task 8**

```bash
rtk git add packages/rules/fixtures/interaction-lab/index.html packages/rules/src/interaction/interaction-lab.test.ts
rtk git commit -m "Add interaction rule lab fixture"
```

---

### Task 9: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-01-interaction-rules-fixtures-design.md` only if implementation differs from the spec.

- [ ] **Step 1: Update README rule engine section**

Add a short section to `README.md`:

```md
### Rule Engines

A11yAudit combines axe-core checks with custom Playwright interaction rules. axe-core covers many static WCAG technical checks. Interaction rules exercise keyboard and focus behavior, including keyboard-reachable clickable controls, visible focus indicators, obscured focus targets, and suspected keyboard traps. Interaction findings are technical signals and may require manual confirmation.
```

- [ ] **Step 2: Run all rules package tests**

```bash
rtk npm exec pnpm@9 -- test packages/rules
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

```bash
rtk npm exec pnpm@9 -- test
```

Expected: PASS.

- [ ] **Step 4: Run full typecheck**

```bash
rtk npm exec pnpm@9 -- typecheck
```

Expected: PASS.

- [ ] **Step 5: Run full build**

```bash
rtk npm exec pnpm@9 -- -r build
```

Expected: PASS. Existing Vite warnings about React Query `"use client"` directives are acceptable if exit code is 0.

- [ ] **Step 6: Commit documentation**

```bash
rtk git add README.md docs/superpowers/specs/2026-06-01-interaction-rules-fixtures-design.md
rtk git commit -m "Document interaction rule engines"
```

- [ ] **Step 7: Push**

```bash
rtk git push
```

Expected: normal push success.

---

## Execution Notes

- Keep interaction rules bounded. A bad rule must not hang a full-site scan.
- Use `source: "custom"` for interaction findings.
- Use `needs_manual_verification` for heuristic focus and trap rules.
- Keep fixtures small and deterministic.
- Commit after each task.

## Self-Review

Spec coverage:

- File-based fixtures are covered by Tasks 3 through 6.
- Local HTTP fixture server is covered by Task 1.
- Shared interaction rule interfaces are covered by Task 2.
- Four MVP rules are covered by Tasks 3 through 6.
- `auditPage()` integration is covered by Task 7.
- Combined lab fixture is covered by Task 8.
- Documentation and verification are covered by Task 9.

Completeness scan:

- No incomplete implementation notes are intentionally left for implementation workers.

Type consistency:

- Interaction findings use `InteractionRuleFinding`.
- `auditPage()` maps custom rule findings into existing `ScanFinding`.
- Rule IDs match the spec: `keyboard-unreachable-clickable`, `focus-obscured-or-offscreen`, `focus-visible-missing`, and `keyboard-trap-suspected`.
