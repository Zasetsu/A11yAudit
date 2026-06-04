# Audit Report Redesign Design

Date: 2026-06-03

## Goal

The downloaded audit report (HTML, and the PDF rendered from the same HTML) is the customer-facing deliverable. Today it is a flat technical table dump that a non-technical customer cannot read: the score is a bare number, severities are uncolored, every issue row repeats the same text for "Issue" and "Recommendation", the same rule on the same page produces many near-identical rows, and there is no way to tell *which element* failed.

This redesign turns the report into a two-audience document — a manager skims the top, a developer drills into the bottom — built around **WCAG 2.2 success criteria** as the content source, with each problem shown as one grouped card that names the affected elements (real HTML + an element-highlighted screenshot) and explains, in plain language, what it means and how to fix it.

Scope is the **report deliverable only** (HTML + PDF). The web UI issue/finding pages are out of scope.

## Product framing change (deliberate override)

The product principle is "English-only product surface (UI, CLI, PDF, rule text, comments)". The owner overrides this **for the report deliverable only**: the report is **localized (Turkish/English), default Turkish**, because the customer base is Turkish. Code, web UI, CLI, rule identifiers, and comments remain English. Update the CLAUDE.md / a11yaudit-design principle to scope "English-only" to product code/UI and note that the **report deliverable is localized**.

The report still must **never** claim WCAG conformance or legal compliance — the honest-verification framing is preserved in every locale.

## Decisions (locked during brainstorming)

1. **Grouped issue cards, not a flat table.** One card per *rule* (the specific problem, e.g. "Buttons have no accessible name"), with the affected elements listed underneath.
2. **Content keyed by WCAG criterion, sourced from W3C WCAG 2.2.** The card's "what this means" / "how to fix" / reference link come from a per-criterion content table, not per-rule. This is engine-agnostic: axe rules, the custom interaction rules, and future custom rules all map to WCAG criteria and reuse the same content.
3. **Card grouping = rule-level headline + criterion reference.** Headline is the specific rule problem; the WCAG criterion (id, name, level) and its W3C-sourced prose are shown under it.
4. **Per-element detail = literal HTML + selector + page + viewport + element-highlighted screenshot.**
5. **Screenshots are element-highlighted crops** (Approach A): during the scan, each flagged element is outlined and a clipped screenshot (element + surrounding context) is captured. Requires a scan-engine evidence change.
6. **Report structure:** cover + score band → at-a-glance (colored severities) → "Fix these first" (top priorities) → grouped issue cards (severity-sorted) → manual-review notice + honest disclaimer → technical appendix (for developers).
7. **Localized (tr/en), default tr.**
8. **Report-layer rollup** — `aggregateScanIssues` (element-level Issues) is unchanged; the reporter re-groups them by rule to build cards. Data model, diff, and persistence are untouched.
9. **Two phases** in one spec; each phase is independently mergeable.

## Architecture

Three pieces, each independently testable:

- **WCAG content model** (`packages/core`): a per-criterion, per-locale content table next to `wcag.ts`. Keyed by criterion id (e.g. `"4.1.2"`) → `{ name, userImpact, howToFix, w3cUrl }` for each locale. `wcag.ts` already holds criterion id/name/level; this adds the localized prose + the canonical W3C reference URL.
- **Report rollup + model** (`packages/reporter`): a function that re-groups the element-level `AggregatedIssue[]` (or the underlying findings) by `ruleId` into "report problems", each carrying its WCAG criterion content and an ordered element list. The report model gains a `locale`.
- **Report template** (`packages/reporter`): the localized HTML template that renders the new structure, with embedded screenshots (base64 data URIs) so HTML and PDF are self-contained.

Phase 2 adds the **annotated screenshot capture** in `packages/audit` (scan-engine) and threads the bytes into the report model.

## 1. WCAG content model (core)

Add `packages/core/src/wcag-content.ts`:

```ts
export type ReportLocale = "tr" | "en";

export interface WcagCriterionContent {
  name: string;        // localized criterion name (English official term may be kept in parens)
  userImpact: string;  // plain-language "what this means" for this criterion
  howToFix: string;    // plain-language remediation guidance for this criterion
  w3cUrl: string;      // canonical W3C WCAG 2.2 reference (Understanding / spec anchor)
}

// keyed by criterion id, then locale
export const WCAG_CRITERION_CONTENT: Record<string, Record<ReportLocale, WcagCriterionContent>>;

export function getCriterionContent(criterionId: string, locale: ReportLocale): WcagCriterionContent | null;
```

- Populated for every criterion currently covered by the rule set (the ids already in `WCAG_22_CRITERIA` — `1.1.1, 1.3.1, 1.4.3, 2.4.4, 2.4.7, 2.4.11, 2.5.8, 4.1.2`, and any others added). Both `tr` and `en` authored from W3C WCAG 2.2 Understanding docs.
- `w3cUrl` points to the canonical W3C page (English; W3C is the authoritative source) per criterion, e.g. `https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html`.
- The criterion `name` is localized; keep the official English term available (the report may show "Ad, Rol, Değer (Name, Role, Value)").
- **Fallback:** if a finding's criterion has no content entry, the card still renders with the rule headline, the criterion id+level from `wcag.ts`, and the W3C link; the impact/fix prose falls back to a generic localized line ("Bu kriter manuel inceleme gerektirir." / "Refer to the linked WCAG criterion.").

## 2. Report rollup + model (reporter)

Add a rollup that converts element-level data into report problems:

```ts
export interface ReportElement {
  htmlSnippet: string | null;   // literal outerHTML of the failing element
  selector: string | null;
  pageUrl: string;
  viewport: string;
  screenshotDataUri: string | null; // embedded element-highlighted crop (Phase 2) or page screenshot (Phase 1)
}

export interface ReportProblem {
  ruleId: string;
  title: string;                 // rule headline (specific problem)
  severity: Severity;
  certainty: FindingCertainty;
  wcagCriteria: string[];        // e.g. ["4.1.2"]
  criterion: { id: string; name: string; level: string; content: WcagCriterionContent } | null;
  elements: ReportElement[];     // every occurrence of this rule, across pages
  affectedPages: number;
  occurrences: number;
}
```

- Re-group `findings` (or `AggregatedIssue`s) by `ruleId`; collect every occurrence as a `ReportElement`. Sort problems by severity rank then occurrence count.
- The report model gains `locale: ReportLocale` and `problems: ReportProblem[]` (the existing `issues`/`findings` stay for the technical appendix).
- `buildAuditReportModel` accepts a `locale` (default `"tr"`).

## 3. Report template (reporter)

A localized HTML template implementing the approved structure. All visible strings come from a small per-locale string dictionary (section titles, severity names, score-band labels, "what this means"/"how to fix" labels, disclaimer). Layout:

- **Cover:** project domain, human-formatted date (locale-aware, e.g. "3 Haziran 2026"), the **score** with a colored band and label (≥90 İyi/Good, 70–89 Geliştirilmeli/Needs Work, <70 Zayıf/Poor) and a one-line verdict.
- **At a glance:** colored severity badges (critical red, serious orange, moderate amber, minor gray) + unique-issue / occurrence / affected-page counts + viewports.
- **Fix these first:** the top N highest-severity problems as a compact list.
- **Issues (grouped):** one card per `ReportProblem`, severity-sorted. Each card: severity badge + rule headline; WCAG line (id · localized name · level) linking to `w3cUrl`; "What this means" (userImpact); "How to fix" (howToFix); "Where (N elements)" — each element shows its literal HTML snippet, selector, page, viewport, and embedded screenshot.
- **Manual-review notice + disclaimer:** localized, honest (no conformance/compliance claim).
- **Technical appendix:** the existing raw-occurrence and evidence tables (rule IDs, full selectors, artifact keys, MIME, size), clearly labeled for developers, at the end.

Humanize values: dates (locale), scan mode (e.g. `same_domain_crawl` → "Tüm site taraması" / "Same-domain crawl"), viewport names.

Screenshots are embedded as base64 data URIs so the single HTML file (and the PDF rendered from it) is self-contained.

## 4. Annotated screenshot capture (audit / scan-engine — Phase 2)

In the scan-engine evidence step, for each finding's element:

1. Resolve the element (by selector/handle already available during `auditPage`).
2. Apply a temporary highlight: `el.evaluate(n => { n.style.outline = "3px solid #e11"; n.style.outlineOffset = "2px"; })`.
3. Read `el.boundingBox()`, compute a clip rectangle expanded with context padding (clamped to the viewport), and `page.screenshot({ clip })` — capturing the element highlighted, with surrounding page context.
4. Remove the highlight.
5. Store the crop via the storage adapter as a new evidence kind `element_screenshot`, linked to the finding.

- Bounded: one crop per finding, with a per-page cap (e.g. skip beyond N to bound scan time/storage; the cap is logged, never silent).
- The report model reads the crop bytes for each element and inlines them as data URIs.
- **Phase 1** ships without crops: elements show the existing page-level screenshot (one per page, embedded) plus HTML + selector. **Phase 2** replaces that with the element-highlighted crop.

## Phasing

- **Phase 1 (report-only, mergeable):** WCAG content model (tr+en), report rollup + model + `locale`, localized template with the new structure, embedded existing page screenshots, technical appendix, humanized values, score bands, severity colors. No scan-engine change.
- **Phase 2:** annotated element-screenshot capture in the scan-engine + report uses element crops.

## Testing

- **WCAG content:** every covered criterion has both locales; `getCriterionContent` returns content for known ids and `null` (→ fallback) for unknown.
- **Rollup:** element-level findings for the same rule across pages collapse into one `ReportProblem` with all elements listed; severity sort order; occurrence/affected-page counts correct.
- **Template (tr default):** renders cover/score-band/at-a-glance/top-priorities/cards/appendix; a card shows the rule headline, the localized WCAG line + W3C link, distinct impact vs fix text, and per-element HTML + selector + screenshot; the disclaimer makes no conformance claim; severities are colored. An `en` render produces English strings.
- **Self-containment:** the rendered HTML embeds screenshots as data URIs (no external fetch).
- **Phase 2:** a flagged element produces an `element_screenshot` evidence artifact; the highlight is removed after capture; the per-page cap is respected and logged; the crop appears embedded in the report.
- Existing reporter tests (`html-template.test.ts`) updated for the new structure.

## Out of scope

- Web UI issue/finding pages (separate surface).
- Per-project locale configuration UI (locale defaults to `tr`; a project/workspace setting can be added later — for now the report build receives the locale, defaulting to `tr`).
- Translating the WCAG criterion *names* beyond the covered set, or full WCAG 2.2 coverage of all 87 criteria (only the tested subset is authored).
- Changing `aggregateScanIssues` / the issue data model / diff.
