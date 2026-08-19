// Token en localStorage. Simple — el JWT tiene 30 días; el backend lo renueva cuando entra.

const KEY = "caleta.token";

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}

// Best-effort: decodificamos claims (jwt sin firma — sólo para UX).
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

export function isAuthenticated(): boolean {
  const t = getToken();
  if (!t) return false;
  const d = decodeToken(t);
  if (!d) return false;
  return d.exp * 1000 > Date.now();
}
