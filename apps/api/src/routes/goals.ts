// /api/goals — CRUD de goals (objetivos / destinos).
// Validación: title no vacío; status ∈ active|done|abandoned.

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";
import { ipScope, rateLimit, type RateLimitEnv } from "../middleware/ratelimit.ts";

type Bindings = {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
  RATE_LIMIT?: KVNamespace;
};

export const goalRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthEnv["Variables"] & RateLimitEnv["Variables"];
}>();
goalRoutes.use("*", requireAuth);

function isValidStatus(s: unknown): s is "active" | "done" | "abandoned" {
  return s === "active" || s === "done" || s === "abandoned";
}

goalRoutes.get(
  "/api/goals",
  rateLimit({ route: "goals_read", limit: 60, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const since = c.req.query("since");
    const provider = getStorageProvider(c.env);
    const goals = await provider.listGoals(user.sub, since);
    return c.json({ goals });
  },
);

goalRoutes.post(
  "/api/goals",
  rateLimit({ route: "goals_write", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: unknown;
      description?: unknown;
      status?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title requerido" }, 400);
    const description =
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null;
    const status = isValidStatus(body.status) ? body.status : "active";
    const provider = getStorageProvider(c.env);
    const goal = await provider.createGoal(user.sub, { title, description, status });
    return c.json(goal, 201);
  },
);

goalRoutes.patch(
  "/api/goals/:id",
  rateLimit({ route: "goals_write", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: unknown;
      description?: unknown;
      status?: unknown;
    };
    const patch: { title?: string; description?: string | null; status?: "active" | "done" | "abandoned" } = {};
    if (body.title !== undefined) {
      const t = typeof body.title === "string" ? body.title.trim() : "";
      if (!t) return c.json({ error: "title no puede ser vacío" }, 400);
      patch.title = t;
    }
    if (body.description !== undefined) {
      patch.description =
        typeof body.description === "string" && body.description.trim().length > 0
          ? body.description.trim()
          : null;
    }
    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) return c.json({ error: "status inválido" }, 400);
      patch.status = body.status;
    }
    const provider = getStorageProvider(c.env);
    const goal = await provider.updateGoal(user.sub, id, patch);
    if (!goal) return c.json({ error: "goal no encontrado" }, 404);
    return c.json(goal);
  },
);

goalRoutes.delete(
  "/api/goals/:id",
  rateLimit({ route: "goals_write", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const id = c.req.param("id");
    const provider = getStorageProvider(c.env);
    const ok = await provider.deleteGoal(user.sub, id);
    if (!ok) return c.json({ error: "goal no encontrado" }, 404);
    return c.json({ ok: true });
  },
);