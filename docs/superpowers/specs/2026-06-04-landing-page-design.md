# Landing Page Design

Date: 2026-06-04

## Goal

Audera is moving from open-source to a small SaaS model. We need a public **landing page** at the site root that markets the product (WCAG 2.2 audit platform), and showcases the embeddable accessibility widget with a **live demo of its full feature set**. Entering the site (`/`) must now land on this marketing page — the dashboard no longer opens by default; it moves behind `/app` + login.

**Final design decision (locked):** we adopt the owner's existing design file `/Users/zasetsu/Downloads/A11yAudit-4/Audera.html` (+ its `landing/landing.css`, `landing/landing.js`, `assets/`) **verbatim as the visual design**. We do NOT redesign it. This spec is about (a) bringing it into the repo as a served landing app, (b) a small set of content edits, (c) wiring the real widget into the live demo + onto the page, and (d) the routing change. Prior brainstorm mockups/copy are discarded.

## What the design file is

`Audera.html` is a self-contained Turkish SaaS landing: sticky nav, hero (with a fake-browser "dashboard preview" mock), product explainer, features, "how it works", **Audera Assist** section (a live demo: a fake browser `demo-stage` + a hand-built accessibility `assist-panel` + category list), scope, sectors, FAQ, a contact form (`#contactForm`, mailto `merhaba@audera.app`), and footer. It loads `landing/landing.css` (32 KB), `landing/landing.js` (15 KB), `assets/favicon.svg`, and Google Fonts (Geist + IBM Plex Mono). It has a light/dark theme toggle (`audera-theme` in localStorage). The sibling `src/*.jsx` files are the designer's throwaway dashboard prototype — **ignored**; we have the real dashboard (`apps/web`).

## Architecture

A new **`apps/landing`** static site, served at `/` by the Fastify server; the dashboard SPA (`apps/web`) moves to `/app`; the widget bundle stays at `/assist/*`.

```
GET /            → apps/landing  (public marketing, this design file)
GET /app/*       → apps/web      (dashboard SPA, behind login)
GET /assist/...  → assist-widget bundle (already implemented)
```

- **`apps/landing`**: copy `Audera.html` → `index.html`, plus `landing/` (css/js), `assets/`. Self-contained static files (Fonts via CDN). No build step required beyond copying; optionally a trivial vite/static-copy build for fingerprinting later (out of scope now).
- **Serving:** the Fastify server gains static serving for the landing at `/` (and its `landing/*`, `assets/*` paths) and for the built web SPA under `/app` with SPA fallback (`/app/*` → web `index.html`). Reuse `@fastify/static` if already a dep, else read raw files (mirroring the `/assist` route pattern). Public, no auth, no CSRF (GET static).
- **Web app base path → `/app`:** `apps/web` Vite `base` becomes `/app/`; its router path parsing + `routePath`/`parsePath` + history pushState prefix with `/app`; the session cookie `path` and the `A11YAUDIT_WEB_ORIGIN`/redirect logic updated so login/app work under `/app`. The post-login destination and all internal links resolve under `/app`.
- Dev: `dev:web` serves the SPA (Vite at `/app/` base); the landing is served as static files; a dev convenience may proxy `/` → landing and `/app` → vite (documented), but production serving is via Fastify.

## Content edits (the only changes to the design)

1. **Hero dashboard preview → resemble OUR dashboard.** The hero mock (`.hero-mock .window .console[data-full]`, filled by `landing.js`) currently shows a generic/placeholder console. Make it visually match our real **Overview** page: an accessibility **score ring** (e.g. 73), the **severity** breakdown (critical/serious/moderate/minor), the **stat cards** (unique issues / affected pages / occurrences / critical), and a short **recent scan runs** list — using our dashboard's look (Audera ink/accent, the report's severity colors). It stays a static visual replica (no live data), edited in `landing.js`/`landing.css` to mirror `apps/web`'s overview, with the URL bar reading `audera.kontent.com.tr` style.

2. **Remove the trust line.** Delete `Kamu kurumları, bankalar, e-ticaret ve kurumsal ekipler için.` (the `.hero-trust` line in the hero).

3. **Live demo → the REAL widget, full feature set.** Replace the hand-built fake `assist-panel` (and its `landing.js` step/toggle logic) in the `#assist` section's `demo-stage` with an **`<iframe>`** that loads a small self-contained **sample page** which embeds the real widget via `<script src="/assist/a11yaudit-assist.js" data-language="tr" ...>`. The user interacts with the genuine Audera widget (all ~23 controls: content / reading & navigation / color) applied to the sample content, fully isolated inside the iframe. This guarantees the demo always matches the shipped widget (no drift) and showcases every feature. The sample page (e.g. `apps/landing/demo/ornek-site.html`) is a believable sample site (e.g. the municipal-services content already in the file) styled plainly. The `demo-toolbar`/`demo-stage` chrome around the iframe is kept.

4. **Dogfood embed.** The landing itself embeds the real widget (`<script src="/assist/a11yaudit-assist.js" data-position="bottom-right" data-language="tr" defer></script>`) so `audera.kontent.com.tr` runs Audera Assist on its own pages — the accessibility company eats its own dog food. This is separate from the demo iframe.

No other copy/layout/visual changes — the design is the owner's, kept as-is.

## Routing / default-entry change

- Visiting `/` serves the landing (not the dashboard).
- The dashboard + auth (`login`/`signup`/`workspaces`/`/w/:slug/...`) live under `/app`.
- The landing's "Taramaya başla" / nav CTAs link to `/app` (which shows login when unauthenticated).
- Existing dashboard sessions/links continue to work under the new `/app` prefix.

## Out of scope (future)

- **Contact form backend** — `#contactForm` stays as the design has it (mailto / no server handler). Wiring submissions to email/storage is later.
- The designer's `src/*.jsx` dashboard prototype (we use the real `apps/web`).
- Pricing logic / billing (the design's pricing/contact sections are static marketing).
- Landing build pipeline / asset fingerprinting / CDN / SEO beyond the file's existing meta.
- English localization of the landing (the file is Turkish; the widget + report are bilingual independently).
- Subdomain split (`app.` host) — we use path-based `/app`.

## Testing

- **Serving:** `GET /` returns the landing HTML (200, `text/html`); `GET /landing/landing.css` + `/assets/favicon.svg` resolve; `GET /app/` returns the web SPA shell; `GET /assist/a11yaudit-assist.js` still 200 (unchanged). Unauthenticated.
- **Routing:** the web app boots correctly under the `/app` base (its existing tests pass with the base path; `parsePath`/`routePath` round-trip with the `/app` prefix; a deep link like `/app/w/<slug>/scan-runs` resolves).
- **Content edits:** the `#assist` demo contains an `<iframe>` whose `src` points at the sample page that loads `/assist/a11yaudit-assist.js` (assert the iframe + script reference exist in the built landing); the removed trust line is absent; the landing page includes the dogfood widget script tag.
- **Hero mock:** a smoke check that the hero console renders the dashboard-style replica (score/severity/stat markup present) — light DOM assertion or visual fixture.
- **No regression:** `apps/web` + server suites stay green after the base-path move and the new static routes.
