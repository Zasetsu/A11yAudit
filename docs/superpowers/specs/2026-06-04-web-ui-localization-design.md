# Web UI Localization (TR/EN) Design

Date: 2026-06-04

## Goal

Localize the React web app (`apps/web`) so the interface is presented in **Turkish by default**, with a **TR/EN switcher** in the top bar. The customer base is Turkish; the app chrome (navigation, buttons, labels, headings, form/error/empty/loading copy) must read naturally in Turkish, while English remains available for English-speaking operators.

This is a deliberate, scoped override of the product principle "English-only product surface". After this change the principle reads: **code, comments, CLI, rule identifiers, and server logs stay English; the web UI and the downloaded report are localized (Turkish default).**

## Scope

**In scope** — the static application chrome of `apps/web`:
- Navigation and shell (sidebar, top bar, workspace/project selectors, theme/sign-out controls).
- All page chrome: headings, descriptions, section titles, field labels, placeholders, buttons.
- Status/empty/loading/error copy the UI renders itself (e.g. "Sign in failed. Check your email and password.").
- Severity labels (Critical/Serious/Moderate/Minor) and diff-status labels (New/Ongoing/Resolved/Changed) shown as UI chrome.
- Auth surfaces (login, signup, invite-accept) and workspace picker.
- Locale-aware date formatting (`formatDate`, invitation expiry).
- `<html lang>` reflects the active locale.

**Out of scope (stays as-is, English):**
- **Axe finding titles/descriptions/recommendations** — produced by axe-core in English and stored in `findings`/`issues`. The findings list and detail pages keep showing these verbatim. (Translating the rule corpus is a separate future feature.)
- **CLI** (`apps/cli`) — offline developer tool, stays English.
- **Server** internals, logs, and raw API error messages. The UI shows its own localized copy for expected states; if a raw server `error.message` ever surfaces, it remains English (rare, technical).
- **Server-side persistence of the preference**, emails, multi-tenant per-workspace locale config.
- **WCAG criterion names**: localized where the UI displays them, sourced from `@a11yaudit/core` `getCriterionContent(id, locale).name` (we already author tr/en). This is the one piece of data-driven text we localize, because we own the translations.

## Decisions (locked during brainstorming)

1. **TR/EN switchable, default Turkish.** Not Turkish-only — both locales are first-class; TR is the default.
2. **Preference stored in `localStorage`** under `a11yaudit-locale`, exactly like the existing theme preference. No server schema/migration/endpoint. Per-browser; not synced across devices (acceptable for the self-hosted MVP).
3. **In-house lightweight i18n, no library.** ~145 strings; a typed message catalog + a React context mirror the existing `packages/reporter` `reportStrings` pattern. No `react-i18next`/`react-intl` dependency (smaller bundle, simpler tests).
4. **App chrome only** (see Scope). Axe finding text stays English.

## Architecture

A small i18n module under `apps/web/src/i18n/`, consumed via a React context. Three units:

### 1. Message catalog — `apps/web/src/i18n/messages.ts`

```ts
import type { ReportLocale } from "@a11yaudit/core";

export type Locale = ReportLocale; // "tr" | "en" — reuse the core union for consistency

// Flat, dotted keys grouped by area. Keys are stable identifiers; values are copy.
export interface Messages {
  "nav.overview": string;
  "nav.projects": string;
  // ... ~145 keys, grouped: nav.*, shell.*, auth.*, scan.*, settings.*,
  //     members.*, overview.*, projects.*, reports.*, findings.*, finding.*,
  //     workspaces.*, docs.*, severity.*, status.*, common.*
}

export const MESSAGES: Record<Locale, Messages> = {
  tr: { "nav.overview": "Genel Bakış", /* ... */ },
  en: { "nav.overview": "Overview", /* ... */ },
};

export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALES: Locale[] = ["tr", "en"];
```

- `Messages` is an explicit interface so a missing key in either locale is a **compile error** — both locales must be complete (no silent fallback gaps).
- Some strings take counts/values; those are functions `(n: number) => string` typed in the interface (e.g. `"findings.showing": (shown: number, total: number) => string`). Keep these minimal.

### 2. Locale context — `apps/web/src/i18n/locale-context.tsx`

```ts
export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element;
export function useT(): { t: TFn; locale: Locale; setLocale: (l: Locale) => void };
```

- On mount: read `localStorage["a11yaudit-locale"]`; if missing/invalid → `DEFAULT_LOCALE` (`"tr"`).
- `setLocale` writes `localStorage` and updates state (instant re-render).
- An effect sets `document.documentElement.lang = locale` whenever locale changes.
- `t` is `<K extends keyof Messages>(key: K, ...args) => string`, reading from `MESSAGES[locale]`. For function-valued entries, `t` calls them with the passed args. A missing entry returns the key string (visible in dev; cannot happen for typed keys but guards against runtime drift).

`LocaleProvider` wraps `<App />` in `main.tsx`, inside/around the existing `QueryClientProvider`.

### 3. Language switcher — in `apps/web/src/design/shell.tsx` (TopBar)

A compact segmented control `[ TR | EN ]` next to the theme toggle. Active locale highlighted; clicking the inactive one calls `setLocale`. Accessible: a `<fieldset>`/radio or two `<button aria-pressed>`; label via `t("shell.language")`.

## Data flow

```
main.tsx
  └─ LocaleProvider (reads localStorage → locale state)
       └─ QueryClientProvider
            └─ App
                 ├─ Shell/TopBar → useT() → renders nav + switcher; switcher → setLocale
                 └─ Pages → useT() → t("...") for every visible string
```

No server round-trip. Locale changes are pure client state; the app re-renders with the new catalog. Date formatting reads `locale` from `useT()`.

## Affected files (migration)

Replace inline literals with `t("key")` across the ~145 strings the investigation found:

- New: `apps/web/src/i18n/messages.ts`, `apps/web/src/i18n/locale-context.tsx`, plus tests.
- `apps/web/src/main.tsx` — wrap with `LocaleProvider`.
- `apps/web/index.html` — `<html lang>` becomes a default `tr` (the provider keeps it in sync at runtime); title may stay "A11yAudit" (brand).
- `apps/web/src/design/shell.tsx` — nav labels + switcher + top-bar controls.
- `apps/web/src/design/ui.tsx` — `severityMeta` labels become locale-aware (label via `t`, or keep keys and resolve in component).
- `apps/web/src/data.ts` — `formatDate(value, locale)` takes a locale (tr→`tr-TR`, en→`en-GB`, matching the reporter); `severityMeta` labels keyed for `t`.
- Pages: `overview.tsx`, `projects.tsx`, `new-scan.tsx`, `scan-runs.tsx`, `findings.tsx`, `finding-detail.tsx`, `reports.tsx`, `members.tsx`, `settings.tsx`, `login.tsx`, `signup.tsx`, `invite.tsx`, `workspaces.tsx`, `app.tsx` (Documentation/MVP copy, loading, demo-data banner).

Finding/issue **titles, descriptions, recommendations** are rendered from API data unchanged. Where a page prints a WCAG criterion **name**, resolve it via `getCriterionContent(criterionId, locale)?.name ?? criterionId`.

## Testing

- **Catalog completeness:** a test asserts `MESSAGES.tr` and `MESSAGES.en` have identical key sets (defends against drift); the typed interface already enforces this at compile time, the test guards runtime/object shape.
- **Context behavior:** default locale is `tr` when `localStorage` is empty; `setLocale("en")` updates `t` output and writes `localStorage`; invalid stored value falls back to `tr`; `document.documentElement.lang` tracks the locale.
- **Switcher:** rendering the TopBar shows both TR and EN; clicking EN switches a sample visible string.
- **Existing page tests** (`auth.test.tsx`, `members.test.tsx`, `findings.test.ts`, `reports.test.ts`, `scan-runs.test.ts`): they assert on English labels. They must render inside a `LocaleProvider`. Provide a test helper `renderWithLocale(ui, locale = "en")` and have these tests force `"en"` so their English assertions hold; add at least one TR-default assertion (e.g. login renders "Giriş Yap" by default). Update the `fillInput`/label-finding helpers to accept the active-locale label.
- **No conformance-claim regressions:** localized copy must not certify WCAG/legal compliance in either locale (the honest-verification framing is preserved — same constraint as the report).

## Documentation

Update `CLAUDE.md` "Product principles": scope "English-only" to code/CLI/comments/server logs, and note the **web UI and report are localized (Turkish default, English available)** — the web UI joining the report as a localized surface.

## Out of scope (future)

- Translating the axe rule corpus (rule-id → localized title/description table).
- Server-persisted, cross-device locale preference; localized emails.
- Per-workspace/project default locale configuration UI.
- CLI localization.
- RTL or locales beyond tr/en.
