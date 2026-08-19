// fetchApi: helper con Authorization y manejo de errores.

import { getToken, clearToken } from "./auth.ts";
import type { ApiList, ApiTask, SyncPull } from "./types.ts";

// En dev Vite proxea /api → API. En prod, VITE_API_URL debe ser la URL del Worker.
const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") || "";

export function apiBase(): string {
  return API_BASE;
}

export function authLoginUrl(): string {
  // Ir al Worker completo (no al proxy) — el flow necesita la URL absoluta.
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

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // Token inválido/expirado — limpiamos y rebotamos.
    clearToken();
    if (typeof location !== "undefined") location.href = "/";
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`, data);
  }
  return data as T;
}

// --- Listas ---
export const api = {
  listLists(): Promise<{ lists: ApiList[] }> {
    return call("GET", "/api/lists");
  },
  createList(name: string): Promise<ApiList> {
    return call("POST", "/api/lists", { name });
  },
  deleteList(id: string): Promise<void> {
    return call("DELETE", `/api/lists/${id}`);
  },
  // Tareas
  listTasks(listId: string): Promise<{ tasks: ApiTask[] }> {
    return call("GET", `/api/lists/${listId}/tasks`);
  },
  createTask(listId: string, title: string): Promise<ApiTask> {
    return call("POST", `/api/lists/${listId}/tasks`, { title });
  },
  patchTask(id: string, patch: { completed?: boolean; title?: string }): Promise<ApiTask> {
    return call("PATCH", `/api/tasks/${id}`, patch);
  },
  deleteTask(id: string): Promise<void> {
    return call("DELETE", `/api/tasks/${id}`);
  },
  // Sync
  pullSync(since: string | null): Promise<SyncPull & { watermark: string }> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return call("GET", `/api/sync${qs}`);
  },
};
