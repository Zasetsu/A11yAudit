const TRACKING_PARAMS = ["fbclid", "gclid", "yclid"];
const STATIC_EXTENSIONS = [".pdf", ".zip", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".docx", ".xlsx"];

export function normalizeAuditUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || TRACKING_PARAMS.includes(key)) {
      url.searchParams.delete(key);
    }
  }

  const pathname = url.pathname !== "/" && url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname;
  url.pathname = pathname;

  const query = url.searchParams.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

export function shouldSkipUrl(input: string): boolean {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) return true;
    return STATIC_EXTENSIONS.some((ext) => url.pathname.toLowerCase().endsWith(ext));
  } catch {
    return true;
  }
}
