// /api/sync — pull/push incremental. La definición contractual vive en
// openspec/changes/mvp-scaffold/specs/task-sync.

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";

type Bindings = AuthEnv["Variables"] & {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
  JWT_SECRET?: string;
};

export const syncRoutes = new Hono<{ Bindings: Bindings; Variables: AuthEnv["Variables"] }>();
syncRoutes.use("*", requireAuth);

syncRoutes.get("/api/sync", async (c) => {
  const since = c.req.query("since");
  const provider = getStorageProvider(c.env);
  const snapshot = await provider.getSyncSnapshot(
    c.get("user").sub,
    since,
    () => new Date().toISOString(),
  );
  c.header("X-Watermark", snapshot.watermark);
  return c.json({ lists: snapshot.lists, tasks: snapshot.tasks, watermark: snapshot.watermark });
});

syncRoutes.post("/api/sync", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { tasks?: unknown };
  if (!Array.isArray(body.tasks)) {
    return c.json({ error: "tasks array requerido" }, 400);
  }
  // Definimos CreateTaskInput por seguridad local
  const tasks = body.tasks.map((t: unknown) => {
    const obj = (t ?? {}) as Record<string, unknown>;
    return {
      id: typeof obj.id === "string" ? obj.id : undefined,
      listId: typeof obj.list_id === "string" ? obj.list_id : "",
      title: typeof obj.title === "string" ? obj.title : "",
      description: typeof obj.description === "string" || obj.description === null ? (obj.description as string | null) : null,
      dueAt: typeof obj.due_at === "string" ? obj.due_at : null,
      completed: obj.completed === true,
      deletedAt: typeof obj.deleted_at === "string" ? obj.deleted_at : null,
      createdAt: typeof obj.created_at === "string" ? obj.created_at : undefined,
    };
  });
  const provider = getStorageProvider(c.env);
  const result = await provider.pushTasks(
    c.get("user").sub,
    tasks,
    () => new Date().toISOString(),
  );
  if (!result.ok) {
    return c.json(
      { error: "hay tareas inválidas", applied: result.applied, invalid: result.invalid },
      400,
    );
  }
  return c.json({ applied: result.applied });
});
