const SUSPICIOUS_ALT = new Set(["image", "photo", "picture", "logo", "img", "graphic"]);
const WEAK_LINK_TEXT = new Set(["click here", "read more", "details", "learn more", "more"]);

export function isSuspiciousAltText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (SUSPICIOUS_ALT.has(normalized)) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(normalized);
}

export function isWeakLinkText(value: string): boolean {
  return WEAK_LINK_TEXT.has(value.trim().toLowerCase());
}
