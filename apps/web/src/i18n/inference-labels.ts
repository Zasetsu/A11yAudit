import type { Locale } from "./messages.js";

// The issue-inference fields (likely scope, component area, CMS hint) are produced
// by the engine as English tokens. The dashboard is localized, so map them to the
// active locale for display. Unknown values fall back to the raw token.

const SCOPE_GLOBAL: Record<Locale, string> = { tr: "Site geneli", en: "Site-wide" };
const SCOPE_SINGLE: Record<Locale, string> = { tr: "Tek sayfa", en: "Single page" };
const SCOPE_URL_GROUP_PREFIX: Record<Locale, string> = { tr: "URL grubu ", en: "URL group " };
const URL_GROUP_TOKEN = "URL group ";

export function scopeLabel(scope: string, locale: Locale): string {
  if (scope === "global") return SCOPE_GLOBAL[locale];
  if (scope === "single page") return SCOPE_SINGLE[locale];
  if (scope.startsWith(URL_GROUP_TOKEN)) {
    return SCOPE_URL_GROUP_PREFIX[locale] + scope.slice(URL_GROUP_TOKEN.length);
  }
  return scope;
}

const AREA_LABELS: Record<string, Record<Locale, string>> = {
  header: { tr: "Üst bilgi", en: "Header" },
  footer: { tr: "Alt bilgi", en: "Footer" },
  nav: { tr: "Gezinme", en: "Navigation" },
  aside: { tr: "Yan alan", en: "Sidebar" },
  form: { tr: "Form", en: "Form" },
  main: { tr: "Ana içerik", en: "Main content" },
  unknown: { tr: "Bilinmiyor", en: "Unknown" }
};

export function areaLabel(area: string, locale: Locale): string {
  return AREA_LABELS[area]?.[locale] ?? area;
}

// CMS hint is optional enrichment (e.g. Elementor/WordPress, proper nouns kept as-is).
// When the engine found no CMS signal it returns "none"; show a localized "absent" label.
const CMS_NONE: Record<Locale, string> = { tr: "Yok", en: "None" };

export function cmsLabel(cms: string, locale: Locale): string {
  if (cms === "none") return CMS_NONE[locale];
  return cms;
}
