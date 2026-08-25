// Punto de entrada del Worker. Monta Hono con CORS, headers de seguridad
// y las rutas.

import { Hono } from "hono";
import { authRoutes } from "./routes/auth.ts";
import { calendarRoutes } from "./routes/calendar.ts";
import { listRoutes } from "./routes/lists.ts";
import { meRoutes } from "./routes/me.ts";
import { syncRoutes } from "./routes/sync.ts";
import { taskRoutes } from "./routes/tasks.ts";
import { logger, type LoggerEnv } from "./middleware/logger.ts";
import { log } from "./lib/log.ts";

type Bindings = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  STORAGE_PROVIDER?: string;
  WEB_URL: string;
  DB: D1Database;
  RATE_LIMIT?: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings; Variables: LoggerEnv["Variables"] }>();

app.use("*", logger());

app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  const webUrl = c.env.WEB_URL;
  if (origin && origin === webUrl) {
    c.res.headers.set("Access-Control-Allow-Origin", origin);
    c.res.headers.set("Vary", "Origin");
    c.res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    c.res.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    c.res.headers.set("Access-Control-Allow-Credentials", "true");
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "no-referrer");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
});

app.get("/", (c) => c.json({ name: "caleta", status: "ok" }));

app.get("/healthz", (c) => c.json({ ok: true }));

app.route("/", authRoutes);
app.route("/", meRoutes);
app.route("/", listRoutes);
app.route("/", taskRoutes);
app.route("/", syncRoutes);
app.route("/", calendarRoutes);

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((e, c) => {
  log.error("unhandled", {
    request_id: c.get("request_id"),
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  });
  return c.json({ error: "internal error" }, 500);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Bindings>;