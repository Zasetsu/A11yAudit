import type { Viewport } from "./models.js";

export const DEFAULT_VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
];

export const DEFAULT_SCAN_LIMITS = {
  maxPages: 250,
  maxDepth: 3,
  pageTimeoutMs: 30_000,
  navigationTimeoutMs: 45_000,
  maxRedirects: 5,
  maxHtmlBytes: 5 * 1024 * 1024,
  respectRobotsTxt: true
} as const;
