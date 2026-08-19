// Sesión manejada 100% server-side vía cookie httpOnly. La SPA no toca
// tokens: pregunta al backend si hay sesión via /api/me y llama /auth/logout
// para terminar.

let cache: { sub: string; email: string } | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5_000;

export interface SessionUser {
  sub: string;
  email: string;
}

const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") || "";

async function apiBase(): Promise<string> {
  return API_BASE;
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) {
    return cache;
  }
  try {
    const res = await fetch(`${await apiBase()}/api/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      cache = null;
      cacheAt = now;
      return null;
    }
    const data = (await res.json()) as SessionUser;
    cache = data;
    cacheAt = now;
    return data;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await fetch(`${await apiBase()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  cache = null;
  cacheAt = 0;
}

export function authLoginUrl(): string {
  return `${API_BASE}/auth/google`;
}

// Helper para que rutas o tests invaliden el cache tras logout manual.
export function invalidateAuthCache(): void {
  cache = null;
  cacheAt = 0;
}