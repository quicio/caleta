// /api/lists/:id/tasks y /api/tasks/:id — CRUD de tareas; el sync vive aparte.

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";

type Bindings = AuthEnv["Variables"] & {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
  JWT_SECRET?: string;
};

export const taskRoutes = new Hono<{ Bindings: Bindings; Variables: AuthEnv["Variables"] }>();
taskRoutes.use("*", requireAuth);

function validateCreateInput(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { error: "title requerido" as const };
  const description =
    typeof body.description === "string" || body.description === null
      ? (body.description as string | null)
      : null;
  const dueAt = typeof body.due_at === "string" ? body.due_at : null;
  const completed = body.completed === true;
  return { title, description, dueAt, completed };
}

taskRoutes.post("/api/lists/:id/tasks", async (c) => {
  const bodyRaw = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const validated = validateCreateInput(bodyRaw);
  if ("error" in validated) return c.json(validated, 400);
  const provider = getStorageProvider(c.env);
  // Confirmar que la lista existe y pertenece al usuario
  const list = await provider.getList(c.get("user").sub, c.req.param("id"));
  if (!list) return c.json({ error: "list not found" }, 404);
  const created = await provider.createTask(c.get("user").sub, {
    listId: list.id,
    title: validated.title,
    description: validated.description,
    dueAt: validated.dueAt,
    completed: validated.completed,
  });
  return c.json(created, 201);
});

taskRoutes.get("/api/lists/:id/tasks", async (c) => {
  const since = c.req.query("since");
  const provider = getStorageProvider(c.env);
  const list = await provider.getList(c.get("user").sub, c.req.param("id"));
  if (!list) return c.json({ error: "list not found" }, 404);
  const tasks = await provider.listTasksInList(c.get("user").sub, list.id, since);
  return c.json({ tasks });
});

taskRoutes.patch("/api/tasks/:id", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: {
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    completed?: boolean;
    deletedAt?: string | null;
  } = {};
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed) return c.json({ error: "title vacío" }, 400);
    patch.title = trimmed;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    patch.description = typeof body.description === "string" ? body.description : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "due_at")) {
    patch.dueAt = typeof body.due_at === "string" ? body.due_at : null;
  }
  if (typeof body.completed === "boolean") patch.completed = body.completed;
  const provider = getStorageProvider(c.env);
  const updated = await provider.updateTask(c.get("user").sub, c.req.param("id"), patch);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

taskRoutes.delete("/api/tasks/:id", async (c) => {
  const provider = getStorageProvider(c.env);
  const removed = await provider.deleteTask(c.get("user").sub, c.req.param("id"));
  return removed ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
