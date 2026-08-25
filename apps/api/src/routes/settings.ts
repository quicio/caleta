// /api/settings — settings genéricos por usuario + lista de calendarios de Google.
//
// GET  /api/settings -> { settings, calendars }
//   - settings: objeto JSON persistido del usuario (por ahora { selectedCalendars }).
//   - calendars: lista [{ id, summary }] de los calendarios de Google. null si
//     el usuario no tiene conectado Google Calendar (para mostrar CTA).
// PUT  /api/settings -> { settings } (merge por patch del JSON persistido).

import { Hono } from "hono";
import { authedUser, requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";
import { refreshAccessToken, type GoogleEnv } from "../auth/google.ts";
import { log } from "../lib/log.ts";

type Bindings = GoogleEnv & {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
};

interface GcalListItem {
  id: string;
  summary?: string;
}

export const settingsRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthEnv["Variables"];
}>();
settingsRoutes.use("*", requireAuth);

async function listCalendars(
  env: Bindings,
  refreshToken: string,
): Promise<GcalListItem[]> {
  const { accessToken } = await refreshAccessToken(env, refreshToken);
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google calendarList failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { items?: GcalListItem[] };
  return (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary ?? c.id }));
}

settingsRoutes.get("/api/settings", async (c) => {
  const user = authedUser(c);
  const provider = getStorageProvider(c.env);
  const settings = await provider.getSettings(user.sub);

  let calendars: GcalListItem[] | null = null;
  const row = await c.env.DB
    .prepare(`SELECT google_refresh_token FROM users WHERE id = ?1`)
    .bind(user.sub)
    .first() as { google_refresh_token: string | null } | null;
  const refreshToken = row?.google_refresh_token ?? null;
  if (refreshToken) {
    try {
      calendars = await listCalendars(c.env, refreshToken);
    } catch (e) {
      log.warn("settings_calendars_failed", {
        request_id: c.get("request_id"),
        user_id: user.sub,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return c.json({ settings, calendars });
});

settingsRoutes.put("/api/settings", async (c) => {
  const user = authedUser(c);
  const body = (await c.req.json().catch(() => ({}))) as { settings?: Record<string, unknown> };
  const patch = body.settings;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return c.json({ error: "settings debe ser un objeto" }, 400);
  }
  const provider = getStorageProvider(c.env);
  const settings = await provider.updateSettings(user.sub, patch);
  return c.json({ settings });
});
