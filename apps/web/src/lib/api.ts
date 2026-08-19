// fetchApi: helper con Authorization, manejo de X-Refresh-Token y retry
// ante 401 con un único refresh.

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccess,
} from "./auth.ts";
import type { ApiList, ApiTask, SyncPull } from "./types.ts";

// En dev Vite proxea /api → API. En prod, VITE_API_URL debe ser la URL del Worker.
const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") || "";

export function apiBase(): string {
  return API_BASE;
}

export function authLoginUrl(): string {
  return `${API_BASE}/auth/google`;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface CallOptions {
  method: string;
  path: string;
  body?: unknown;
  auth?: boolean; // default true
  _retried?: boolean;
}

async function call<T>(opts: CallOptions): Promise<T> {
  const auth = opts.auth !== false;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  // Sliding refresh: si el server nos da un nuevo access, lo guardamos.
  const refreshed = res.headers.get("X-Refresh-Token");
  if (refreshed) {
    // No tenemos `exp` del header; el server siempre emite 1h.
    const exp = Math.floor(Date.now() / 1000) + 3600;
    setAccess(refreshed, exp);
  }
  if (res.status === 401 && auth && !opts._retried) {
    const refresh = getRefreshToken();
    if (refresh) {
      const ok = await tryRefresh();
      if (ok) {
        return call<T>({ ...opts, _retried: true });
      }
    }
    clearTokens();
    if (typeof location !== "undefined") location.href = "/";
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`, data);
  }
  return data as T;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access_token: string; exp: number };
      setAccess(data.access_token, data.exp);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// --- API surface ---
export const api = {
  listLists(): Promise<{ lists: ApiList[] }> {
    return call({ method: "GET", path: "/api/lists" });
  },
  createList(name: string): Promise<ApiList> {
    return call({ method: "POST", path: "/api/lists", body: { name } });
  },
  deleteList(id: string): Promise<void> {
    return call({ method: "DELETE", path: `/api/lists/${id}` });
  },
  listTasks(listId: string): Promise<{ tasks: ApiTask[] }> {
    return call({ method: "GET", path: `/api/lists/${listId}/tasks` });
  },
  createTask(listId: string, title: string): Promise<ApiTask> {
    return call({ method: "POST", path: `/api/lists/${listId}/tasks`, body: { title } });
  },
  patchTask(id: string, patch: { completed?: boolean; title?: string }): Promise<ApiTask> {
    return call({ method: "PATCH", path: `/api/tasks/${id}`, body: patch });
  },
  deleteTask(id: string): Promise<void> {
    return call({ method: "DELETE", path: `/api/tasks/${id}` });
  },
  pullSync(since: string | null): Promise<SyncPull & { watermark: string }> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return call({ method: "GET", path: `/api/sync${qs}` });
  },
};