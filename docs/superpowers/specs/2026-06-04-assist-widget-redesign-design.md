# Assist-Widget Redesign + Bilingual + Hosting Design

Date: 2026-06-04

## Goal

The embeddable accessibility widget (`packages/assist-widget`) works but looks rough: bare cards, blue label text, no per-feature icons, a harsh full-blue "pressed" fill, a literal `x` close button. This phase **visually refreshes** the panel, makes it **bilingual (Turkish default, English)**, and **serves the built bundle from the Audera server** so customers can embed it with one `<script>` tag.

The widget currently lives only on the stale `codex/add-accessibility-widget` branch (far behind `main` — it predates SaaS tenancy, the report redesign, localization, and repeat-scan diff). The package is self-contained, so this phase **ports it onto `main`** and does all work on current code.

Out of scope: the dashboard "copy embed snippet" configurator UI (needs the current web dashboard, deferred to a later phase), and any `projectId → backend` wiring (the widget stays 100% client-side; `data-project` remains an embedded label only).

## What the widget is (current state, preserved)

- A single self-contained **IIFE bundle** (`a11yaudit-assist.js`, vite lib build from `src/loader.ts`), Shadow-DOM mounted (`#aa-assist-root`), self-contained CSS, no external deps.
- Embedded via one script tag whose `data-*` attributes (`data-project`, `data-position`, `data-enabled-sections`) the loader reads from `document.currentScript` and auto-mounts.
- 100% client-side: preferences in `localStorage` (`aa-assist-preferences`), no network calls.
- Controls (unchanged set): **Content** (Line Height, Text Size, Large Cursor, Hide Images, Stop Animations, Hints, Fonts, Text Spacing, Text Alignment, Magnifier), **Reading & Navigation** (Page Reader, Reading Guide, Reading Mask, Highlight Links, Reading Mode, Mute Sound, Highlight Focus, Page Structure), **Color** (Monochrome, Saturation, Smart Contrast, Brightness, Contrast). Each is a toggle or a multi-step control. The Page Structure list (headings/links/landmarks) stays.

**Behavior, logic, managers, effects, state, persistence — all unchanged.** This phase touches presentation (`ui/panel.ts`, `ui/styles.ts`), adds an i18n module + locale plumbing, and adds a server route.

## Part 1 — Port to `main`

Copy `packages/assist-widget/` (source only, not `dist/`) from the `codex/add-accessibility-widget` worktree onto the new `feature/assist-widget-redesign` branch. Wire it into the pnpm workspace (`apps/*`, `packages/*` already globbed) and the root build/test scripts (it builds via its own `vite` build + has vitest tests). Confirm a clean `pnpm build` + `pnpm test` includes it. No code changes in the port commit beyond what's needed to build on current toolchain.

## Part 2 — Visual redesign (direction B, Audera accent)

Approved direction: **icon tiles**. The 2-column grid stays; each control tile gains a leading icon and a clearer state. Accent = **Audera `#2b56b0`** (matches the dashboard), tint `#eef1fb`.

### Control tile (`renderControl` + CSS)
- Top row: a **tinted icon chip** (left, 30×30, rounded) + a **state pill** (right): `Off` / `On` for toggles, the step value label (`Large`, `slow`, `dyslexia`, `start`, …) for steps.
- Below: the control **label**.
- **Active** (`aria-pressed="true"` / step > 0): Audera accent **1px ring** + faint accent **tint** background + **filled** accent chip + filled accent pill. No full-blue fill (the old harsh state) — text stays dark for contrast.
- Min height ~82px, generous padding, rounded `12px`.

### Per-feature icons (`ui/icons.ts`)
- An **icon registry**: a `Record<PreferencePath, string>` (or keyed by feature) of inline SVG strings (outline/stroke style, `currentColor`, 18–20px). Inline → Shadow-DOM safe, no font/CDN. One icon per control (~23) + a header brand glyph and a launcher glyph and a close `×` glyph.
- A small `icon(path)` helper returns the SVG markup (or a `<span>` containing it) for `renderControl` to insert into the chip.

### Header / footer / launcher
- **Header:** accent badge (brand glyph) + title + a **round icon `×`** button (replaces the literal `x` text); keeps `aria-label`.
- **Footer:** the existing Clear action, restyled as a restrained outline button; optionally a primary "Done/Close" button (close the panel). Keep existing actions/handlers.
- **Launcher:** the floating button uses the accent + a clearer accessibility glyph (replaces the current font-glyph).

### Styles (`ui/styles.ts`)
- Rewrite `WIDGET_CSS` for the above. Keep the `:host` positioning, focus-visible rules, and the structure-list styles. `PAGE_EFFECT_CSS` (the effects applied to the host page) is **unchanged**.

### Accessibility of the widget itself (hard requirements — this is an a11y tool)
- **AA contrast** on all text, icons, pills (dark text on light tiles; accent-on-white meets AA for the chip/pill states).
- **State never by color alone**: the pill text (`On`/`Off`/value) + the ring convey state independently of hue.
- **focus-visible** ring on every interactive element (keep the current strong outline).
- **Target size** ≥ 24×24 (tiles are large; the close/launcher ≥ 32).
- Respect **`prefers-reduced-motion`** for any added transitions (hover/active) — no motion when the user opts out.
- Preserve every `aria-pressed`, `aria-label`, `role="dialog"`/`aria-modal`, and the `data-aa-assist-path` / `data-aa-assist-action` hooks the tests and handlers rely on.

## Part 3 — Bilingual (TR default, EN)

### Locale resolution (`loader.ts` + `config.ts`)
- `language: "tr" | "en"`. The `LoaderOptions.language` type widens from `"en"` to `"tr" | "en"`.
- Resolution order: (1) `data-language` attribute on the embed script (`"tr"`/`"en"`); else (2) sniff `document.documentElement.lang` — if it starts with `en` → `"en"`; else (3) **default `"tr"`**.
- Thread the resolved locale through `initAssistWidget` → `mountAssistWidget` → `renderPanel`.

### String catalog (`ui/messages.ts`)
- `export type WidgetLocale = "tr" | "en";`
- A typed `WidgetStrings` interface + `WIDGET_MESSAGES: Record<WidgetLocale, WidgetStrings>` covering **every** visible string:
  - Header title, close `aria-label`, clear/done labels + `aria-label`s.
  - Section titles (Content / Reading & Navigation / Color).
  - All ~23 control labels.
  - Value labels: toggle `On`/`Off`; step labels per stepped control — line-height/text-size/spacing generic step names, **Page Reader** (`slow`/`normal`/`fast`), **Fonts** (`dyslexia`/`readable`/`bionic`), **Text Alignment** (`start`/`center`/`end`), and color steps.
  - Page Structure group titles (`Headings`/`Links`/`Landmarks`) + its `aria-label`.
- `renderPanel` takes the resolved `strings` (or locale) and replaces every inline English literal with a catalog lookup. Icons are locale-independent.
- The widget root container gets `lang={locale}` set for correct screen-reader pronunciation.

Turkish is authored naturally (e.g. Text Size → "Yazı Boyutu", Hide Images → "Görselleri Gizle", Reading Guide → "Okuma Kılavuzu", Page Reader → "Sayfa Okuyucu", slow/normal/fast → "yavaş/normal/hızlı"). English values equal the current labels.

## Part 4 — Hosting on the Audera server

Serve the built bundle from the Fastify server so the embed `src` points at the Audera origin (self-hosted, no CDN).

- **Route:** `GET /assist/a11yaudit-assist.js` → streams `packages/assist-widget/dist/a11yaudit-assist.js`; `GET /assist/a11yaudit-assist.js.map` → the sourcemap.
- **Headers:** `Content-Type: text/javascript; charset=utf-8`; `Access-Control-Allow-Origin: *` (the script is loaded cross-origin from customer sites; this static asset carries no credentials/secrets, so `*` is safe and required); a long `Cache-Control` (e.g. `public, max-age=3600`) — versioning/cache-busting can come later.
- **Public + CSRF-exempt:** these GETs are unauthenticated and exempt from auth/CSRF (like `/health`). They expose only the public widget bundle.
- The route reads the file from the built package path resolved at runtime; if the bundle is missing (not built), respond `404` with a clear message rather than crashing. The server build/start docs note that `assist-widget` must be built (`pnpm build`) for the route to serve.
- The embed snippet customers use:
  ```html
  <script src="https://<A11YAUDIT_SERVER_URL>/assist/a11yaudit-assist.js"
          data-project="<projectId>" data-position="bottom-right" data-language="tr" defer></script>
  ```

## Architecture / files

- **Port:** `packages/assist-widget/**` (source) onto `main`.
- **`packages/assist-widget/src/ui/icons.ts`** (new) — inline-SVG icon registry + `icon()` helper.
- **`packages/assist-widget/src/ui/messages.ts`** (new) — `WidgetLocale`, `WidgetStrings`, `WIDGET_MESSAGES`, a `t`/resolver.
- **`packages/assist-widget/src/ui/panel.ts`** — render icons + state pills + localized strings; keep DOM hooks + aria.
- **`packages/assist-widget/src/ui/styles.ts`** — `WIDGET_CSS` rewrite (B + Audera). `PAGE_EFFECT_CSS` untouched.
- **`packages/assist-widget/src/loader.ts` / `config.ts` / `widget.ts`** — locale type + resolution + threading.
- **`apps/server/src/routes/assist.ts`** (new) + registration — the static bundle route.

## Testing

- **Widget catalog:** `WIDGET_MESSAGES.tr` and `.en` have identical key sets; no empty values.
- **Locale resolution:** `data-language` wins; `<html lang="en">` → en; otherwise tr (default). Unit-test `parseLoaderOptions` / the resolver.
- **Panel render:** default (tr) renders Turkish labels (e.g. "Yazı Boyutu"); forcing `en` renders English; each control renders its icon (an `<svg>` in the chip); `aria-pressed`/`data-aa-assist-path` hooks preserved (existing `widget.test`/`state`/`loader` stay green — update only DOM-structure assertions that the icon element changes).
- **State styling:** active control has `aria-pressed="true"` and the active class/markup; the state pill text reflects on/off/step (not color-only).
- **Server route:** `GET /assist/a11yaudit-assist.js` returns 200 with `text/javascript` + `Access-Control-Allow-Origin: *` when the bundle exists; 404 when missing; is reachable without auth and is CSRF-exempt.
- **Accessibility checks** (manual via `fixtures/`): keyboard focus visible, contrast, reduced-motion.

## Out of scope (future)

- Dashboard "copy embed snippet" configurator page (needs the current web dashboard).
- `projectId` → server config/analytics/gating; per-project remote settings.
- Widget bundle versioning / cache-busting / CDN.
- Dark-mode panel; RTL; locales beyond tr/en.
