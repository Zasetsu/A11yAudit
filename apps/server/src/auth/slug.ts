const RESERVED_WORKSPACE_SLUGS = new Set([
  "api",
  "admin",
  "login",
  "logout",
  "signup",
  "settings",
  "new",
  "invite",
  "workspaces",
]);

const MAX_WORKSPACE_SLUG_LENGTH = 64;
const TURKISH_ASCII_REPLACEMENTS: Record<string, string> = {
  "ı": "i",
  "İ": "I",
  "ğ": "g",
  "Ğ": "G",
  "ş": "s",
  "Ş": "S",
};

export function baseWorkspaceSlug(name: string): string {
  const normalized = Array.from(name)
    .map((character) => TURKISH_ASCII_REPLACEMENTS[character] ?? character)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_WORKSPACE_SLUG_LENGTH)
    .replace(/-+$/g, "");

  const slug = normalized || "workspace";

  if (RESERVED_WORKSPACE_SLUGS.has(slug)) {
    return `workspace-${slug}`;
  }

  return slug;
}
