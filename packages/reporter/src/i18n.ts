import type { ReportLocale, Severity } from "@a11yaudit/core";

export interface ReportStrings {
  reportTitle: string;
  atAGlance: string;
  fixFirst: string;
  allIssues: string;
  whatItMeans: string;
  howToFix: string;
  whereFound: string;
  wcagReference: string;
  wcagIndexUrl: string;
  genericImpact: string;
  genericFix: string;
  moreElements: string;
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
    atAGlance: "Genel bakış",
    fixFirst: "Önce bunları düzeltin",
    allIssues: "Tüm sorunlar",
    whatItMeans: "Bu ne demek",
    howToFix: "Nasıl düzeltilir",
    whereFound: "Nerede bulundu",
    wcagReference: "WCAG 2.2 kaynağı",
    wcagIndexUrl: "https://www.w3.org/WAI/WCAG22/Understanding/",
    genericImpact: "Bu kriter otomatik olarak tam değerlendirilemez ve manuel inceleme gerektirir. Etkisini ve karşılama yöntemini bağlantılı WCAG 2.2 kaynağından inceleyin.",
    genericFix: "Bu başarı kriterinin nasıl karşılanacağına ilişkin ayrıntılar için bağlantılı W3C WCAG 2.2 belgesine başvurun.",
    moreElements: "+ {n} element daha, aynı biçimde",
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
    atAGlance: "At a glance",
    fixFirst: "Fix these first",
    allIssues: "All issues",
    whatItMeans: "What this means",
    howToFix: "How to fix",
    whereFound: "Where it was found",
    wcagReference: "WCAG 2.2 reference",
    wcagIndexUrl: "https://www.w3.org/WAI/WCAG22/Understanding/",
    genericImpact: "This criterion cannot be fully evaluated automatically and requires manual review. See the linked WCAG 2.2 resource for its impact and how to meet it.",
    genericFix: "Refer to the linked W3C WCAG 2.2 document for details on how to meet this success criterion.",
    moreElements: "+ {n} more elements, same format",
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
