# Audit Report Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the downloaded audit report into a customer-readable, localized (Turkish default), two-audience document: grouped issue cards keyed by WCAG criterion (W3C-sourced impact/fix text), per-element detail (literal HTML + element-highlighted screenshot), an executive top, and a developer appendix.

**Architecture:** A per-criterion × per-locale WCAG content table in `core`; a report-layer rollup in `reporter` that re-groups element-level findings by rule into cards (the issue data model is untouched); a localized HTML template (the same HTML feeds the PDF). Screenshots are embedded as base64 data URIs read from storage by the scan-engine (which keeps the reporter pure). Phase 2 adds element-highlighted screenshot capture in the scan-engine.

**Tech Stack:** TypeScript ESM monorepo, Vitest, Playwright (scan-engine), better-sqlite3 (unaffected).

**Design spec:** `docs/superpowers/specs/2026-06-03-report-redesign-design.md`

---

## Conventions

- ESM: relative imports use explicit `.js` extensions even from `.ts`.
- `pnpm` is NOT on PATH. Use `./node_modules/.bin/vitest` and `./node_modules/.bin/tsc` from the repo root. Build a package after changing it if a dependent needs the new exports: `npx pnpm@9 -r --filter "./packages/*" build`.
- Single test file: `./node_modules/.bin/vitest run packages/reporter/src/html-template.test.ts`
- Package typecheck: `./node_modules/.bin/tsc -p packages/core/tsconfig.json --noEmit` (swap the package).
- Existing data shapes:
  - `ScanFinding` (core) has: `id, title, severity, status, source, certainty, origin, wcagCriteria: string[], ruleId, description, recommendation, pageUrl, viewport, selector, htmlSnippet, visibleText, helpUrl, fingerprint, evidence: EvidenceArtifact[], instances`.
  - `EvidenceArtifact` = `{ kind: "page_screenshot" | "element_screenshot" | "html_snippet"; artifactKey: string; mimeType: string; sizeBytes: number }` (kinds are string-typed; `page_screenshot` is produced today).
  - `AggregatedIssue` (core) has severity/criteria/representative fields — used for the **severity summary and appendix**, NOT the per-element card list.
  - `wcag.ts` exports `WCAG_22_CRITERIA: Record<string, { id, name, level }>` for ids `1.1.1, 1.3.1, 1.4.3, 2.4.4, 2.4.7, 2.4.11, 2.5.8, 4.1.2`.
  - `StorageAdapter` has `get(key): Promise<Buffer>`.
  - Reporter test harness: `import { buildAuditReportModel, renderReportHtml } from "./index.js";` (Vitest).

## File Structure

**Phase 1 (report-only):**
- `packages/core/src/wcag-content.ts` (new) — `ReportLocale`, `WcagCriterionContent`, `WCAG_CRITERION_CONTENT`, `getCriterionContent`.
- `packages/core/src/index.ts` (modify) — export the above.
- `packages/reporter/src/i18n.ts` (new) — per-locale UI string dictionary + helpers (severity label, score band, mode/date formatting).
- `packages/reporter/src/report-model.ts` (modify) — `ReportElement`, `ReportProblem`, `buildReportProblems`, and `locale` + `screenshotDataUris` on `buildAuditReportModel`.
- `packages/reporter/src/html-template.ts` (rewrite) — localized structure.
- `packages/reporter/src/report-model.test.ts` (new) — rollup tests.
- `packages/reporter/src/html-template.test.ts` (modify) — new structure assertions (tr + en).
- `packages/audit/src/scan-engine.ts` (modify) — read page-screenshot bytes → data-URI map; pass `locale` (default `"tr"`).
- `docs/wcag-22-coverage-guide.md` / `CLAUDE.md` (modify) — note the localized-report principle override.

**Phase 2 (screenshots):**
- `packages/audit/src/scan-engine.ts` (modify) + `packages/audit/src/evidence.ts` (modify) — capture element-highlighted crops.

---

## Task 1: WCAG content model (core)

**Files:**
- Create: `packages/core/src/wcag-content.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/wcag-content.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/wcag-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCriterionContent } from "./wcag-content.js";
import { WCAG_22_CRITERIA } from "./wcag.js";

describe("wcag content", () => {
  it("returns Turkish and English content for every covered criterion", () => {
    for (const id of Object.keys(WCAG_22_CRITERIA)) {
      const tr = getCriterionContent(id, "tr");
      const en = getCriterionContent(id, "en");
      expect(tr, `tr content for ${id}`).not.toBeNull();
      expect(en, `en content for ${id}`).not.toBeNull();
      expect(tr!.userImpact.length).toBeGreaterThan(0);
      expect(tr!.howToFix.length).toBeGreaterThan(0);
      expect(tr!.w3cUrl).toMatch(/^https:\/\/www\.w3\.org\//);
    }
  });

  it("returns null for an unknown criterion", () => {
    expect(getCriterionContent("9.9.9", "tr")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run packages/core/src/wcag-content.test.ts`
Expected: FAIL — `wcag-content.js` does not exist.

- [ ] **Step 3: Implement the content table**

Create `packages/core/src/wcag-content.ts`. Author `tr` + `en` prose for EVERY id in `WCAG_22_CRITERIA` (`1.1.1, 1.3.1, 1.4.3, 2.4.4, 2.4.7, 2.4.11, 2.5.8, 4.1.2`), summarized from the W3C WCAG 2.2 Understanding docs. Two full examples are given; follow the exact shape for the rest. `userImpact` = plain "what this means for users"; `howToFix` = plain remediation; `name` = localized criterion name with the official English term in parentheses; `w3cUrl` = the canonical W3C Understanding page for that criterion.

```ts
export type ReportLocale = "tr" | "en";

export interface WcagCriterionContent {
  name: string;
  userImpact: string;
  howToFix: string;
  w3cUrl: string;
}

export const WCAG_CRITERION_CONTENT: Record<string, Record<ReportLocale, WcagCriterionContent>> = {
  "4.1.2": {
    tr: {
      name: "Ad, Rol, Değer (Name, Role, Value)",
      userImpact: "Ekran okuyucu kullanıcılar bu kontrolün ne işe yaradığını duyamaz; yalnızca \"buton\" gibi etiketsiz bir ifade duyarlar ve işlevi anlayamazlar.",
      howToFix: "Her etkileşimli öğeye erişilebilir bir ad verin: görünür metin, aria-label veya başlık (title) ekleyin; özel bileşenlerde doğru rol ve durum (state) değerlerini belirtin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    },
    en: {
      name: "Name, Role, Value",
      userImpact: "Screen-reader users hear no label for this control — only something like \"button\" — so they cannot tell what it does.",
      howToFix: "Give every interactive element an accessible name: add visible text, an aria-label, or a title; for custom widgets, expose the correct role and state.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    }
  },
  "1.4.3": {
    tr: {
      name: "Kontrast (Minimum) (Contrast (Minimum))",
      userImpact: "Az gören kullanıcılar düşük kontrastlı metni okuyamaz; metin arka planından yeterince ayrışmaz.",
      howToFix: "Normal metin için en az 4.5:1, büyük metin için en az 3:1 kontrast oranı sağlayın. Metin veya arka plan renklerini koyulaştırıp açarak oranı yükseltin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    },
    en: {
      name: "Contrast (Minimum)",
      userImpact: "Low-vision users cannot read low-contrast text because it does not stand out enough from its background.",
      howToFix: "Ensure a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text. Darken or lighten the text or background to raise the ratio.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    }
  }
  // Author the remaining ids the same way: 1.1.1, 1.3.1, 2.4.4, 2.4.7, 2.4.11, 2.5.8.
  // Canonical W3C Understanding URLs (use these exact slugs):
  //   1.1.1  -> non-text-content
  //   1.3.1  -> info-and-relationships
  //   2.4.4  -> link-purpose-in-context
  //   2.4.7  -> focus-visible
  //   2.4.11 -> focus-not-obscured-minimum
  //   2.5.8  -> target-size-minimum
};

export function getCriterionContent(criterionId: string, locale: ReportLocale): WcagCriterionContent | null {
  return WCAG_CRITERION_CONTENT[criterionId]?.[locale] ?? null;
}
```

- [ ] **Step 4: Export from core**

In `packages/core/src/index.ts`, add:

```ts
export * from "./wcag-content.js";
```

- [ ] **Step 5: Run the test + typecheck**

Run: `./node_modules/.bin/vitest run packages/core/src/wcag-content.test.ts` → PASS.
Run: `./node_modules/.bin/tsc -p packages/core/tsconfig.json --noEmit` → exit 0.

- [ ] **Step 6: Build core (dependents import it) + commit**

Run: `npx pnpm@9 -r --filter "./packages/core" build`

```bash
git add packages/core/src/wcag-content.ts packages/core/src/index.ts packages/core/src/wcag-content.test.ts
git commit -m "feat(core): add localized WCAG criterion content table"
```

---

## Task 2: Reporter i18n string dictionary

**Files:**
- Create: `packages/reporter/src/i18n.ts`
- Test: `packages/reporter/src/i18n.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/reporter/src/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reportStrings, severityLabel, scoreBand, formatReportDate } from "./i18n.js";

describe("report i18n", () => {
  it("provides tr and en strings", () => {
    expect(reportStrings("tr").fixFirst).toBe("Önce bunları düzeltin");
    expect(reportStrings("en").fixFirst).toBe("Fix these first");
  });

  it("labels severity per locale", () => {
    expect(severityLabel("critical", "tr")).toBe("Kritik");
    expect(severityLabel("critical", "en")).toBe("Critical");
  });

  it("bands the score", () => {
    expect(scoreBand(95, "tr").label).toBe("İyi");
    expect(scoreBand(80, "en").label).toBe("Needs Work");
    expect(scoreBand(40, "tr").label).toBe("Zayıf");
  });

  it("formats the date for the locale", () => {
    expect(formatReportDate("2026-06-03T09:00:00.000Z", "tr")).toContain("2026");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run packages/reporter/src/i18n.test.ts`
Expected: FAIL — `i18n.js` missing.

- [ ] **Step 3: Implement**

Create `packages/reporter/src/i18n.ts`:

```ts
import type { ReportLocale } from "@a11yaudit/core";
import type { Severity } from "@a11yaudit/core";

export interface ReportStrings {
  reportTitle: string;
  executiveSummary: string;
  atAGlance: string;
  fixFirst: string;
  allIssues: string;
  whatItMeans: string;
  howToFix: string;
  whereFound: string;
  wcagReference: string;
  manualReview: string;
  disclaimer: string;
  technicalAppendix: string;
  scoreOutOf: string;
  uniqueIssues: string;
  affectedPages: string;
  occurrences: string;
  pagesAudited: string;
  selector: string;
  page: string;
  viewport: string;
}

const STRINGS: Record<ReportLocale, ReportStrings> = {
  tr: {
    reportTitle: "Erişilebilirlik Denetim Raporu",
    executiveSummary: "Yönetici Özeti",
    atAGlance: "Genel bakış",
    fixFirst: "Önce bunları düzeltin",
    allIssues: "Tüm sorunlar",
    whatItMeans: "Bu ne demek",
    howToFix: "Nasıl düzeltilir",
    whereFound: "Nerede bulundu",
    wcagReference: "WCAG 2.2 kaynağı",
    manualReview: "Manuel inceleme hâlâ gereklidir. Bu otomatik teknik bir doğrulamadır; WCAG uygunluğunu veya yasal uyumluluğu belgelemez.",
    disclaimer: "A11yAudit otomatik teknik erişilebilirlik denetim sonuçları sunar. Yasal uyumluluğu belgelemez. Bazı WCAG 2.2 başarı kriterleri manuel inceleme ve insan değerlendirmesi gerektirir.",
    technicalAppendix: "Teknik ek (geliştiriciler için)",
    scoreOutOf: "puan /100",
    uniqueIssues: "benzersiz sorun",
    affectedPages: "etkilenen sayfa",
    occurrences: "tekrar",
    pagesAudited: "denetlenen sayfa",
    selector: "seçici",
    page: "sayfa",
    viewport: "görünüm"
  },
  en: {
    reportTitle: "Accessibility Audit Report",
    executiveSummary: "Executive Summary",
    atAGlance: "At a glance",
    fixFirst: "Fix these first",
    allIssues: "All issues",
    whatItMeans: "What this means",
    howToFix: "How to fix",
    whereFound: "Where it was found",
    wcagReference: "WCAG 2.2 reference",
    manualReview: "Manual review is still required. This is automated technical verification; it does not certify WCAG conformance or legal compliance.",
    disclaimer: "A11yAudit provides automated technical accessibility audit results. It does not certify legal compliance. Some WCAG 2.2 success criteria require manual review and human judgment.",
    technicalAppendix: "Technical appendix (for developers)",
    scoreOutOf: "score /100",
    uniqueIssues: "unique issues",
    affectedPages: "affected pages",
    occurrences: "occurrences",
    pagesAudited: "pages audited",
    selector: "selector",
    page: "page",
    viewport: "viewport"
  }
};

const SEVERITY_LABELS: Record<ReportLocale, Record<Severity, string>> = {
  tr: { critical: "Kritik", serious: "Ciddi", moderate: "Orta", minor: "Düşük" },
  en: { critical: "Critical", serious: "Serious", moderate: "Moderate", minor: "Minor" }
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#c0392b",
  serious: "#e67e22",
  moderate: "#d4a017",
  minor: "#7f8c8d"
};

export function reportStrings(locale: ReportLocale): ReportStrings {
  return STRINGS[locale];
}

export function severityLabel(severity: Severity, locale: ReportLocale): string {
  return SEVERITY_LABELS[locale][severity];
}

export interface ScoreBand {
  label: string;
  color: string;
}

export function scoreBand(score: number, locale: ReportLocale): ScoreBand {
  if (score >= 90) {
    return { label: locale === "tr" ? "İyi" : "Good", color: "#1a7f37" };
  }
  if (score >= 70) {
    return { label: locale === "tr" ? "Geliştirilmeli" : "Needs Work", color: "#c97a00" };
  }
  return { label: locale === "tr" ? "Zayıf" : "Poor", color: "#c0392b" };
}

export function formatReportDate(iso: string, locale: ReportLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric", month: "long", year: "numeric"
  }).format(date);
}

export function formatMode(mode: string, locale: ReportLocale): string {
  const map: Record<string, Record<ReportLocale, string>> = {
    single_url: { tr: "Tek URL", en: "Single URL" },
    same_domain_crawl: { tr: "Tüm site taraması", en: "Same-domain crawl" }
  };
  return map[mode]?.[locale] ?? mode;
}
```

- [ ] **Step 4: Run the test + typecheck**

Run: `./node_modules/.bin/vitest run packages/reporter/src/i18n.test.ts` → PASS.
Run: `./node_modules/.bin/tsc -p packages/reporter/tsconfig.json --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/reporter/src/i18n.ts packages/reporter/src/i18n.test.ts
git commit -m "feat(reporter): localized report string dictionary"
```

---

## Task 3: Report rollup + model fields

**Files:**
- Modify: `packages/reporter/src/report-model.ts`
- Test: `packages/reporter/src/report-model.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/reporter/src/report-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ScanFinding } from "@a11yaudit/core";
import { buildReportProblems } from "./report-model.js";

function finding(over: Partial<ScanFinding>): ScanFinding {
  return {
    id: "f-1", title: "Buttons must have discernible text", severity: "critical",
    status: "new", source: "axe", certainty: "automatic_violation", origin: "unknown",
    wcagCriteria: ["4.1.2"], ruleId: "button-name", description: "d", recommendation: "r",
    pageUrl: "https://x/", viewport: "desktop", selector: "button.nav", htmlSnippet: "<button class=\"nav\"></button>",
    visibleText: null, helpUrl: null, fingerprint: "fp-1", evidence: [], instances: 1, ...over
  };
}

describe("buildReportProblems", () => {
  it("groups findings of the same rule into one problem with all elements", () => {
    const problems = buildReportProblems([
      finding({ id: "f-1", selector: "button.a", fingerprint: "a" }),
      finding({ id: "f-2", selector: "button.b", fingerprint: "b", pageUrl: "https://x/about" })
    ], "tr", new Map());

    expect(problems).toHaveLength(1);
    expect(problems[0].ruleId).toBe("button-name");
    expect(problems[0].elements).toHaveLength(2);
    expect(problems[0].occurrences).toBe(2);
    expect(problems[0].affectedPages).toBe(2);
    expect(problems[0].criterion?.id).toBe("4.1.2");
    expect(problems[0].criterion?.content.howToFix.length).toBeGreaterThan(0);
  });

  it("sorts problems by severity rank then occurrences", () => {
    const problems = buildReportProblems([
      finding({ ruleId: "minor-rule", severity: "minor", fingerprint: "m" }),
      finding({ ruleId: "crit-rule", severity: "critical", fingerprint: "c" })
    ], "en", new Map());
    expect(problems[0].ruleId).toBe("crit-rule");
  });

  it("attaches the embedded screenshot data uri for an element by its page_screenshot artifact key", () => {
    const f = finding({
      evidence: [{ kind: "page_screenshot", artifactKey: "k1", mimeType: "image/png", sizeBytes: 1 }]
    });
    const problems = buildReportProblems([f], "tr", new Map([["k1", "data:image/png;base64,AAA"]]));
    expect(problems[0].elements[0].screenshotDataUri).toBe("data:image/png;base64,AAA");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run packages/reporter/src/report-model.test.ts`
Expected: FAIL — `buildReportProblems` not exported.

- [ ] **Step 3: Implement the rollup + model changes**

In `packages/reporter/src/report-model.ts`, update the imports and add the new types + function, and extend `AuditReportModel`/`buildAuditReportModel`:

```ts
import {
  aggregateScanIssues, getCriterionContent, WCAG_22_CRITERIA,
  type AggregatedIssue, type AuditedPage, type ReportLocale, type ScanFinding,
  type ScanRequest, type Severity, type WcagCriterionContent
} from "@a11yaudit/core";

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

export interface ReportElement {
  htmlSnippet: string | null;
  selector: string | null;
  pageUrl: string;
  viewport: string;
  screenshotDataUri: string | null;
}

export interface ReportProblemCriterion {
  id: string;
  name: string;
  level: string;
  content: WcagCriterionContent;
  w3cUrl: string;
}

export interface ReportProblem {
  ruleId: string;
  title: string;
  severity: Severity;
  wcagCriteria: string[];
  criterion: ReportProblemCriterion | null;
  elements: ReportElement[];
  affectedPages: number;
  occurrences: number;
}

function preferredScreenshotKey(finding: ScanFinding): string | null {
  const crop = finding.evidence.find((e) => e.kind === "element_screenshot");
  if (crop) return crop.artifactKey;
  const page = finding.evidence.find((e) => e.kind === "page_screenshot");
  return page ? page.artifactKey : null;
}

export function buildReportProblems(
  findings: ScanFinding[],
  locale: ReportLocale,
  screenshotDataUris: Map<string, string>
): ReportProblem[] {
  const byRule = new Map<string, ScanFinding[]>();
  for (const finding of findings) {
    const list = byRule.get(finding.ruleId) ?? [];
    list.push(finding);
    byRule.set(finding.ruleId, list);
  }

  const problems: ReportProblem[] = [];
  for (const [ruleId, group] of byRule) {
    const first = group[0];
    const criterionId = first.wcagCriteria[0];
    const meta = criterionId ? WCAG_22_CRITERIA[criterionId] : undefined;
    const content = criterionId ? getCriterionContent(criterionId, locale) : null;
    const criterion: ReportProblemCriterion | null = meta && content
      ? { id: meta.id, name: content.name, level: meta.level, content, w3cUrl: content.w3cUrl }
      : null;

    const elements: ReportElement[] = group.map((finding) => {
      const key = preferredScreenshotKey(finding);
      return {
        htmlSnippet: finding.htmlSnippet,
        selector: finding.selector,
        pageUrl: finding.pageUrl,
        viewport: finding.viewport,
        screenshotDataUri: key ? screenshotDataUris.get(key) ?? null : null
      };
    });

    problems.push({
      ruleId,
      title: first.title,
      severity: first.severity,
      wcagCriteria: first.wcagCriteria,
      criterion,
      elements,
      affectedPages: new Set(group.map((f) => f.pageUrl)).size,
      occurrences: group.length
    });
  }

  problems.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.occurrences - a.occurrences);
  return problems;
}
```

Extend `AuditReportModel` with:

```ts
  locale: ReportLocale;
  problems: ReportProblem[];
```

In `buildAuditReportModel`, add a `locale` (default `"tr"`) and an optional `screenshotDataUris` to the input, and set the new fields:

```ts
export function buildAuditReportModel(input: {
  request: ScanRequest;
  pages: AuditedPage[];
  findings: ScanFinding[];
  score: number;
  generatedAt: string;
  locale?: ReportLocale;
  screenshotDataUris?: Map<string, string>;
}): AuditReportModel {
  const locale = input.locale ?? "tr";
  const screenshotDataUris = input.screenshotDataUris ?? new Map();
  const url = new URL(input.request.targetUrl);
  const issues = aggregateScanIssues(input.findings, { auditedPages: input.pages });
  const problems = buildReportProblems(input.findings, locale, screenshotDataUris);

  return {
    // ...all existing fields unchanged...
    locale,
    problems
  };
}
```

(Keep every existing model field; only add `locale` and `problems`.)

- [ ] **Step 4: Run the test + typecheck**

Run: `./node_modules/.bin/vitest run packages/reporter/src/report-model.test.ts` → PASS.
Run: `./node_modules/.bin/tsc -p packages/reporter/tsconfig.json --noEmit` → exit 0.
(The existing `html-template.test.ts` may break because the model now requires `locale`/`problems` — that is fixed in Task 4. If it errors now, proceed; Task 4 covers it.)

- [ ] **Step 5: Commit**

```bash
git add packages/reporter/src/report-model.ts packages/reporter/src/report-model.test.ts
git commit -m "feat(reporter): roll up findings into per-rule report problems"
```

---

## Task 4: Localized template rewrite

**Files:**
- Modify: `packages/reporter/src/html-template.ts`
- Modify: `packages/reporter/src/html-template.test.ts`

- [ ] **Step 1: Update the tests for the new structure**

Replace the assertions in `packages/reporter/src/html-template.test.ts` (keep the `buildAuditReportModel(...)` setup from the existing "real report rendering" test; that test already builds findings with rule `image-alt`/etc.). The first test (`renders report sections and disclaimer`) currently passes a literal model — extend it with `locale: "tr"` and `problems: []`. Then assert:

```ts
  it("renders a Turkish report with score band, severity colors, and the honest disclaimer", () => {
    const html = renderReportHtml({
      projectName: "admelektrik.com.tr",
      domain: "admelektrik.com.tr",
      score: 62,
      pagesAudited: 12,
      findingsTotal: 0,
      uniqueIssues: 0,
      totalOccurrences: 0,
      generatedAt: "2026-06-03T09:14:00.000Z",
      findings: [],
      issues: [],
      pages: [],
      targetUrl: "https://admelektrik.com.tr",
      mode: "same_domain_crawl",
      locale: "tr",
      problems: []
    });

    expect(html).toContain("Erişilebilirlik Denetim Raporu");
    expect(html).toContain("Geliştirilmeli");           // score band 62 -> Needs Work (tr)
    expect(html).toContain("#c0392b");                  // critical color present in legend/style
    expect(html).toContain("Yasal uyumluluğu belgelemez."); // honest disclaimer (tr)
    expect(html).not.toMatch(/certif(y|ies) .*complian/i);
  });
```

Add an `en` smoke test asserting `"Accessibility Audit Report"` and `"does not certify legal compliance"` appear when `locale: "en"`.

For a card test, build a model via `buildAuditReportModel` with a `button-name`/`4.1.2` finding (the existing setup has findings — reuse/add one) and assert the rendered HTML contains the rule headline, `"4.1.2"`, the localized WCAG name, the W3C URL `name-role-value`, the `howToFix` text differing from the title, and the element's `htmlSnippet` (escaped).

- [ ] **Step 2: Run to verify failure**

Run: `./node_modules/.bin/vitest run packages/reporter/src/html-template.test.ts`
Expected: FAIL — template still renders the old English flat structure.

- [ ] **Step 3: Rewrite the template**

Rewrite `packages/reporter/src/html-template.ts` to render the localized structure. Use `reportStrings(report.locale)`, `severityLabel`, `scoreBand`, `formatReportDate`, `formatMode`, `SEVERITY_COLORS` from `./i18n.js`, and `report.problems`. Keep `escapeHtml`. Structure (top to bottom): cover (domain, formatted date + mode, score with band color/label, one-line verdict), at-a-glance (colored severity badges from `report.severitySummary`/counts + counts), "Fix these first" (top 5 of `report.problems`), grouped problem cards, manual-review notice + disclaimer, technical appendix (reuse the existing raw-occurrence + evidence tables, relabeled via i18n and placed last).

Each problem card renders:

```ts
function renderProblemCard(problem: ReportProblem, strings: ReportStrings, locale: ReportLocale): string {
  const sevColor = SEVERITY_COLORS[problem.severity];
  const crit = problem.criterion;
  const wcagLine = crit
    ? `<a href="${escapeHtml(crit.w3cUrl)}">WCAG ${escapeHtml(crit.id)} — ${escapeHtml(crit.name)} (${escapeHtml(crit.level)})</a>`
    : escapeHtml(problem.wcagCriteria.join(", "));
  const impact = crit ? escapeHtml(crit.content.userImpact) : "";
  const fix = crit ? escapeHtml(crit.content.howToFix) : "";
  const elements = problem.elements.map((el) => `
    <div class="element">
      ${el.screenshotDataUri ? `<img class="shot" alt="" src="${el.screenshotDataUri}" />` : ""}
      <div class="element-detail">
        <pre class="snippet">${escapeHtml(el.htmlSnippet ?? "")}</pre>
        <div class="element-meta">${strings.selector} <code>${escapeHtml(el.selector ?? "—")}</code> · ${strings.page} ${escapeHtml(el.pageUrl)} · ${escapeHtml(el.viewport)}</div>
      </div>
    </div>`).join("");

  return `<div class="card problem">
    <div class="problem-head"><span class="sev" style="background:${sevColor}">${escapeHtml(severityLabel(problem.severity, locale))}</span> <strong>${escapeHtml(problem.title)}</strong></div>
    <div class="wcag-line">${wcagLine} · ${problem.occurrences} ${strings.occurrences} · ${problem.affectedPages} ${strings.affectedPages}</div>
    <div class="block"><b>${strings.whatItMeans}</b><br>${impact}</div>
    <div class="block"><b>${strings.howToFix}</b><br>${fix}</div>
    <div class="block"><b>${strings.whereFound} (${problem.elements.length})</b>${elements}</div>
  </div>`;
}
```

Add CSS for `.sev` (white text, rounded), `.problem`, `.snippet` (dark code block), `.shot` (max-width ~120px), `.element` (flex), score-band/cover styling, and the four `SEVERITY_COLORS` used in the at-a-glance legend. The `renderReportHtml(report, options)` signature is unchanged.

- [ ] **Step 4: Run tests + typecheck**

Run: `./node_modules/.bin/vitest run packages/reporter/src/html-template.test.ts` → PASS.
Run: `./node_modules/.bin/tsc -p packages/reporter/tsconfig.json --noEmit` → exit 0.

- [ ] **Step 5: Build reporter + commit**

Run: `npx pnpm@9 -r --filter "./packages/reporter" build`

```bash
git add packages/reporter/src/html-template.ts packages/reporter/src/html-template.test.ts
git commit -m "feat(reporter): localized, grouped, two-audience report template"
```

---

## Task 5: Embed page screenshots + pass locale (scan-engine)

**Files:**
- Modify: `packages/audit/src/scan-engine.ts`
- Test: `packages/audit/src/scan-engine.test.ts`

- [ ] **Step 1: Add a failing test**

In `packages/audit/src/scan-engine.test.ts` (it already drives `runScan` with a fake storage/Playwright setup — mirror the existing harness), add a test asserting the stored HTML report contains a `data:image/` URI when a finding has a `page_screenshot` evidence artifact. If the existing harness makes asserting report HTML hard, instead unit-test the new helper directly: export `collectScreenshotDataUris(findings, storage)` and assert it reads each `page_screenshot`/`element_crop` artifact via `storage.get` and returns a `Map<artifactKey, "data:<mime>;base64,...">`.

```ts
it("collects screenshot artifacts as data uris", async () => {
  const storage = {
    get: async (key: string) => Buffer.from(`bytes-${key}`),
    put: async () => ({ key: "", mimeType: "", sizeBytes: 0 }),
    delete: async () => undefined
  };
  const findings = [{
    evidence: [{ kind: "page_screenshot", artifactKey: "k1", mimeType: "image/png", sizeBytes: 1 }]
  }] as any;
  const map = await collectScreenshotDataUris(findings, storage as any);
  expect(map.get("k1")).toBe(`data:image/png;base64,${Buffer.from("bytes-k1").toString("base64")}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run packages/audit/src/scan-engine.test.ts -t "data uris"`
Expected: FAIL — `collectScreenshotDataUris` not exported.

- [ ] **Step 3: Implement the collector + wire it into `storeReports`**

In `packages/audit/src/scan-engine.ts`, add:

```ts
export async function collectScreenshotDataUris(
  findings: ScanFinding[],
  storage: StorageAdapter
): Promise<Map<string, string>> {
  const keys = new Map<string, string>(); // artifactKey -> mimeType
  for (const finding of findings) {
    for (const evidence of finding.evidence) {
      if (evidence.kind === "page_screenshot" || evidence.kind === "element_screenshot") {
        keys.set(evidence.artifactKey, evidence.mimeType);
      }
    }
  }

  const result = new Map<string, string>();
  for (const [key, mimeType] of keys) {
    try {
      const bytes = await storage.get(key);
      result.set(key, `data:${mimeType};base64,${bytes.toString("base64")}`);
    } catch {
      // missing artifact -> skip; the report renders that element without an image
    }
  }
  return result;
}
```

In `storeReports`, before `buildAuditReportModel`, build the map and pass it + the locale (default `"tr"`):

```ts
  const screenshotDataUris = await collectScreenshotDataUris(reportInput.findings, input.storage);
  const report = buildAuditReportModel({
    request: input.request,
    pages: reportInput.pages,
    findings: reportInput.findings,
    score: reportInput.score,
    generatedAt,
    locale: "tr",
    screenshotDataUris
  });
```

(`StorageAdapter` and `ScanFinding` are already imported in scan-engine; if not, add them.)

- [ ] **Step 4: Run the test + the audit suite + typecheck**

Run: `./node_modules/.bin/vitest run packages/audit/src/scan-engine.test.ts` → PASS (including existing tests).
Run: `./node_modules/.bin/tsc -p packages/audit/tsconfig.json --noEmit` → exit 0.

- [ ] **Step 5: Build audit + commit**

Run: `npx pnpm@9 -r --filter "./packages/audit" build`

```bash
git add packages/audit/src/scan-engine.ts packages/audit/src/scan-engine.test.ts
git commit -m "feat(audit): embed screenshots and default report locale to Turkish"
```

---

## Task 6: Document the localized-report principle override

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/wcag-22-coverage-guide.md` (or `docs/superpowers/specs/2026-05-31-a11yaudit-design.md`)

- [ ] **Step 1: Edit the principle**

In `CLAUDE.md` under "Product principles", change the English-only line so it scopes to code/UI and notes the localized report. Replace:

```
- **English-only** product surface (UI, CLI, PDF, rule text, comments). Planning chat with the owner may be Turkish; shipped copy is not.
```

with:

```
- **English-only** code surface (web UI, CLI, rule identifiers, comments). The **downloaded audit report is localized** (Turkish default, English available) because the customer base is Turkish — this is the one deliverable exempt from English-only. Planning chat with the owner may be Turkish.
```

Add a one-line note to `docs/wcag-22-coverage-guide.md` that report criterion copy (impact/fix) lives in `packages/core/src/wcag-content.ts`, keyed by criterion + locale, sourced from W3C WCAG 2.2.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md docs/wcag-22-coverage-guide.md
git commit -m "docs: scope English-only to code; report is localized"
```

---

## Task 7 (Phase 2): Element-highlighted screenshot capture

**Files:**
- Modify: `packages/audit/src/evidence.ts`
- Modify: `packages/audit/src/scan-engine.ts`
- Test: `packages/audit/src/evidence.test.ts`

> **Phase boundary:** Tasks 1–6 ship a complete, mergeable report (elements show the page-level screenshot). Task 7 upgrades the per-element image to an element-highlighted crop. It can be a separate PR.

- [ ] **Step 1: Write the failing test**

In `packages/audit/src/evidence.test.ts` (the evidence module is unit-tested against a fake Playwright `Page`/`ElementHandle`-like object and a fake storage — mirror the existing test style), add a test for a new `captureElementCropEvidence` that: outlines the element, reads its bounding box, screenshots a clipped region, removes the outline, stores the bytes via storage, and returns an `EvidenceArtifact` with `kind: "element_screenshot"`. Assert the outline is set then cleared (track calls on the fake element), and the stored artifact has `kind: "element_screenshot"`.

```ts
it("captures an element crop with a temporary highlight", async () => {
  const calls: string[] = [];
  const el = {
    evaluate: async (_fn: unknown) => { calls.push("style"); },
    boundingBox: async () => ({ x: 10, y: 20, width: 100, height: 30 })
  };
  const page = {
    screenshot: async (_opts: unknown) => Buffer.from("png"),
    viewportSize: () => ({ width: 1440, height: 900 })
  };
  const storage = { put: async (k: string) => ({ key: k, mimeType: "image/png", sizeBytes: 3 }), get: async () => Buffer.from(""), delete: async () => undefined };

  const artifact = await captureElementCropEvidence({ runId: "r1", page: page as any, element: el as any, fingerprint: "fp", storage: storage as any });
  expect(artifact?.kind).toBe("element_screenshot");
  expect(calls.filter((c) => c === "style").length).toBeGreaterThanOrEqual(2); // set + clear
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run packages/audit/src/evidence.test.ts -t "element crop"`
Expected: FAIL — `captureElementCropEvidence` not defined.

- [ ] **Step 3: Implement the crop capture**

In `packages/audit/src/evidence.ts`, add `captureElementCropEvidence` that highlights the element, clips a context-padded region clamped to the viewport, screenshots, clears the highlight, stores under an `element_crop` artifact key, and returns the evidence. Use a constant `CROP_CONTEXT_PADDING = 24`.

```ts
export async function captureElementCropEvidence(input: {
  runId: string;
  page: Page;
  element: ElementHandle<Element>;
  fingerprint: string;
  storage: StorageAdapter;
}): Promise<EvidenceArtifact | null> {
  try {
    await input.element.evaluate((node) => {
      const el = node as HTMLElement;
      el.dataset.aaPrevOutline = el.style.outline;
      el.style.outline = "3px solid #e11d48";
      el.style.outlineOffset = "2px";
    });
    const box = await input.element.boundingBox();
    if (!box) {
      await clearHighlight(input.element);
      return null;
    }
    const viewport = input.page.viewportSize() ?? { width: box.x + box.width, height: box.y + box.height };
    const pad = 24;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(viewport.width, box.width + pad * 2),
      height: Math.min(viewport.height, box.height + pad * 2)
    };
    const png = await input.page.screenshot({ type: "png", clip });
    await clearHighlight(input.element);

    const key = createArtifactKey({ runId: input.runId, kind: "crop", name: `${input.fingerprint}:crop`, extension: "png" });
    const stored = await input.storage.put(key, Buffer.from(png), "image/png");
    return { kind: "element_screenshot", artifactKey: stored.key, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes };
  } catch {
    await clearHighlight(input.element).catch(() => undefined);
    return null;
  }
}

async function clearHighlight(element: ElementHandle<Element>): Promise<void> {
  await element.evaluate((node) => {
    const el = node as HTMLElement;
    el.style.outline = el.dataset.aaPrevOutline ?? "";
    delete el.dataset.aaPrevOutline;
  });
}
```

(Import `ElementHandle` from `playwright`, `createArtifactKey`/`StorageAdapter` from `@a11yaudit/storage`, `EvidenceArtifact` from `@a11yaudit/core` — match the existing imports in `evidence.ts`/`scan-engine.ts`.)

- [ ] **Step 4: Wire it into the scan loop (bounded)**

In `packages/audit/src/scan-engine.ts`, where each `auditResult.findings` is processed, for findings that have a `selector`, resolve the element (`page.$(finding.selector)`) and call `captureElementCropEvidence`, appending the returned `element_crop` artifact to that finding's `evidence` (before the page screenshot, so `preferredScreenshotKey` picks the crop). Cap the number of crops per page with a constant `MAX_ELEMENT_CROPS_PER_PAGE = 30`; when the cap is hit, stop capturing crops for that page and `reportWarnings.push(...)`/log that crops were truncated (never silent). A crop failure must not fail the page (the function already returns `null` on error).

- [ ] **Step 5: Run tests + audit suite + typecheck**

Run: `./node_modules/.bin/vitest run packages/audit` → PASS.
Run: `./node_modules/.bin/tsc -p packages/audit/tsconfig.json --noEmit` → exit 0.

- [ ] **Step 6: Build audit + commit**

```bash
git add packages/audit/src/evidence.ts packages/audit/src/scan-engine.ts packages/audit/src/evidence.test.ts
git commit -m "feat(audit): capture element-highlighted screenshot crops"
```

---

## Final verification

- [ ] Full suite: `./node_modules/.bin/vitest run` → all pass.
- [ ] All package typechecks: `./node_modules/.bin/tsc -p packages/core/tsconfig.json --noEmit`, `... packages/reporter ...`, `... packages/audit ...` → exit 0.
- [ ] Build everything: `npx pnpm@9 -r --filter "./packages/*" build` → done.
- [ ] Manual smoke (optional): re-run a real scan via the running server, download the report, confirm: Turkish, score band, colored severities, grouped cards with WCAG name + W3C link + distinct impact/fix, per-element HTML + screenshot, technical appendix at the end.
- [ ] Open a PR from `feature/report-redesign` to `main` (Phase 1 = Tasks 1–6; Phase 2 = Task 7, optionally a second PR).
```
