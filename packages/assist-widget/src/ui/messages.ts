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
