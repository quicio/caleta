// Cookie helpers. El prefijo `__Host-` exige Secure + Path=/ + sin Domain.
// En dev (http://localhost) omitimos Secure porque los browsers lo rechazan.

export const SESSION_COOKIE = "__Host-caleta_session";
export const REFRESH_COOKIE = "__Host-caleta_refresh";
export const ACCESS_TTL_SEC = 60 * 60; // 1h
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30d

function isDevHttp(webUrl: string | undefined): boolean {
  if (!webUrl) return false;
  return webUrl.startsWith("http://localhost") || webUrl.startsWith("http://127.0.0.1");
}

function commonFlags(devMode: boolean): string {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (!devMode) parts.push("Secure");
  return parts.join("; ");
}

export function buildSessionCookie(token: string, webUrl?: string): string {
  return `${SESSION_COOKIE}=${token}; ${commonFlags(isDevHttp(webUrl))}; Max-Age=${ACCESS_TTL_SEC}`;
}

export function buildRefreshCookie(token: string, webUrl?: string): string {
  return `${REFRESH_COOKIE}=${token}; ${commonFlags(isDevHttp(webUrl))}; Max-Age=${REFRESH_TTL_SEC}`;
}

export function clearSessionCookie(webUrl?: string): string {
  return `${SESSION_COOKIE}=; ${commonFlags(isDevHttp(webUrl))}; Max-Age=0`;
}

export function clearRefreshCookie(webUrl?: string): string {
  return `${REFRESH_COOKIE}=; ${commonFlags(isDevHttp(webUrl))}; Max-Age=0`;
}

/**
 * Parsea un header Cookie y devuelve el valor de la cookie pedido, o null.
 * Implementación mínima — los browsers mandan las cookies con `name=value`
 * separados por `; `.
 */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}