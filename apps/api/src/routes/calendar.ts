// /api/calendar/events — read-only proxy a Google Calendar API.
// Canjea el refresh_token del usuario por un access_token fresco y lista
// eventos del calendario primario en una ventana de tiempo.

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { getStorageProvider } from "../storage/index.ts";
import { refreshAccessToken, type GoogleEnv } from "../auth/google.ts";
import { ipScope, rateLimit } from "../middleware/ratelimit.ts";
import { log } from "../lib/log.ts";

type Bindings = {
  DB: D1Database;
  STORAGE_PROVIDER?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  WEB_URL: string;
  RATE_LIMIT?: KVNamespace;
};

export const calendarRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthEnv["Variables"];
}>();
calendarRoutes.use("*", requireAuth);

interface GcalDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface GcalEvent {
  id: string;
  summary?: string;
  start?: GcalDateTime;
  end?: GcalDateTime;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
}

interface NormalizedEvent {
  id: string;
  summary: string;
  start: { iso: string; timeZone?: string };
  end: { iso: string; timeZone?: string };
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
}

function normalize(ev: GcalEvent): NormalizedEvent | null {
  if (!ev.start || !ev.end) return null;
  const allDay = Boolean(ev.start.date && !ev.start.dateTime);
  const startIso = ev.start.dateTime ?? `${ev.start.date ?? ""}T00:00:00Z`;
  const endIso = ev.end.dateTime ?? `${ev.end.date ?? ""}T23:59:59Z`;
  return {
    id: ev.id,
    summary: ev.summary ?? "(sin título)",
    start: { iso: startIso, timeZone: ev.start.timeZone },
    end: { iso: endIso, timeZone: ev.end.timeZone },
    allDay,
    location: ev.location ?? null,
    htmlLink: ev.htmlLink ?? null,
    hangoutLink: ev.hangoutLink ?? null,
  };
}

async function fetchCalendarEvents(
  env: GoogleEnv & { DB: D1Database; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string },
  refreshToken: string,
  from: string,
  to: string,
): Promise<NormalizedEvent[]> {
  const { accessToken } = await refreshAccessToken(env, refreshToken);
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", from);
  url.searchParams.set("timeMax", to);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const out: NormalizedEvent[] = [];
  let nextPageToken: string | null = null;
  // ponytail: Google pagina con nextPageToken. Tope de 5 páginas para no abusar;
  // 250 * 5 = 1250 eventos por request, suficiente para uso personal.
  let pages = 0;
  do {
    const u = new URL(url.toString());
    if (nextPageToken) u.searchParams.set("pageToken", nextPageToken);
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      const err = new Error("google_reauth_required");
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    if (res.status === 403) {
      const body = await res.text();
      // "Insufficient Permission" o "Access Not Configured" — generalmente
      // significa que el refresh_token no tiene calendar.readonly. Forzamos
      // re-consent para que el usuario otorgue el scope.
      const err = new Error(`insufficient_scope: ${body.slice(0, 200)}`);
      (err as Error & { status?: number }).status = 403;
      throw err;
    }
    if (!res.ok) {
      throw new Error(`Google Calendar API failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { items?: GcalEvent[]; nextPageToken?: string };
    for (const ev of data.items ?? []) {
      const n = normalize(ev);
      if (n) out.push(n);
    }
    nextPageToken = data.nextPageToken ?? null;
    pages++;
  } while (nextPageToken && pages < 5);

  return out;
}

calendarRoutes.get(
  "/api/calendar/events",
  rateLimit({ route: "calendar_read", limit: 30, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) {
      return c.json({ error: "from y to son requeridos (ISO 8601)" }, 400);
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return c.json({ error: "from y to deben ser ISO 8601 válidos" }, 400);
    }

    const provider = getStorageProvider(c.env);
    const user = c.get("user");
    if (!user) return c.json({ error: "missing session" }, 401);
    const userId = user.sub;
    void provider; // el provider no se usa acá; leemos directo de DB
    // upsertUser no expone googleRefreshToken en la firma; leemos directo de DB.
    const row = await c.env.DB
      .prepare(`SELECT google_refresh_token FROM users WHERE id = ?1`)
      .bind(userId)
      .first() as { google_refresh_token: string | null } | null;
    const refreshToken = row?.google_refresh_token ?? null;
    if (!refreshToken) {
      return c.json({ error: "calendar not connected" }, 403);
    }

    try {
      const events = await fetchCalendarEvents(
        c.env,
        refreshToken,
        fromDate.toISOString(),
        toDate.toISOString(),
      );
      return c.json({ events });
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 401) {
        return c.json({ error: "google_reauth_required" }, 401);
      }
      if (status === 403) {
        return c.json({ error: "calendar_scope_missing" }, 403);
      }
      log.error("calendar_fetch_failed", {
        request_id: c.get("request_id"),
        user_id: userId,
        message: e instanceof Error ? e.message : String(e),
      });
      return c.json({ error: "calendar fetch failed" }, 502);
    }
  },
);