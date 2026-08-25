// fetchApi: helper con credentials: include. La sesión viaja en cookies
// httpOnly — la SPA no toca tokens. El server hace sliding refresh vía
// Set-Cookie cuando el access expira pronto.

import type { ApiList, ApiTask, SyncPull } from "./types.ts";

const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") || "";

export function apiBase(): string {
  return API_BASE;
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
}

async function call<T>(opts: CallOptions): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const res = await fetch(`${API_BASE}${opts.path}`, {
    method: opts.method,
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    if (typeof location !== "undefined") location.href = "/";
    throw new ApiError(res.status, `HTTP 401`, null);
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`, data);
  }
  return data as T;
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
  patchTask(
    id: string,
    patch: {
      completed?: boolean;
      title?: string;
      description?: string | null;
      due_at?: string | null;
      depends_on?: string | null;
      priority?: "normal" | "high";
    },
  ): Promise<ApiTask> {
    return call({ method: "PATCH", path: `/api/tasks/${id}`, body: patch });
  },
  setTaskDependency(taskId: string, dependsOnId: string | null): Promise<ApiTask> {
    return call({ method: "PATCH", path: `/api/tasks/${taskId}`, body: { depends_on: dependsOnId } });
  },
  setTaskPriority(taskId: string, priority: "normal" | "high"): Promise<ApiTask> {
    return call({ method: "PATCH", path: `/api/tasks/${taskId}`, body: { priority } });
  },
  deleteTask(id: string): Promise<void> {
    return call({ method: "DELETE", path: `/api/tasks/${id}` });
  },
  pullSync(since: string | null): Promise<SyncPull & { watermark: string }> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return call({ method: "GET", path: `/api/sync${qs}` });
  },
  exchange(code: string): Promise<{ ok: boolean; email: string }> {
    return call({ method: "POST", path: "/auth/exchange", body: { code } });
  },
};