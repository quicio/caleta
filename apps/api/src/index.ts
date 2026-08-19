// Punto de entrada del Worker. Monta Hono con CORS y las rutas.

import { Hono } from "hono";
import { authRoutes } from "./routes/auth.ts";
import { listRoutes } from "./routes/lists.ts";
import { syncRoutes } from "./routes/sync.ts";
import { taskRoutes } from "./routes/tasks.ts";

type Bindings = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  STORAGE_PROVIDER?: string;
  WEB_URL: string;
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  const webUrl = c.env.WEB_URL;
  if (origin && origin === webUrl) {
    c.res.headers.set("Access-Control-Allow-Origin", origin);
    c.res.headers.set("Vary", "Origin");
    c.res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    c.res.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.get("/", (c) => c.json({ name: "caleta", status: "ok" }));

app.get("/healthz", (c) => c.json({ ok: true }));

app.route("/", authRoutes);
app.route("/", listRoutes);
app.route("/", taskRoutes);
app.route("/", syncRoutes);

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((e, c) => {
  console.error("Unhandled error", e);
  return c.json({ error: e.message ?? "internal error" }, 500);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Bindings>;
