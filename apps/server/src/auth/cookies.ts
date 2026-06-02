export const sessionCookieName = "a11yaudit_session";
export const csrfCookieName = "a11yaudit_csrf";

export interface CookieOptions {
  httpOnly?: boolean;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    `SameSite=${options.sameSite ?? "Lax"}`
  ];

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function serializeSessionCookie(sessionToken: string): string {
  return serializeCookie(sessionCookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  });
}

export function serializeCsrfCookie(csrfToken: string): string {
  return serializeCookie(csrfCookieName, csrfToken, {
    secure: process.env.NODE_ENV === "production"
  });
}
