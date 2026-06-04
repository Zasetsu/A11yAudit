# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the owner's landing design as a served `apps/landing` static site at `/`, edit its content (dashboard-style hero mock, real-widget live demo, dogfood embed, remove one line), and move the dashboard SPA behind `/app` so visiting the site lands on marketing, not the app.

**Architecture:** Fastify serves three trees on one origin: `/` → `apps/landing` (the design file), `/app/*` → the built `apps/web` SPA (Vite `base:"/app/"`, client router prefixed), `/assist/*` → the widget bundle (already done). The API stays at `/api/*` (origin-relative, unaffected). The live demo and the page itself embed the real `/assist/a11yaudit-assist.js`.

**Tech Stack:** Static HTML/CSS/JS (the design file), Fastify (+ `@fastify/static`), React/Vite (apps/web), Vitest.

**Conventions:** From repo root `/Users/zasetsu/Documents/GitHub/WCAG`. Tests: `./node_modules/.bin/vitest`. Build a package: `npx pnpm@9 --filter <pkg> build`. Typecheck: `./node_modules/.bin/tsc -p <pkg>/tsconfig.json --noEmit`. Design source: `/Users/zasetsu/Downloads/A11yAudit-4/` (`Audera.html`, `landing/landing.css`, `landing/landing.js`, `assets/`).

---

## File Structure

- **Create** `apps/landing/` — static site: `index.html` (= `Audera.html`), `landing/landing.css`, `landing/landing.js`, `assets/*`, `demo/ornek-site.html` (new sample page for the demo iframe), `package.json` (workspace marker, no build).
- **Modify** `apps/landing/index.html` — remove the trust line; replace the assist-panel demo with an iframe; add the dogfood widget script.
- **Modify** `apps/landing/landing.js` / `landing.css` — hero console → dashboard-style replica; drop the now-unused fake-panel demo logic.
- **Create** `apps/server/src/routes/landing.ts` — serve `apps/landing` at `/` and the web SPA at `/app/*`.
- **Modify** `apps/server/src/app.ts` — register the landing/app static routes.
- **Modify** `apps/web/vite.config.ts` — `base: "/app/"`.
- **Modify** `apps/web/src/app.tsx` — prefix the client router with `/app` (`parsePath`/`routePath`).
- **Modify** `apps/web/src/app.test.ts`/`auth.test.tsx` if they assert raw paths.
- **Modify** `docs/deployment.md` — the three-tree serving + landing.

---

## Task 1: Scaffold `apps/landing` from the design file

**Files:** create `apps/landing/**`.

- [ ] **Step 1: Copy the design files**

```bash
SRC=/Users/zasetsu/Downloads/A11yAudit-4
DST=/Users/zasetsu/Documents/GitHub/WCAG/apps/landing
mkdir -p "$DST/landing" "$DST/assets" "$DST/demo"
cp "$SRC/Audera.html" "$DST/index.html"
cp "$SRC/landing/landing.css" "$DST/landing/landing.css"
cp "$SRC/landing/landing.js" "$DST/landing/landing.js"
cp -R "$SRC/assets/." "$DST/assets/"
ls -R "$DST" | head -40
```
Do NOT copy `src/` (the designer's throwaway dashboard prototype) or the other `Audera *.html` brand files.

- [ ] **Step 2: Workspace marker** — create `apps/landing/package.json`:

```json
{
  "name": "@a11yaudit/landing",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```
Run `npx pnpm@9 install` so the workspace links it. (No build/test scripts — it's static files served by the server.)

- [ ] **Step 3: Confirm the static set is self-contained** — `grep -noE '(src|href)="[^"]+"' apps/landing/index.html | grep -v '#'` should reference only `assets/favicon.svg`, `landing/landing.css`, `landing/landing.js`, the Google Fonts CDN, and the `mailto:`. No references to `src/` or external app code. Report what it references.

- [ ] **Step 4: Commit**

```bash
git add apps/landing pnpm-lock.yaml
git commit -m "chore(landing): import the Audera landing design as a static app"
```

---

## Task 2: Remove the hero trust line

**Files:** `apps/landing/index.html`

- [ ] **Step 1: Delete the line.** Find the `.hero-trust` paragraph (it reads `Kamu kurumları, bankalar, e-ticaret ve kurumsal ekipler için.`, near the hero, with a leading `<span class="dot"></span>`). Remove the entire `<p class="hero-trust">…</p>` element. Confirm `grep -c "Kamu kurumları, bankalar" apps/landing/index.html` returns `0` (the OTHER occurrence in the `#kimler` sectors list, `Kamu kurumları` alone, stays — only the hero-trust full sentence is removed; verify you removed the hero one, not the sector chip).

- [ ] **Step 2: Commit**

```bash
git add apps/landing/index.html
git commit -m "feat(landing): remove the hero audience trust line"
```

---

## Task 3: Live demo → the real widget in an iframe

**Files:** create `apps/landing/demo/ornek-site.html`; modify `apps/landing/index.html`, `apps/landing/landing.js`.

Context: the `#assist` section has a `.demo-stage` (fake browser with sample `#assistSample` article) + a hand-built `.assist-panel` whose `landing.js` logic (`data-step`/`data-dir`/`data-toggle`) mutates the sample. We replace that fake panel with the REAL widget running on a sample page inside an iframe.

- [ ] **Step 1: Create the sample page** `apps/landing/demo/ornek-site.html` — a small, believable sample site (reuse the municipal-services content already in the design's `#assistSample`) that embeds the real widget:

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Örnek Belediye</title>
  <style>
    body { font-family: system-ui, sans-serif; color:#1d1b18; margin:0; padding:28px 30px; line-height:1.6; }
    h1 { font-size:24px; margin:0 0 12px; }
    p { color:#44403c; max-width:60ch; }
    .row { display:flex; gap:10px; margin-top:16px; }
    .btn { border:1px solid #d6d3cd; border-radius:8px; padding:8px 14px; font-size:14px; }
    .btn.p { background:#2b56b0; color:#fff; border-color:#2b56b0; }
    img.banner { width:100%; max-width:520px; height:120px; object-fit:cover; border-radius:10px; margin-top:18px; background:#eee; }
  </style>
</head>
<body>
  <h1>Belediye Hizmetleri</h1>
  <p>Başvurularınızı çevrimiçi oluşturun. Su, imar ve evlilik işlemleri için randevu alın. Daha fazla bilgi için hizmet rehberini inceleyin.</p>
  <div class="row"><span class="btn p">Başvuru oluştur</span><span class="btn">Hizmet rehberi</span></div>
  <img class="banner" alt="Kampanya görseli" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' height='120'%3E%3Crect width='520' height='120' fill='%23dfe6f2'/%3E%3C/svg%3E" />
  <!-- The real Audera widget, served by the same origin -->
  <script src="/assist/a11yaudit-assist.js" data-position="bottom-right" data-language="tr" data-project="audera-demo" defer></script>
</body>
</html>
```

- [ ] **Step 2: Replace the fake panel with the iframe** in `apps/landing/index.html`. In the `#assist` section, find the `.demo-stage` + `.assist-panel` block. Replace the whole interactive demo (the `.demo-stage` article AND the `.assist-panel` aside, plus any `.assist-cats`/reset wiring that belonged to the fake panel) with the fake browser chrome wrapping the iframe:

```html
<div class="assist-demo reveal">
  <div class="demo-stage">
    <div class="demo-toolbar"><div class="dots"><i></i><i></i><i></i></div><div class="u">ornek-belediye.gov.tr</div></div>
    <iframe class="demo-frame" src="/demo/ornek-site.html" title="Audera Assist canlı demo" loading="lazy" style="width:100%;height:420px;border:0;display:block;background:#fff"></iframe>
  </div>
</div>
```
Keep the `#assist` section heading/lead. If `.assist-cats` (the category chips below) is purely descriptive (not wired to the fake panel), you may keep it; if it depends on the removed panel JS, remove it. Read the markup and decide.

- [ ] **Step 3: Remove the dead fake-panel JS** in `apps/landing/landing.js` — the handlers for `.assist-panel`'s `data-step`/`data-dir`/`data-toggle`/`#assistReset` that mutated `#assistSample`. Remove that block (and any now-unreferenced helpers). Do NOT touch the theme toggle, reveal-on-scroll, nav, or form logic. Verify the file still parses (no syntax error) by loading the page or `node --check apps/landing/landing.js` if it's plain (it may use browser globals — `node --check` only checks syntax, which is fine).

- [ ] **Step 4: Commit**

```bash
git add apps/landing/demo/ornek-site.html apps/landing/index.html apps/landing/landing.js
git commit -m "feat(landing): live demo runs the real widget in an isolated iframe"
```

---

## Task 4: Dogfood — embed the real widget on the landing itself

**Files:** `apps/landing/index.html`

- [ ] **Step 1: Add the widget script** right before `</body>` (after the existing `<script src="landing/landing.js">`), so audera.kontent.com.tr runs Audera Assist on itself:

```html
<script src="/assist/a11yaudit-assist.js" data-position="bottom-right" data-language="tr" data-project="audera-site" defer></script>
```
This is separate from the demo iframe. The widget mounts in a Shadow DOM and applies to the landing page itself.

- [ ] **Step 2: Commit**

```bash
git add apps/landing/index.html
git commit -m "feat(landing): embed the real Audera widget on the landing (dogfood)"
```

---

## Task 5: Hero mock → dashboard-style replica

**Files:** `apps/landing/landing.js`, `apps/landing/landing.css`

Context: the hero `.hero-mock .window .console[data-full]` is filled by `landing.js` (a generic console mock). Make it visually match our real **Overview** page. Read our overview for the exact look: `apps/web/src/pages/overview.tsx` (score ring, severity meter + counts critical/serious/moderate/minor, stat cards: unique issues / affected pages / occurrences / critical, a recent-runs table) and the colors in `apps/web/src/design/tokens.css` / the report severity colors (critical `#c0392b`, serious `#e67e22`, moderate `#d4a017`, minor `#7f8c8d`; accent `#2b56b0`; score band ≥70 amber).

- [ ] **Step 1: Find the console renderer** in `landing.js` (the code that populates `.console[data-full]`). Replace its generated markup with a static replica of our overview:
  - a score block: ring showing **73** with the amber "Geliştirilmeli" band,
  - a small severity row (Kritik 8 · Ciddi 14 · Orta 9 · Düşük 5) using the severity colors,
  - 3–4 stat cards (Benzersiz sorun 36 · Etkilenen sayfa 11 · Tekrar 248 · Kritik 8),
  - 3 recent-run rows (id · durum · tarih) with a status pill.
  Keep it as inert markup (no live data). If the console is built in CSS only, add the markup in `landing.css`/`landing.js` accordingly. Match the design file's existing window/console styling shell; only the inner content changes to the dashboard replica.
  Update the window URL bar text to `audera.kontent.com.tr/app` (it currently reads `audera.app/projeler/...`).

- [ ] **Step 2: Style it** in `landing.css` — add the classes your replica uses (score ring via conic-gradient, severity dots, stat grid, run rows) so it reads like the real overview. Keep within the design's visual language (Geist, ink, the file's existing card/border tokens).

- [ ] **Step 3: Eyeball + commit.** Load `apps/landing/index.html` (or via the Task 6 server) and confirm the hero shows the dashboard-style replica. (No automated assertion needed; a light DOM check is added in Task 6's serving test.)

```bash
git add apps/landing/landing.js apps/landing/landing.css
git commit -m "feat(landing): hero mock shows an Audera dashboard-style overview replica"
```

---

## Task 6: Serve the landing at `/` from Fastify

**Files:** add `@fastify/static`; create `apps/server/src/routes/landing.ts`; modify `apps/server/src/app.ts`; test in `apps/server/src/app.test.ts`.

- [ ] **Step 1: Add the static plugin** — `npx pnpm@9 --filter @a11yaudit/server add @fastify/static`. (If the team prefers no new dep, serve raw files mirroring `routes/assist.ts`; but `@fastify/static` handles the directory + content-types cleanly. Prefer it.)

- [ ] **Step 2: Write `apps/server/src/routes/landing.ts`** — serve the `apps/landing` directory at `/`:

```ts
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function findLandingRoot(): string | null {
  let dir = HERE;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "apps/landing");
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

export async function registerLandingRoutes(server: FastifyInstance): Promise<void> {
  const root = findLandingRoot();
  if (root === null) {
    server.get("/", async (_req, reply) => reply.code(404).send({ error: "landing not built" }));
    return;
  }
  await server.register(fastifyStatic, {
    root,
    prefix: "/",
    index: ["index.html"],
    wildcard: false,
    decorateReply: true
  });
}
```
Notes: `@fastify/static` with `prefix:"/"` serves `index.html` at `/` and `landing/*`, `assets/*`, `demo/*` by path. Ensure it does NOT shadow `/api/*`, `/assist/*`, `/health`, `/app/*` (register those routes too; `@fastify/static` only serves files that exist, and these API routes are registered separately — but watch ordering: register API/assist/app routes so they take precedence, and `wildcard:false` avoids a catch-all). If a path collision appears, scope the static plugin or register it last with explicit non-overlap.

- [ ] **Step 3: Register** `await registerLandingRoutes(app);` in `buildServer` (after the API/assist/app routes so they win). Public, no auth, no CSRF (GET static).

- [ ] **Step 4: Tests** in `app.test.ts` (mirror the assist route test; the landing files exist after Task 1):

```ts
it("serves the landing page at /", async () => {
  const res = await server.inject({ method: "GET", url: "/" });
  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toContain("text/html");
  expect(res.body).toContain("Audera");        // the landing markup
  expect(res.body).not.toContain("Kamu kurumları, bankalar"); // trust line removed
  expect(res.body).toContain("/assist/a11yaudit-assist.js");  // dogfood embed present
});
it("serves the landing demo sample page", async () => {
  const res = await server.inject({ method: "GET", url: "/demo/ornek-site.html" });
  expect(res.statusCode).toBe(200);
  expect(res.body).toContain("/assist/a11yaudit-assist.js");
});
```
If the test server can't resolve the landing root in the test working dir, make `findLandingRoot` robust (it walks up from `import.meta.url`, which is stable). Confirm `/health`, `/api/...`, `/assist/...` still respond (add a quick assertion that `/health` is still 200, proving the static plugin didn't swallow them).

- [ ] **Step 5: Verify + commit**

`./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → 0; `./node_modules/.bin/vitest run apps/server` → PASS.

```bash
git add apps/server/src/routes/landing.ts apps/server/src/app.ts apps/server/src/app.test.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): serve the landing site at / (static)"
```

---

## Task 7: Move the dashboard SPA under `/app`

**Files:** `apps/web/vite.config.ts`, `apps/web/src/app.tsx`, web tests.

Context: `apps/web` `parsePath(window.location.pathname)` matches `/login`, `/signup`, `/workspaces`, `/invite/:token`, `/w/:slug/...`; `routePath` builds those; `setBrowserRoute` pushes them. The API base is origin-relative `/api/*` (unaffected by the SPA base). We prefix the SPA's client routes with `/app`.

- [ ] **Step 1: Vite base** — in `apps/web/vite.config.ts` set `base: "/app/"`:

```ts
export default defineConfig({
  base: "/app/",
  envPrefix: ["VITE_", "A11YAUDIT_SERVER_URL"],
  plugins: [react()]
});
```

- [ ] **Step 2: Prefix the client router** in `app.tsx`. Add a constant + helpers and use them at the three boundaries:

```ts
const BASE = "/app";
function stripBase(pathname: string): string {
  if (pathname === BASE) return "/";
  if (pathname.startsWith(BASE + "/")) return pathname.slice(BASE.length) || "/";
  return pathname;
}
```
  - `parsePath`: change its single caller and signature so it parses `stripBase(window.location.pathname)`. Simplest: keep `parsePath(pathname)` matching the un-prefixed paths, but call it as `parsePath(stripBase(window.location.pathname))` at the initial-state line (`useState(() => parsePath(stripBase(window.location.pathname)))`) and in the `popstate` handler (find it — it likely calls `parsePath(window.location.pathname)`; wrap with `stripBase`).
  - `routePath(route)`: prepend `BASE` to every returned path, i.e. `return BASE + "/login";` etc. (or wrap the whole function: compute the existing path then `return BASE + existing` where existing starts with `/`). Ensure `BASE + "/"`-style joins don't double-slash (e.g. for the bare `/` case return `BASE`).
  - `setBrowserRoute`: it compares `window.location.pathname !== nextPath` where `nextPath = routePath(...)` — now prefixed, so the comparison is correct against the real prefixed pathname.

- [ ] **Step 3: Update web tests** — `apps/web/src/pages/auth.test.tsx` and any test asserting `parsePath`/`routePath` raw values. `parsePath` now expects a base-stripped path (unchanged behavior if tests call it with `/login` directly — they still pass an un-prefixed path, which `parsePath` handles). `routePath` now returns `/app/...` — update any assertion on its output to include `/app`. If a test reads `window.location.pathname`, set it to `/app/...`. Run the web suite and fix only assertions that changed due to the prefix; do not weaken behavior.

- [ ] **Step 4: Verify**

`./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` → 0; `./node_modules/.bin/vitest run apps/web` → PASS; `npx pnpm@9 --filter @a11yaudit/web build` → built into `apps/web/dist` with `/app/` asset base (check `dist/index.html` references `/app/assets/...`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/vite.config.ts apps/web/src/app.tsx apps/web/src/pages/auth.test.tsx
git commit -m "feat(web): serve the dashboard under the /app base path"
```

---

## Task 8: Serve the web SPA at `/app/*`

**Files:** `apps/server/src/routes/landing.ts` (extend) or a new `routes/app-spa.ts`; `apps/server/src/app.ts`; test.

- [ ] **Step 1: Serve the built web at `/app`** with SPA fallback. Extend the server static serving: register a second `@fastify/static` (or a route) for the built `apps/web/dist` at prefix `/app/`, with a SPA fallback so any `/app/<anything>` that isn't a real asset returns the web `index.html` (the client router then renders it).

```ts
// in registerLandingRoutes (or a sibling), after locating apps/web/dist:
function findWebDist(): string | null {
  let dir = HERE;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "apps/web/dist");
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}
// register:
const webDist = findWebDist();
if (webDist) {
  await server.register(fastifyStatic, { root: webDist, prefix: "/app/", decorateReply: false });
  server.setNotFoundHandler(/* scoped to /app */);
}
```
Implement the SPA fallback correctly for `@fastify/static` v7 (use `reply.sendFile("index.html", webDist)` in a `/app/*` GET that didn't match a static asset, or the plugin's `wildcard`/`setNotFoundHandler` scoped to the `/app` prefix). Ensure the fallback ONLY applies to `/app/*` (not `/api`, `/assist`, `/`). If the web build is absent, `/app` returns 404 with a clear message (don't crash).

- [ ] **Step 2: Test** — build the web first in the test setup OR assert tolerant: `GET /app/` returns the web `index.html` (200, `text/html`, contains the `#root` div or the web title) when `apps/web/dist` exists; a deep link `GET /app/login` returns the same SPA shell (fallback). If staging the web build in tests is heavy, assert the route is registered and returns 404 with the documented message when the build is absent, plus the happy path guarded by a `beforeAll` that builds web or writes a fixture `apps/web/dist/index.html`. Pick the deterministic option; describe it.

- [ ] **Step 3: Verify + commit**

`./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → 0; `./node_modules/.bin/vitest run apps/server` → PASS.

```bash
git add apps/server/src/routes/landing.ts apps/server/src/app.ts apps/server/src/app.test.ts
git commit -m "feat(server): serve the dashboard SPA at /app with fallback"
```

---

## Task 9: Full build, suite, deployment docs

**Files:** `docs/deployment.md`

- [ ] **Step 1: Full build + suite** — `npx pnpm@9 -r build` (web builds with `/app/` base; assist bundle present) → all Done. `./node_modules/.bin/vitest run` → all PASS. Report counts.

- [ ] **Step 2: Deployment doc** — in `docs/deployment.md`, add a "Public site & routing" section: the Fastify server serves `/` → landing (`apps/landing`), `/app/*` → dashboard SPA (`apps/web/dist`, built with `base:"/app/"`), `/assist/*` → widget, `/api/*` → API. Visiting the root shows marketing; the dashboard is at `/app` behind login. Note the landing embeds the real widget (dogfood) and the live demo loads it in an iframe; the contact form is mailto-only (no backend yet).

- [ ] **Step 3: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: public site routing (/ landing, /app dashboard, /assist widget)"
```

---

## Notes for the implementer

- **The design is final** — do not restyle the landing. Only the four content edits (Tasks 2–5) change it; everything else is plumbing.
- **API is unaffected** — the SPA's API calls are origin-relative `/api/*`; the `/app` base only changes client routes + asset paths, not API URLs. Do not touch `api/client.ts` paths.
- **Route ordering** — register `/api`, `/assist`, `/app`, `/health` BEFORE the catch-all landing static at `/`, so the static plugin doesn't shadow them. Verify `/health` + `/api/...` + `/assist/...` still respond after adding the landing route (Task 6 test asserts `/health`).
- **The widget is same-origin** — both the demo iframe and the dogfood embed load `/assist/a11yaudit-assist.js` from the same server; no CORS concern (and the assist route already sends permissive CORS anyway).
- **Don't import the designer's `src/*.jsx`** — the real dashboard is `apps/web`.
- **Cookie path** — the session/CSRF cookies use path `/` (cover both `/app` and `/api`); no cookie-path change needed. Confirm login still works end-to-end under `/app` (the auth tests guard the client side).
