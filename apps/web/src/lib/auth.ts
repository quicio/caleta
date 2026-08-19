// Tokens de sesión en localStorage. Dura el access (1h) y el refresh (30d).
// El cliente nunca debería tocar el JWT crudo — sólo los helpers.

const ACCESS_KEY = "caleta.access";
const REFRESH_KEY = "caleta.refresh";
const EXP_KEY = "caleta.exp";

export interface Tokens {
  access: string;
  refresh: string;
  exp: number; // unix seconds
}

function readKey(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

function writeKey(key: string, value: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export function getAccessToken(): string | null {
  return readKey(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return readKey(REFRESH_KEY);
}

export function setTokens(input: { access: string; refresh?: string; exp: number }): void {
  writeKey(ACCESS_KEY, input.access);
  writeKey(EXP_KEY, String(input.exp));
  if (input.refresh !== undefined) {
    writeKey(REFRESH_KEY, input.refresh);
  }
}

export function setAccess(access: string, exp: number): void {
  writeKey(ACCESS_KEY, access);
  writeKey(EXP_KEY, String(exp));
}

export function clearTokens(): void {
  writeKey(ACCESS_KEY, null);
  writeKey(REFRESH_KEY, null);
  writeKey(EXP_KEY, null);
}

export function isAuthenticated(): boolean {
  const t = getAccessToken();
  const expStr = readKey(EXP_KEY);
  if (!t || !expStr) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return false;
  return exp * 1000 > Date.now();
}

// Best-effort: decodificamos el payload del JWT (sin verificar firma) sólo
// para UX. El servidor siempre re-verifica en cada request.
export interface Decoded {
  sub: string;
  email: string;
  exp: number;
}

export function decodeToken(token: string): Decoded | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Decoded;
  } catch {
    return null;
  }
}