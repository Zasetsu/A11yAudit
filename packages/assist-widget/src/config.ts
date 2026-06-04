export const CONTENT_FEATURES = [
  "lineHeight",
  "textSize",
  "largeCursor",
  "hideImages",
  "stopAnimations",
  "hints",
  "fonts",
  "textSpacing",
  "textAlignment",
  "magnifier"
] as const;

export const NAVIGATION_FEATURES = [
  "pageReader",
  "readingGuide",
  "readingMask",
  "highlightLinks",
  "readingMode",
  "muteSound",
  "highlightFocus",
  "pageStructure"
] as const;

export const COLOR_FEATURES = [
  "monochrome",
  "saturation",
  "smartContrast",
  "brightness",
  "contrast"
] as const;

export const ASSIST_SECTIONS = ["content", "navigation", "color"] as const;
export type AssistSection = (typeof ASSIST_SECTIONS)[number];

export const STORAGE_KEY = "aa-assist-preferences";
export const WIDGET_PREFIX = "aa-assist";
