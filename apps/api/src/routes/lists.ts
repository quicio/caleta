// /api/lists — CRUD básico, siempre aislado por userId del JWT.

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";

type Bindings = AuthEnv["Variables"] & {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
  JWT_SECRET?: string;
};

export const listRoutes = new Hono<{ Bindings: Bindings; Variables: AuthEnv["Variables"] }>();
listRoutes.use("*", requireAuth);

listRoutes.post("/api/lists", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: "name requerido" }, 400);
  }
  const name = body.name.trim();
  if (name.length > 120) {
    return c.json({ error: "name demasiado largo (máx 120)" }, 400);
  }
  const provider = getStorageProvider(c.env);
  const list = await provider.createList(c.get("user").sub, { name });
  return c.json(list, 201);
});

listRoutes.get("/api/lists", async (c) => {
  const since = c.req.query("since");
  const provider = getStorageProvider(c.env);
  const lists = await provider.listLists(c.get("user").sub, since);
  return c.json({ lists });
});

listRoutes.get("/api/lists/:id", async (c) => {
  const provider = getStorageProvider(c.env);
  const list = await provider.getList(c.get("user").sub, c.req.param("id"));
  return list ? c.json(list) : c.json({ error: "not found" }, 404);
});

listRoutes.patch("/api/lists/:id", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  let name: string | undefined;
  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return c.json({ error: "name vacío" }, 400);
    }
    if (trimmed.length > 120) {
      return c.json({ error: "name demasiado largo (máx 120)" }, 400);
    }
    name = trimmed;
  }
  const provider = getStorageProvider(c.env);
  const updated = await provider.updateList(c.get("user").sub, c.req.param("id"), { name });
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

listRoutes.delete("/api/lists/:id", async (c) => {
  const provider = getStorageProvider(c.env);
  const removed = await provider.deleteList(c.get("user").sub, c.req.param("id"));
  return removed ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
