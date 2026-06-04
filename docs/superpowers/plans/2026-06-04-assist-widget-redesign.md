# Assist-Widget Redesign + Bilingual + Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the embeddable accessibility widget onto `main`, give it an icon-tile visual refresh with the Audera accent, make it bilingual (Turkish default / English), and serve the bundle from the Fastify server.

**Architecture:** `packages/assist-widget` is a self-contained vite IIFE bundle (Shadow-DOM, no deps). We port it as-is, then layer: an inline-SVG icon registry, a TR/EN message catalog + `data-language` locale resolution, a restyled panel (`ui/styles.ts` + `ui/panel.ts`), and a public Fastify route that streams the built bundle.

**Tech Stack:** TypeScript (ESM, explicit `.js` import extensions), vite (lib/IIFE build), Vitest (+ Playwright e2e for the widget), Fastify.

**Conventions:** From repo root `/Users/zasetsu/Documents/GitHub/WCAG`. Tests: `./node_modules/.bin/vitest`. Typecheck a package: `./node_modules/.bin/tsc -p <pkg>/tsconfig.json --noEmit`. Build a package: `npx pnpm@9 --filter <pkg> build`. The widget source to port lives in the worktree `~/.codex/worktrees/fb69/WCAG/packages/assist-widget` (branch `codex/add-accessibility-widget`).

---

## File Structure

- **Port** `packages/assist-widget/**` (source, configs, tests, fixtures — NOT `dist/`) onto `feature/assist-widget-redesign`.
- **New** `packages/assist-widget/src/ui/icons.ts` — inline-SVG icon registry keyed by control + an `icon()` helper.
- **New** `packages/assist-widget/src/ui/messages.ts` — `WidgetLocale`, `WidgetStrings`, `WIDGET_MESSAGES` (tr/en), `resolveWidgetStrings`.
- **Modify** `packages/assist-widget/src/config.ts` — locale type + default.
- **Modify** `packages/assist-widget/src/loader.ts` — read `data-language`, resolve default tr.
- **Modify** `packages/assist-widget/src/widget.ts` — thread `language` to `renderPanel`.
- **Modify** `packages/assist-widget/src/ui/panel.ts` — localized strings + icon chip + state pill markup.
- **Modify** `packages/assist-widget/src/ui/styles.ts` — `WIDGET_CSS` rewrite (icon tiles, Audera accent). `PAGE_EFFECT_CSS` untouched.
- **Modify** `packages/assist-widget/src/widget.test.ts` — force `en` for the English assertions + add a tr-default assertion.
- **New** `apps/server/src/routes/assist.ts` + registration in the server — public static-bundle route.

---

## Task 1: Port the widget package onto `main`

**Files:** copy `packages/assist-widget/` from the worktree into this branch.

- [ ] **Step 1: Copy the source** (exclude build output)

```bash
SRC=~/.codex/worktrees/fb69/WCAG/packages/assist-widget
DST=/Users/zasetsu/Documents/GitHub/WCAG/packages/assist-widget
mkdir -p "$DST"
rsync -a --exclude dist --exclude node_modules "$SRC/" "$DST/"
ls "$DST" "$DST/src" "$DST/src/ui" "$DST/src/managers" "$DST/src/effects"
```

- [ ] **Step 2: Confirm workspace + scripts pick it up**

The root `pnpm-workspace.yaml` already globs `packages/*`. Run `npx pnpm@9 install` so the new package is linked. Read `packages/assist-widget/package.json` — confirm its `name` (e.g. `@a11yaudit/assist-widget`), `build` (vite), and `test` (vitest) scripts. If the package name collides or the `scripts` differ from the repo convention, align them minimally (do NOT rewrite the package).

- [ ] **Step 3: Build + typecheck + test the ported package as-is**

Run, in order:
- `npx pnpm@9 --filter @a11yaudit/assist-widget build` (use the real package name) → produces `packages/assist-widget/dist/a11yaudit-assist.js`.
- `./node_modules/.bin/tsc -p packages/assist-widget/tsconfig.json --noEmit` → 0 errors.
- `./node_modules/.bin/vitest run packages/assist-widget` → existing unit tests pass. NOTE: `widget.test.ts` / `widget-e2e.test.ts` are Playwright e2e tests that launch a browser; if the e2e harness is not available in this environment they may be skipped or need `npx playwright install`. If they cannot run here, run the non-e2e unit tests (`state.test.ts`, `loader.test.ts`) and report the e2e status. Do not modify tests in this task.

- [ ] **Step 4: Confirm the full monorepo still builds/tests**

`npx pnpm@9 -r build` → all Done. `./node_modules/.bin/vitest run` → green (the widget's unit tests included).

- [ ] **Step 5: Commit**

```bash
git add packages/assist-widget pnpm-lock.yaml
git commit -m "chore(assist-widget): port package onto main (no behavior change)"
```

> If `dist/` accidentally got copied or generated, ensure it is gitignored (the repo ignores `dist/`); do not commit build output.

---

## Task 2: Bilingual catalog + locale resolution

**Files:**
- Create: `packages/assist-widget/src/ui/messages.ts`
- Create: `packages/assist-widget/src/ui/messages.test.ts`
- Modify: `packages/assist-widget/src/config.ts`, `loader.ts`, `widget.ts`
- Test: `packages/assist-widget/src/loader.test.ts`

> **Do Step 3 (config locale type) BEFORE Step 1** — `messages.ts` imports `WidgetLocale` from `config.ts`. `WidgetLocale` is defined ONCE, in `config.ts`. Everything in this task lands in one commit, so the within-task order is: config type → messages → icons-independent.

- [ ] **Step 1: Write the catalog** `packages/assist-widget/src/ui/messages.ts`:

```ts
import type { WidgetLocale } from "../config.js";
export type { WidgetLocale };

export interface WidgetStrings {
  title: string;
  closeAria: string;
  clear: string;
  launcherOpen: string;
  launcherClose: string;
  sections: { content: string; navigation: string; color: string };
  controls: Record<string, string>; // keyed by PreferencePath, e.g. "content.textSize"
  values: {
    on: string;
    off: string;
    stepOff: string;
    step: (n: number) => string;
    pageReader: [string, string, string]; // slow, normal, fast
    fonts: [string, string, string];      // dyslexia, readable, bionic
    alignment: [string, string, string];  // start, center, end
  };
  structure: { headings: string; links: string; landmarks: string; aria: string };
}

const CONTROL_KEYS = [
  "content.lineHeight", "content.textSize", "content.largeCursor", "content.hideImages",
  "content.stopAnimations", "content.hints", "content.fonts", "content.textSpacing",
  "content.textAlignment", "content.magnifier",
  "navigation.pageReader", "navigation.readingGuide", "navigation.readingMask",
  "navigation.highlightLinks", "navigation.readingMode", "navigation.muteSound",
  "navigation.highlightFocus", "navigation.pageStructure",
  "color.monochrome", "color.saturation", "color.smartContrast", "color.brightness", "color.contrast"
] as const;

export const WIDGET_MESSAGES: Record<WidgetLocale, WidgetStrings> = {
  tr: {
    title: "Erişilebilirlik Tercihleri",
    closeAria: "Erişilebilirlik tercihlerini kapat",
    clear: "Tercihleri Temizle",
    launcherOpen: "Erişilebilirlik tercihlerini aç",
    launcherClose: "Erişilebilirlik tercihlerini kapat",
    sections: { content: "İçerik", navigation: "Okuma ve Gezinme", color: "Renk" },
    controls: {
      "content.lineHeight": "Satır Yüksekliği",
      "content.textSize": "Yazı Boyutu",
      "content.largeCursor": "Büyük İmleç",
      "content.hideImages": "Görselleri Gizle",
      "content.stopAnimations": "Animasyonları Durdur",
      "content.hints": "İpuçları",
      "content.fonts": "Yazı Tipi",
      "content.textSpacing": "Metin Aralığı",
      "content.textAlignment": "Metin Hizalama",
      "content.magnifier": "Büyüteç",
      "navigation.pageReader": "Sayfa Okuyucu",
      "navigation.readingGuide": "Okuma Kılavuzu",
      "navigation.readingMask": "Okuma Maskesi",
      "navigation.highlightLinks": "Bağlantıları Vurgula",
      "navigation.readingMode": "Okuma Modu",
      "navigation.muteSound": "Sesi Kapat",
      "navigation.highlightFocus": "Odağı Vurgula",
      "navigation.pageStructure": "Sayfa Yapısı",
      "color.monochrome": "Tek Renk",
      "color.saturation": "Doygunluk",
      "color.smartContrast": "Akıllı Kontrast",
      "color.brightness": "Parlaklık",
      "color.contrast": "Kontrast"
    },
    values: {
      on: "Açık", off: "Kapalı", stepOff: "kapalı", step: (n) => `adım ${n}`,
      pageReader: ["yavaş", "normal", "hızlı"],
      fonts: ["disleksi", "okunaklı", "biyonik"],
      alignment: ["başa", "ortaya", "sona"]
    },
    structure: { headings: "Başlıklar", links: "Bağlantılar", landmarks: "Yer İmleri", aria: "Sayfa Yapısı" }
  },
  en: {
    title: "Accessibility Preferences",
    closeAria: "Close accessibility preferences",
    clear: "Clear Preferences",
    launcherOpen: "Open accessibility preferences",
    launcherClose: "Close accessibility preferences",
    sections: { content: "Content", navigation: "Reading & Navigation", color: "Color" },
    controls: {
      "content.lineHeight": "Line Height",
      "content.textSize": "Text Size",
      "content.largeCursor": "Large Cursor",
      "content.hideImages": "Hide Images",
      "content.stopAnimations": "Stop Animations",
      "content.hints": "Hints",
      "content.fonts": "Fonts",
      "content.textSpacing": "Text Spacing",
      "content.textAlignment": "Text Alignment",
      "content.magnifier": "Magnifier",
      "navigation.pageReader": "Page Reader",
      "navigation.readingGuide": "Reading Guide",
      "navigation.readingMask": "Reading Mask",
      "navigation.highlightLinks": "Highlight Links",
      "navigation.readingMode": "Reading Mode",
      "navigation.muteSound": "Mute Sound",
      "navigation.highlightFocus": "Highlight Focus",
      "navigation.pageStructure": "Page Structure",
      "color.monochrome": "Monochrome",
      "color.saturation": "Saturation",
      "color.smartContrast": "Smart Contrast",
      "color.brightness": "Brightness",
      "color.contrast": "Contrast"
    },
    values: {
      on: "On", off: "Off", stepOff: "off", step: (n) => `step ${n}`,
      pageReader: ["slow", "normal", "fast"],
      fonts: ["dyslexia", "readable", "bionic"],
      alignment: ["start", "center", "end"]
    },
    structure: { headings: "Headings", links: "Links", landmarks: "Landmarks", aria: "Page Structure" }
  }
};

export const WIDGET_CONTROL_KEYS = CONTROL_KEYS;

export function resolveWidgetStrings(locale: WidgetLocale): WidgetStrings {
  return WIDGET_MESSAGES[locale];
}
```

- [ ] **Step 2: Catalog test** `packages/assist-widget/src/ui/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WIDGET_MESSAGES, WIDGET_CONTROL_KEYS } from "./messages.js";

describe("widget messages", () => {
  it("defines every control label in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      for (const key of WIDGET_CONTROL_KEYS) {
        expect(WIDGET_MESSAGES[locale].controls[key], `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it("has matching control key sets across locales", () => {
    expect(Object.keys(WIDGET_MESSAGES.tr.controls).sort()).toEqual(Object.keys(WIDGET_MESSAGES.en.controls).sort());
  });

  it("renders the Turkish title by default catalog", () => {
    expect(WIDGET_MESSAGES.tr.title).toBe("Erişilebilirlik Tercihleri");
    expect(WIDGET_MESSAGES.en.title).toBe("Accessibility Preferences");
  });
});
```

Run `./node_modules/.bin/vitest run packages/assist-widget/src/ui/messages.test.ts` → PASS.

- [ ] **Step 3: Locale type + default** — in `packages/assist-widget/src/config.ts` add:

```ts
export const WIDGET_LOCALES = ["tr", "en"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];
export const DEFAULT_WIDGET_LOCALE: WidgetLocale = "tr";
```

- [ ] **Step 4: Resolve locale in the loader** — in `loader.ts`:
  - Change `LoaderOptions.language` type from `"en"` to `WidgetLocale` (import it from `./config.js`).
  - In `parseLoaderOptions`, replace `language: "en"` with a resolver:

```ts
function resolveLanguage(script: HTMLScriptElement): WidgetLocale {
  const explicit = script.dataset.language;
  if (explicit === "tr" || explicit === "en") return explicit;
  const htmlLang = (typeof document !== "undefined" ? document.documentElement.lang : "").toLowerCase();
  if (htmlLang.startsWith("en")) return "en";
  return DEFAULT_WIDGET_LOCALE; // "tr"
}
```
  and set `language: resolveLanguage(script)`. In `initAssistWidget`, stop hardcoding `language: "en"` — pass `options.language ?? DEFAULT_WIDGET_LOCALE` into `mountAssistWidget`.

- [ ] **Step 5: Thread to the panel** — in `widget.ts`:
  - `AssistWidgetOptions.language?: "en"` → `language?: WidgetLocale` (import from config).
  - Where it calls `renderPanel({ … })`, pass `strings: resolveWidgetStrings(options.language ?? DEFAULT_WIDGET_LOCALE)` (import `resolveWidgetStrings`). Also set the panel/root container `lang` attribute to the locale (e.g. `panel.setAttribute("lang", locale)` or on the host element).

- [ ] **Step 6: Update `loader.test.ts`** — it asserts `language: "en"`. Add/adjust cases: a script with `data-language="en"` → `"en"`; with `data-language="tr"` → `"tr"`; with none and `<html lang>` unset → `"tr"` (default). Keep other assertions. Run `./node_modules/.bin/vitest run packages/assist-widget/src/loader.test.ts`.

> NOTE: `panel.ts` still uses inline English here; it gets localized in Task 4. To keep this task green, `renderPanel` may accept an optional `strings` it doesn't fully use yet — OR do the panel localization in this task. Prefer: add the `strings` param to `PanelOptions` now (Task 4 consumes it). Typecheck must stay green: `./node_modules/.bin/tsc -p packages/assist-widget/tsconfig.json --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add packages/assist-widget/src/ui/messages.ts packages/assist-widget/src/ui/messages.test.ts packages/assist-widget/src/config.ts packages/assist-widget/src/loader.ts packages/assist-widget/src/loader.test.ts packages/assist-widget/src/widget.ts
git commit -m "feat(assist-widget): TR/EN message catalog + data-language resolution (default tr)"
```

---

## Task 3: Icon registry

**Files:**
- Create: `packages/assist-widget/src/ui/icons.ts`
- Create: `packages/assist-widget/src/ui/icons.test.ts`

- [ ] **Step 1: Write the registry** `packages/assist-widget/src/ui/icons.ts`. Each value is an inline SVG string (outline, `currentColor`, 20×20 viewBox). Keyed by the same `PreferencePath` strings as the catalog, plus `header`, `launcher`, `close`.

```ts
const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const WIDGET_ICONS: Record<string, string> = {
  "content.lineHeight": svg(`<path d="M5 6h14M5 12h14M5 18h14"/><path d="M3 7l1.5-1.5M3 11l1.5 1.5"/>`),
  "content.textSize": svg(`<path d="M4 7h16M9 7v10"/><path d="M14 11h6M17 11v6"/>`),
  "content.largeCursor": svg(`<path d="M5 3l14 7-6 2-2 6z"/>`),
  "content.hideImages": svg(`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/><path d="M3 3l18 18"/>`),
  "content.stopAnimations": svg(`<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/>`),
  "content.hints": svg(`<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 00-4-10z"/>`),
  "content.fonts": svg(`<path d="M5 16V6h8M8 11h4M14 18l3-8 3 8M15 15h4"/>`),
  "content.textSpacing": svg(`<path d="M4 7h16M4 12h16M4 17h16"/><path d="M20 4l2 2-2 2"/>`),
  "content.textAlignment": svg(`<path d="M4 6h16M4 12h10M4 18h16"/>`),
  "content.magnifier": svg(`<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5M11 8v6M8 11h6"/>`),
  "navigation.pageReader": svg(`<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 010 6M18 7a8 8 0 010 10"/>`),
  "navigation.readingGuide": svg(`<path d="M3 12h18M6 9l-2 3 2 3M18 9l2 3-2 3"/>`),
  "navigation.readingMask": svg(`<rect x="3" y="9" width="18" height="6" rx="1"/><path d="M3 4h18M3 20h18"/>`),
  "navigation.highlightLinks": svg(`<path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/>`),
  "navigation.readingMode": svg(`<path d="M4 5h11M4 9h11M4 13h7"/><rect x="14" y="13" width="6" height="7" rx="1"/>`),
  "navigation.muteSound": svg(`<path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 9l4 6M21 9l-4 6"/>`),
  "navigation.highlightFocus": svg(`<circle cx="12" cy="12" r="3"/><rect x="4" y="4" width="16" height="16" rx="2"/>`),
  "navigation.pageStructure": svg(`<path d="M4 6h4M4 12h4M4 18h4M11 6h9M11 12h9M11 18h9"/>`),
  "color.monochrome": svg(`<circle cx="12" cy="12" r="9"/>`),
  "color.saturation": svg(`<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>`),
  "color.smartContrast": svg(`<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none"/>`),
  "color.brightness": svg(`<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>`),
  "color.contrast": svg(`<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none"/>`),
  header: svg(`<circle cx="12" cy="12" r="9"/><path d="M12 8v.5M9.5 11.5h5M12 11.5V16"/>`),
  launcher: svg(`<circle cx="12" cy="7" r="2"/><path d="M5 9h14M12 9v5M12 14l-3 6M12 14l3 6"/>`),
  close: svg(`<path d="M6 6l12 12M18 6L6 18"/>`)
};

export function widgetIcon(key: string): string {
  return WIDGET_ICONS[key] ?? "";
}
```

- [ ] **Step 2: Test** `packages/assist-widget/src/ui/icons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WIDGET_ICONS } from "./icons.js";
import { WIDGET_CONTROL_KEYS } from "./messages.js";

describe("widget icons", () => {
  it("provides an svg icon for every control", () => {
    for (const key of WIDGET_CONTROL_KEYS) {
      expect(WIDGET_ICONS[key], key).toMatch(/^<svg/);
    }
  });
  it("provides header/launcher/close icons", () => {
    for (const key of ["header", "launcher", "close"]) {
      expect(WIDGET_ICONS[key], key).toMatch(/^<svg/);
    }
  });
});
```

Run it → PASS. Typecheck → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/assist-widget/src/ui/icons.ts packages/assist-widget/src/ui/icons.test.ts
git commit -m "feat(assist-widget): per-feature inline SVG icon registry"
```

---

## Task 4: Visual redesign (panel + styles, localized, with icons)

**Files:**
- Modify: `packages/assist-widget/src/ui/styles.ts` (WIDGET_CSS rewrite)
- Modify: `packages/assist-widget/src/ui/panel.ts`
- Modify: `packages/assist-widget/src/widget.test.ts`

- [ ] **Step 1: Rewrite `WIDGET_CSS`** in `styles.ts` (keep `PAGE_EFFECT_CSS` exactly as-is). Replace the `WIDGET_CSS` template with the icon-tile, Audera-accent design. Keep the `:host` positioning block and the `*{box-sizing}` rule from the original; replace the launcher/panel/header/control/footer/structure rules with:

```css
:host { --aa-acc:#2b56b0; --aa-acc-bg:#eef1fb; }
.aa-assist-launcher {
  width:52px;height:52px;border:0;border-radius:14px;background:var(--aa-acc);color:#fff;cursor:pointer;
  display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(43,86,176,.34);
}
.aa-assist-launcher svg,.aa-assist-close svg,.aa-assist-control svg,.aa-assist-header-badge svg { display:block; }
.aa-assist-launcher:focus-visible,.aa-assist-control:focus-visible,.aa-assist-clear:focus-visible,
.aa-assist-close:focus-visible,.aa-assist-structure-item:focus-visible { outline:3px solid #111827; outline-offset:3px; }
.aa-assist-panel {
  width:min(420px,calc(100vw - 32px));max-height:min(720px,calc(100vh - 32px));overflow:auto;margin-bottom:10px;
  background:#fff;color:#111827;border:1px solid #e6e7eb;border-radius:16px;box-shadow:0 20px 50px rgba(17,24,39,.18);
}
:host([data-position^="top"]) .aa-assist-panel { margin-top:10px;margin-bottom:0; }
.aa-assist-header { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #f0f1f4; }
.aa-assist-header-left { display:flex;align-items:center;gap:10px; }
.aa-assist-header-badge { width:30px;height:30px;border-radius:8px;background:var(--aa-acc);color:#fff;display:flex;align-items:center;justify-content:center; }
.aa-assist-title { margin:0;font-size:16px;line-height:1.25;font-weight:700; }
.aa-assist-close { width:32px;height:32px;border:1px solid #e6e7eb;border-radius:8px;background:#fff;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center; }
.aa-assist-body { padding:14px 18px 18px; }
.aa-assist-section { margin-top:14px; }
.aa-assist-section:first-of-type { margin-top:2px; }
.aa-assist-section-title { margin:0 0 9px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;font-weight:700;color:#9097a1; }
.aa-assist-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px; }
.aa-assist-control {
  min-height:82px;border:1px solid #e6e7eb;border-radius:12px;background:#fff;color:#111827;cursor:pointer;
  display:flex;flex-direction:column;justify-content:space-between;gap:9px;padding:11px 12px;font:inherit;text-align:left;
}
.aa-assist-control-top { display:flex;align-items:center;justify-content:space-between; }
.aa-assist-control-chip { width:30px;height:30px;border-radius:9px;background:var(--aa-acc-bg);color:var(--aa-acc);display:flex;align-items:center;justify-content:center;flex:none; }
.aa-assist-control-value { font-size:11px;font-weight:600;color:#7c828c;background:#f3f4f6;border-radius:999px;padding:2px 9px; }
.aa-assist-control-label { font-size:13.5px;line-height:1.2;font-weight:600; }
.aa-assist-control[aria-pressed="true"] { border-color:var(--aa-acc);background:#f5f8ff;box-shadow:inset 0 0 0 1px var(--aa-acc); }
.aa-assist-control[aria-pressed="true"] .aa-assist-control-chip { background:var(--aa-acc);color:#fff; }
.aa-assist-control[aria-pressed="true"] .aa-assist-control-value { background:var(--aa-acc);color:#fff; }
.aa-assist-footer { display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid #f0f1f4; }
.aa-assist-clear { min-height:38px;border:1px solid #e6e7eb;border-radius:9px;background:#fff;color:#111827;cursor:pointer;font:inherit;font-weight:600;padding:0 14px; }
.aa-assist-structure { margin:10px 18px 0;padding:10px;border:1px solid #e6e7eb;border-radius:12px;background:#fff; }
.aa-assist-structure-group + .aa-assist-structure-group { margin-top:10px; }
.aa-assist-structure-title { margin:0 0 6px;font-size:12px;font-weight:700;color:#374151; }
.aa-assist-structure-list { display:grid;gap:4px; }
.aa-assist-structure-item { min-height:32px;border:1px solid #e6e7eb;border-radius:8px;background:#fff;color:#111827;cursor:pointer;font:inherit;font-size:12px;padding:6px 8px;text-align:left; }
@media (prefers-reduced-motion: reduce) { .aa-assist-launcher,.aa-assist-control,.aa-assist-close { transition:none !important; } }
```

(Preserve the original `:host`, `:host([data-position=...])`, and `*{box-sizing:border-box}` blocks above this.)

- [ ] **Step 2: Localize + add icons in `panel.ts`**. `PanelOptions` gains `strings: WidgetStrings` (import from `./messages.js`) and a `locale`. Replace the inline English + value-label functions with catalog lookups, and inject the icon. Key edits:
  - Import: `import { widgetIcon } from "./icons.js";` and `import type { WidgetStrings } from "./messages.js";`.
  - Header: title text `options.strings.title`; badge element with `widgetIcon("header")`; close button uses `widgetIcon("close")` (set via `innerHTML` of a span) and `aria-label = options.strings.closeAria`. Wrap title+badge in `.aa-assist-header-left`.
  - Section calls: pass `options.strings.sections.content` / `.navigation` / `.color` instead of the English literals. Wrap controls in a `.aa-assist-body` container if needed for the new padding (or keep sections directly under panel — match the CSS: the CSS expects `.aa-assist-section` under the panel; a `.aa-assist-body` wrapper is optional. If you add it, append sections to it and the body to the panel.)
  - Control labels: use `options.strings.controls[control.path]` for the label (the `control.label` becomes the path-derived localized string). The `step`/`toggle` builders no longer carry English labels — they carry the `path`, and `renderControl` resolves the label from `strings.controls[path]`.
  - Value labels: replace `defaultStepLabel`/`pageReaderLabel`/`fontLabel`/`alignmentLabel` with functions that read `options.strings.values`:
    - toggle: `enabled ? strings.values.on : strings.values.off`
    - generic step: `step === 0 ? strings.values.stepOff : strings.values.step(step)`
    - pageReader: `step === 0 ? strings.values.stepOff : strings.values.pageReader[step - 1]`
    - fonts: `step === 0 ? strings.values.stepOff : strings.values.fonts[step - 1]`
    - alignment: `step === 0 ? strings.values.stepOff : strings.values.alignment[step - 1]`
  - `renderControl` new markup: a `.aa-assist-control-top` div containing the icon chip (`<span class="aa-assist-control-chip">` with `innerHTML = widgetIcon(control.path)`) and the value pill (`<span class="aa-assist-control-value">`), then the label span (`.aa-assist-control-label`). Keep `button.dataset.aaAssistPath = control.path`, `aria-pressed`, and `aria-label = ${localizedLabel} ${value}`.
  - Clear button text + `aria-label` = `options.strings.clear`.
  - Structure group titles use `options.strings.structure.headings/links/landmarks`; the wrapper `aria-label = options.strings.structure.aria`.
  - The launcher lives in `widget.ts` (not panel.ts) — see Step 3.

  Keep the exact DOM hooks the tests/handlers use: `role="dialog"`, `aria-modal`, `aria-labelledby="aa-assist-title"` (the title `id`), `data-aa-assist-path`, `data-aa-assist-action`, `.aa-assist-launcher`, `#aa-assist-generated-styles`.

- [ ] **Step 3: Launcher icon in `widget.ts`** — where the launcher button is created, set its content to `widgetIcon("launcher")` (via a span's `innerHTML`) instead of the current text glyph; keep its `aria-label` toggling between `strings.launcherOpen`/`launcherClose` (resolve strings there too, or pass them in). Keep the `.aa-assist-launcher` class + open/close aria behavior the e2e test checks.

- [ ] **Step 4: Update `widget.test.ts` (e2e) for default-tr + force-en**

The e2e test asserts English strings ("Accessibility Preferences", "Close accessibility preferences", "Clear Preferences", "Line Height step 1", "Open/Close accessibility preferences"). The widget now defaults to **tr**, so:
  - Mount the widget with the English locale in the existing English-asserting tests. Find how the test mounts (it loads the built bundle or calls `initAssistWidget`/`mountAssistWidget`). Pass `language: "en"` (e.g. via the embed script `data-language="en"`, or the mount options the test uses).
  - Keep all English assertions (they equal the `en` catalog values verbatim — e.g. title "Accessibility Preferences", "Line Height step 1").
  - Add ONE default-locale assertion: mount WITHOUT a language (default tr) and assert the dialog/title shows the Turkish title "Erişilebilirlik Tercihleri" (and e.g. a control labeled "Yazı Boyutu").
  - The control aria-label format stays `${label} ${value}`; under `en`, "Line Height" + "step 1" = "Line Height step 1" (unchanged). Confirm `aria-labelledby`/dialog name still resolves to the title.

- [ ] **Step 5: Build + typecheck + test**

- `./node_modules/.bin/tsc -p packages/assist-widget/tsconfig.json --noEmit` → 0 errors.
- `npx pnpm@9 --filter @a11yaudit/assist-widget build` → Done (rebuilds the bundle with the new UI; the e2e test loads this).
- `./node_modules/.bin/vitest run packages/assist-widget` → PASS (unit + e2e if available; if e2e cannot run in this environment, run unit tests and report).

- [ ] **Step 6: Commit**

```bash
git add packages/assist-widget/src/ui/styles.ts packages/assist-widget/src/ui/panel.ts packages/assist-widget/src/widget.ts packages/assist-widget/src/widget.test.ts
git commit -m "feat(assist-widget): icon-tile panel redesign (Audera accent) + localized strings"
```

---

## Task 5: Serve the bundle from the Fastify server

**Files:**
- Create: `apps/server/src/routes/assist.ts`
- Modify: the server route registration (wherever routes are registered, e.g. `apps/server/src/app.ts` or a routes index)
- Test: `apps/server/src/app.test.ts` (add cases)

- [ ] **Step 1: Write the route** `apps/server/src/routes/assist.ts`:

```ts
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { FastifyInstance } from "fastify";

const require = createRequire(import.meta.url);

function bundlePath(): string {
  // Resolve the built widget bundle relative to the assist-widget package.
  const pkgJson = require.resolve("@a11yaudit/assist-widget/package.json");
  return path.join(path.dirname(pkgJson), "dist", "a11yaudit-assist.js");
}

export async function registerAssistRoutes(server: FastifyInstance): Promise<void> {
  const serveFile = async (file: string, contentType: string, reply: import("fastify").FastifyReply) => {
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
  };

  server.get("/assist/a11yaudit-assist.js", async (_req, reply) =>
    serveFile(bundlePath(), "text/javascript; charset=utf-8", reply)
  );
  server.get("/assist/a11yaudit-assist.js.map", async (_req, reply) =>
    serveFile(`${bundlePath()}.map`, "application/json; charset=utf-8", reply)
  );
}
```

> Adjust the bundle-resolution to the repo's module setup: if `require.resolve("@a11yaudit/assist-widget/package.json")` fails (package `exports` restrictions), fall back to a path relative to the server file, e.g. `path.resolve(serverDir, "../../packages/assist-widget/dist/a11yaudit-assist.js")` — read how other server code resolves sibling packages and match it. The route MUST NOT throw at registration time if the file is absent; only the request returns 404.

- [ ] **Step 2: Register + exempt from auth/CSRF.** Wire `registerAssistRoutes(server)` where the server builds (read `apps/server/src/app.ts` `buildServer`). These GET routes must be reachable WITHOUT authentication and skip CSRF (they're public static assets, like `/health`). Confirm the auth/CSRF hook allow-list includes `/assist/*` (or that GET static routes are already exempt) — mirror how `/health` is exempted.

- [ ] **Step 3: Tests** in `apps/server/src/app.test.ts` (mirror existing route tests; build the server via the test helper). With the bundle present (build the widget first in the test setup, OR write a temp file at the resolved path), assert:

```ts
it("serves the assist widget bundle with permissive CORS, no auth", async () => {
  const res = await server.inject({ method: "GET", url: "/assist/a11yaudit-assist.js" });
  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toContain("text/javascript");
  expect(res.headers["access-control-allow-origin"]).toBe("*");
});
```
If reliably staging the real bundle in the test is hard, also accept a test that asserts `404` with the documented JSON when the bundle is absent, plus the header behavior when present (write a fixture file at the resolved path in `beforeAll`, remove in `afterAll`). Choose whichever is deterministic in this repo's test setup; describe what you did.

- [ ] **Step 4: Verify**

- `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` → 0 errors.
- `./node_modules/.bin/vitest run apps/server` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/assist.ts apps/server/src/app.ts apps/server/src/app.test.ts
git commit -m "feat(server): serve the assist-widget bundle (public, CORS *, cache)"
```

---

## Task 6: Full build, suite, deployment note

**Files:**
- Modify: `docs/deployment.md` (embed snippet + build note)

- [ ] **Step 1: Full build + suite**

- `npx pnpm@9 -r build` → all Done (assist-widget bundle built; server build clean).
- `./node_modules/.bin/vitest run` → all PASS. Report counts. If the widget e2e cannot run in this environment, report which suites ran.

- [ ] **Step 2: Deployment note** — in `docs/deployment.md`, add a short "Accessibility widget" section: the server serves the bundle at `GET /assist/a11yaudit-assist.js` (requires `pnpm build` so `packages/assist-widget/dist/` exists), and the customer embed snippet:

```html
<script src="https://<A11YAUDIT_SERVER_URL>/assist/a11yaudit-assist.js"
        data-project="<projectId>" data-position="bottom-right" data-language="tr" defer></script>
```
Note `data-language` defaults to `tr` (falls back to `<html lang>`), `data-position` and `data-enabled-sections` are optional.

- [ ] **Step 3: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: assist-widget hosting route + embed snippet"
```

---

## Notes for the implementer

- **Port first, change nothing in Task 1** — get the existing package green on `main` before refactoring. If the e2e (Playwright) tests can't run in this environment, proceed on the unit tests and flag the e2e status; do not delete them.
- **DOM hooks are load-bearing** — `role="dialog"`, `aria-labelledby="aa-assist-title"`, `.aa-assist-launcher`, `data-aa-assist-path`, `data-aa-assist-action`, `#aa-assist-generated-styles`, and the aria-label formats are asserted by `widget.test.ts` and used by handlers. Preserve them through the redesign.
- **English values must equal the current strings** so the force-`en` e2e assertions pass unchanged ("Accessibility Preferences", "Line Height step 1", "Close accessibility preferences", "Clear Preferences", "Open accessibility preferences").
- **Icons are decorative** — `aria-hidden="true"` on every SVG; the accessible name comes from the control's `aria-label`. State is conveyed by the value pill text + the active ring, never color alone.
- **`PAGE_EFFECT_CSS` is untouched** — it styles the host page, not the panel.
- **CORS `*` is correct here** — a public, credential-free static asset loaded cross-origin by design. Do not add `Access-Control-Allow-Credentials`.
