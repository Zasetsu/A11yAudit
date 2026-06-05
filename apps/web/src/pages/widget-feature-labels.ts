import {
  ASSIST_SECTIONS,
  CONTENT_FEATURES,
  NAVIGATION_FEATURES,
  COLOR_FEATURES
} from "@a11yaudit/assist-widget/widget-config";
import type { Locale } from "../i18n/messages.js";

// The engine identifies sections and features by stable English ids. The dashboard
// is localized, so map each id to a display label per locale. Kept here (not the
// message catalog) because it is a closed, feature-specific vocabulary.

type LabelPair = Record<Locale, string>;

const SECTION_LABELS: Record<string, LabelPair> = {
  content: { tr: "İçerik", en: "Content" },
  navigation: { tr: "Gezinme", en: "Navigation" },
  color: { tr: "Renk ve kontrast", en: "Color & contrast" }
};

const FEATURE_LABELS: Record<string, LabelPair> = {
  lineHeight: { tr: "Satır yüksekliği", en: "Line height" },
  textSize: { tr: "Yazı boyutu", en: "Text size" },
  largeCursor: { tr: "Büyük imleç", en: "Large cursor" },
  hideImages: { tr: "Görselleri gizle", en: "Hide images" },
  stopAnimations: { tr: "Animasyonları durdur", en: "Stop animations" },
  hints: { tr: "İpuçları", en: "Tooltips" },
  fonts: { tr: "Yazı tipi", en: "Font" },
  textSpacing: { tr: "Harf aralığı", en: "Text spacing" },
  textAlignment: { tr: "Metin hizalama", en: "Text alignment" },
  magnifier: { tr: "Büyüteç", en: "Magnifier" },
  pageReader: { tr: "Sayfa okuyucu", en: "Page reader" },
  readingGuide: { tr: "Okuma kılavuzu", en: "Reading guide" },
  readingMask: { tr: "Okuma maskesi", en: "Reading mask" },
  highlightLinks: { tr: "Linkleri belirginleştir", en: "Highlight links" },
  readingMode: { tr: "Okuma modu", en: "Reading mode" },
  muteSound: { tr: "Sesi kapat", en: "Mute sound" },
  highlightFocus: { tr: "Odağı belirginleştir", en: "Highlight focus" },
  pageStructure: { tr: "Sayfa yapısı", en: "Page structure" },
  monochrome: { tr: "Tek renk", en: "Monochrome" },
  saturation: { tr: "Doygunluk", en: "Saturation" },
  smartContrast: { tr: "Akıllı kontrast", en: "Smart contrast" },
  brightness: { tr: "Parlaklık", en: "Brightness" },
  contrast: { tr: "Kontrast", en: "Contrast" }
};

export interface WidgetSectionGroup {
  id: (typeof ASSIST_SECTIONS)[number];
  features: readonly string[];
}

export const WIDGET_SECTION_GROUPS: WidgetSectionGroup[] = [
  { id: "content", features: CONTENT_FEATURES },
  { id: "navigation", features: NAVIGATION_FEATURES },
  { id: "color", features: COLOR_FEATURES }
];

const POSITION_LABELS: Record<string, LabelPair> = {
  "bottom-right": { tr: "Sağ alt", en: "Bottom right" },
  "bottom-left": { tr: "Sol alt", en: "Bottom left" },
  "top-right": { tr: "Sağ üst", en: "Top right" },
  "top-left": { tr: "Sol üst", en: "Top left" }
};

export function positionLabel(id: string, locale: Locale): string {
  return POSITION_LABELS[id]?.[locale] ?? id;
}

export function sectionLabel(id: string, locale: Locale): string {
  return SECTION_LABELS[id]?.[locale] ?? id;
}

export function featureLabel(id: string, locale: Locale): string {
  return FEATURE_LABELS[id]?.[locale] ?? id;
}
