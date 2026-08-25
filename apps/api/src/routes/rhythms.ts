// /api/rhythms — CRUD de rhythms + registro de entries diarias.
// Recurrencia: target_per_week + entries explícitas (kind: full|minimum|missed).

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";
import { ipScope, rateLimit, type RateLimitEnv } from "../middleware/ratelimit.ts";

type Bindings = {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
  RATE_LIMIT?: KVNamespace;
};

export const rhythmRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthEnv["Variables"] & RateLimitEnv["Variables"];
}>();
rhythmRoutes.use("*", requireAuth);
rhythmRoutes.use("*", requireAuth);

function isValidKind(k: unknown): k is "full" | "minimum" | "missed" {
  return k === "full" || k === "minimum" || k === "missed";
}

function isValidDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

rhythmRoutes.get(
  "/api/rhythms",
  rateLimit({ route: "rhythms_read", limit: 60, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const since = c.req.query("since");
    const provider = getStorageProvider(c.env);
    const rhythms = await provider.listRhythms(user.sub, since);
    return c.json({ rhythms });
  },
);

rhythmRoutes.post(
  "/api/rhythms",
  rateLimit({ route: "rhythms_write", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: unknown;
      targetPerWeek?: unknown;
      minimum?: unknown;
      unit?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title requerido" }, 400);
    const targetPerWeek =
      typeof body.targetPerWeek === "number" && body.targetPerWeek >= 1
        ? Math.floor(body.targetPerWeek)
        : 3;
    const minimum =
      typeof body.minimum === "string" && body.minimum.trim().length > 0
        ? body.minimum.trim()
        : null;
    const unit =
      typeof body.unit === "string" && body.unit.trim().length > 0 ? body.unit.trim() : null;
    const provider = getStorageProvider(c.env);
    const rhythm = await provider.createRhythm(user.sub, {
      title,
      targetPerWeek,
      minimum,
      unit,
    });
    return c.json(rhythm, 201);
  },
);

rhythmRoutes.patch(
  "/api/rhythms/:id",
  rateLimit({ route: "rhythms_write", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: unknown;
      targetPerWeek?: unknown;
      minimum?: unknown;
      unit?: unknown;
    };
    const patch: {
      title?: string;
      targetPerWeek?: number;
      minimum?: string | null;
      unit?: string | null;
    } = {};
    if (body.title !== undefined) {
      const t = typeof body.title === "string" ? body.title.trim() : "";
      if (!t) return c.json({ error: "title no puede ser vacío" }, 400);
      patch.title = t;
    }
    if (body.targetPerWeek !== undefined) {
      const n = Number(body.targetPerWeek);
      if (!Number.isFinite(n) || n < 1) return c.json({ error: "targetPerWeek inválido" }, 400);
      patch.targetPerWeek = Math.floor(n);
    }
    if (body.minimum !== undefined) {
      patch.minimum =
        typeof body.minimum === "string" && body.minimum.trim().length > 0
          ? body.minimum.trim()
          : null;
    }
    if (body.unit !== undefined) {
      patch.unit =
        typeof body.unit === "string" && body.unit.trim().length > 0 ? body.unit.trim() : null;
    }
    const provider = getStorageProvider(c.env);
    const rhythm = await provider.updateRhythm(user.sub, id, patch);
    if (!rhythm) return c.json({ error: "rhythm no encontrado" }, 404);
    return c.json(rhythm);
  },
);

rhythmRoutes.delete(
  "/api/rhythms/:id",
  rateLimit({ route: "rhythms_write", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const id = c.req.param("id");
    const provider = getStorageProvider(c.env);
    const ok = await provider.deleteRhythm(user.sub, id);
    if (!ok) return c.json({ error: "rhythm no encontrado" }, 404);
    return c.json({ ok: true });
  },
);

rhythmRoutes.get(
  "/api/rhythms/:id/entries",
  rateLimit({ route: "rhythms_read", limit: 60, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const id = c.req.param("id");
    const since = c.req.query("since");
    const provider = getStorageProvider(c.env);
    const rhythm = await provider.getRhythm(user.sub, id);
    if (!rhythm) return c.json({ error: "rhythm no encontrado" }, 404);
    const entries = await provider.listRhythmEntries(user.sub, id, since);
    return c.json({ entries });
  },
);

rhythmRoutes.post(
  "/api/rhythms/:id/entries",
  rateLimit({ route: "rhythms_write", limit: 60, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const user = c.get("user") as { sub: string; email: string };
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as {
      date?: unknown;
      kind?: unknown;
    };
    if (!isValidDate(body.date)) return c.json({ error: "date debe ser YYYY-MM-DD" }, 400);
    if (!isValidKind(body.kind)) {
      return c.json({ error: "kind debe ser full|minimum|missed" }, 400);
    }
    const provider = getStorageProvider(c.env);
    const rhythm = await provider.getRhythm(user.sub, id);
    if (!rhythm) return c.json({ error: "rhythm no encontrado" }, 404);
    const entry = await provider.upsertRhythmEntry(user.sub, {
      rhythmId: id,
      date: body.date,
      kind: body.kind,
    });
    return c.json(entry, 201);
  },
);