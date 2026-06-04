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
