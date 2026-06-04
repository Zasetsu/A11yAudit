export type ReportLocale = "tr" | "en";

export interface WcagCriterionContent {
  name: string;
  userImpact: string;
  howToFix: string;
  w3cUrl: string;
}

export const WCAG_CRITERION_CONTENT: Record<string, Record<ReportLocale, WcagCriterionContent>> = {
  "1.1.1": {
    tr: {
      name: "Metinsel Olmayan İçerik (Non-text Content)",
      userImpact:
        "Ekran okuyucu kullanan görme engelli kullanıcılar, alternatif metin bulunmayan görsellerin içeriğini duyamaz; resim yalnızca \"image\" ya da dosya adı olarak okunur.",
      howToFix:
        "Her bilgi taşıyan görsele anlamlı bir alt metni (alt attribute) ekleyin. Yalnızca süsleme amaçlı görseller için alt=\"\" kullanın. Karmaşık grafikler için uzun açıklama ya da aria-describedby ekleyin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
    },
    en: {
      name: "Non-text Content",
      userImpact:
        "Screen-reader users who are blind cannot perceive images that lack a text alternative; the image is announced only as \"image\" or its filename.",
      howToFix:
        "Add a meaningful alt attribute to every informative image. Use alt=\"\" for purely decorative images. For complex graphics, provide a long description or aria-describedby.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
    },
  },

  "1.3.1": {
    tr: {
      name: "Bilgi ve İlişkiler (Info and Relationships)",
      userImpact:
        "Ekran okuyucu kullanıcılar görsel düzenden anlam çıkaramaz; başlık, liste veya tablo gibi yapılar programatik olarak belirtilmezse içerik sıradan metin gibi okunur.",
      howToFix:
        "Yapıyı semantik HTML öğeleriyle aktarın: başlıklar için <h1>–<h6>, listeler için <ul>/<ol>/<li>, veri tabloları için <table>/<th>/<caption> kullanın. Renk, konum veya biçimlendirmeyle iletilen bilgiyi metin ya da ARIA ile de sunun.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
    },
    en: {
      name: "Info and Relationships",
      userImpact:
        "Screen-reader users cannot infer meaning from visual layout alone; headings, lists, or table structures that are only implied visually are read as plain text.",
      howToFix:
        "Convey structure using semantic HTML: <h1>–<h6> for headings, <ul>/<ol>/<li> for lists, <table>/<th>/<caption> for data tables. Any information conveyed by color, position, or formatting must also be available as text or ARIA.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
    },
  },

  "1.4.3": {
    tr: {
      name: "Kontrast (Minimum) (Contrast (Minimum))",
      userImpact:
        "Az gören kullanıcılar düşük kontrastlı metni okuyamaz; metin arka planından yeterince ayrışmaz.",
      howToFix:
        "Normal metin için en az 4.5:1, büyük metin için en az 3:1 kontrast oranı sağlayın. Metin veya arka plan renklerini koyulaştırıp açarak oranı yükseltin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    },
    en: {
      name: "Contrast (Minimum)",
      userImpact:
        "Low-vision users cannot read low-contrast text because it does not stand out enough from its background.",
      howToFix:
        "Ensure a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text. Darken or lighten the text or background to raise the ratio.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    },
  },

  "2.1.1": {
    tr: {
      name: "Klavye (Keyboard)",
      userImpact:
        "Yalnızca klavye ya da klavye benzeri yardımcı teknoloji kullanan kullanıcılar, fareyle tıklanabilen bu kontrolü çalıştıramaz; öğeye sekme (Tab) ile ulaşılamadığı veya Enter/Space ile etkinleştirilemediği için işlev tamamen erişilemez kalır.",
      howToFix:
        "Tüm etkileşimli kontrolleri klavyeyle erişilebilir yapın: yerel <a>/<button> öğelerini kullanın ya da özel öğelerde tabindex=\"0\", uygun rol ve klavye olay işleyicileri (Enter/Space) ekleyin. Yalnızca onclick içeren <div>/<span> kontrollerinden kaçının.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    },
    en: {
      name: "Keyboard",
      userImpact:
        "Users who rely on a keyboard or keyboard-like assistive technology cannot operate this control because it cannot be reached with Tab or activated with Enter/Space, leaving the function entirely inaccessible.",
      howToFix:
        "Make all interactive controls keyboard-operable: use native <a>/<button> elements, or for custom widgets add tabindex=\"0\", an appropriate role, and keyboard handlers (Enter/Space). Avoid <div>/<span> controls that only have an onclick handler.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    },
  },

  "2.1.2": {
    tr: {
      name: "Klavye Tuzağı Yok (No Keyboard Trap)",
      userImpact:
        "Yalnızca klavye kullanan kullanıcılar bir bileşene (ör. modal, gömülü oynatıcı) sekmeyle girdikten sonra dışarı çıkamazsa sayfanın geri kalanında gezinemez ve sıkışıp kalır.",
      howToFix:
        "Klavye odağının her bileşene girip standart yöntemlerle (Tab/Shift+Tab veya Esc) çıkabildiğinden emin olun. Modal/overlay'lerde odağı tutarken kapatma yolunu (Esc) sağlayın ve odağı döngüye sokan hatalı tuzakları kaldırın.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html",
    },
    en: {
      name: "No Keyboard Trap",
      userImpact:
        "Keyboard-only users who tab into a component (e.g. a modal or embedded player) and cannot tab back out get stuck and can no longer navigate the rest of the page.",
      howToFix:
        "Ensure keyboard focus can enter and leave every component using standard means (Tab/Shift+Tab or Esc). In modals/overlays that trap focus deliberately, always provide an Esc exit, and remove faulty traps that cycle focus.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html",
    },
  },

  "2.4.4": {
    tr: {
      name: "Bağlantı Amacı (Bağlamda) (Link Purpose (In Context))",
      userImpact:
        "Ekran okuyucu kullanıcılar bağlantıları listeden okurken \"buraya tıklayın\" veya \"daha fazla\" gibi belirsiz metinlerin nereye gittiğini anlayamaz.",
      howToFix:
        "Her bağlantının metni bağlamından bağımsız olarak bağlantının amacını açıklamalıdır. Belirsiz metinler için aria-label veya aria-describedby ile açıklayıcı bir isim ekleyin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
    },
    en: {
      name: "Link Purpose (In Context)",
      userImpact:
        "Screen-reader users navigating a list of links cannot determine where \"click here\" or \"read more\" links lead without additional context.",
      howToFix:
        "Make each link's text describe the link's purpose on its own. For ambiguous link text, add a descriptive name via aria-label or aria-describedby.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
    },
  },

  "2.4.7": {
    tr: {
      name: "Odak Görünür (Focus Visible)",
      userImpact:
        "Yalnızca klavye kullanan kullanıcılar, odak göstergesi olmadan sayfada hangi öğenin aktif olduğunu göremez ve gezinmeyi takip edemez.",
      howToFix:
        "Klavye odağını alan tüm etkileşimli öğelerde görünür bir odak halkası veya stili olduğundan emin olun. CSS'teki :focus veya :focus-visible gizleme kurallarını (outline: none; outline: 0) kaldırın veya görünür alternatif bir stil sağlayın.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
    },
    en: {
      name: "Focus Visible",
      userImpact:
        "Keyboard-only users cannot see which element is currently active on the page when there is no visible focus indicator, making navigation impossible to follow.",
      howToFix:
        "Ensure all interactive elements display a visible focus ring or style when they receive keyboard focus. Remove or replace CSS rules that hide focus (outline: none; outline: 0) and provide a visible :focus or :focus-visible style instead.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
    },
  },

  "2.4.11": {
    tr: {
      name: "Odak Gizlenmemiş (Minimum) (Focus Not Obscured (Minimum))",
      userImpact:
        "Yapışkan başlık, altbilgi veya çerez bildirimi gibi sabit konumlu öğeler odaklanan bileşeni tamamen gizlerse klavye kullanıcıları nerede olduklarını göremez.",
      howToFix:
        "Sayfayı kaydırdığınızda odaklanan öğenin en az kısmen görünür kalmasını sağlayın. scroll-margin veya scroll-padding CSS özellikleri ya da örtüşmeyi önleyen düzen değişiklikleri ile sabit katmanların altında kalmasını engelleyin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html",
    },
    en: {
      name: "Focus Not Obscured (Minimum)",
      userImpact:
        "Keyboard users lose sight of their position on the page when sticky headers, footers, or cookie banners fully cover the focused element.",
      howToFix:
        "Ensure the focused component remains at least partially visible after the page scrolls. Use scroll-margin or scroll-padding CSS, or adjust layout so fixed layers do not fully overlap focused elements.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html",
    },
  },

  "2.5.8": {
    tr: {
      name: "Hedef Boyutu (Minimum) (Target Size (Minimum))",
      userImpact:
        "Motor engelli kullanıcılar veya dokunmatik ekran kullananlar, küçük tıklama hedeflerine doğru şekilde tıklamakta güçlük çeker ve yanlış öğeyi etkinleştirir.",
      howToFix:
        "Etkileşimli öğelerin tıklama/dokunma alanını en az 24×24 CSS piksel yapın (WCAG AA minimum). Görsel boyutu büyütmek yerine padding ile tıklanabilir alanı genişletin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    },
    en: {
      name: "Target Size (Minimum)",
      userImpact:
        "Users with motor impairments or on touch screens struggle to accurately tap small targets and may activate the wrong element.",
      howToFix:
        "Make the click/touch area of interactive elements at least 24×24 CSS pixels (WCAG AA minimum). Expand the tappable area using padding rather than increasing the visible size.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    },
  },

  "4.1.2": {
    tr: {
      name: "Ad, Rol, Değer (Name, Role, Value)",
      userImpact:
        "Ekran okuyucu kullanıcılar bu kontrolün ne işe yaradığını duyamaz; yalnızca \"buton\" gibi etiketsiz bir ifade duyarlar ve işlevi anlayamazlar.",
      howToFix:
        "Her etkileşimli öğeye erişilebilir bir ad verin: görünür metin, aria-label veya başlık (title) ekleyin; özel bileşenlerde doğru rol ve durum (state) değerlerini belirtin.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
    },
    en: {
      name: "Name, Role, Value",
      userImpact:
        "Screen-reader users hear no label for this control, only something like \"button\", so they cannot tell what it does.",
      howToFix:
        "Give every interactive element an accessible name: add visible text, an aria-label, or a title; for custom widgets, expose the correct role and state.",
      w3cUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
    },
  },
};

export function getCriterionContent(
  criterionId: string,
  locale: ReportLocale,
): WcagCriterionContent | null {
  return WCAG_CRITERION_CONTENT[criterionId]?.[locale] ?? null;
}
