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
  selectedCalendars: Set<string> | null,
): Promise<NormalizedEvent[]> {
  const { accessToken } = await refreshAccessToken(env, refreshToken);
  const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const calData = (await calRes.json()) as {
    items?: Array<{ id: string; summary?: string }>;
  };

  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();
  for (const cal of calData.items ?? []) {
    // selectedCalendars null o vacío = mostrar todos. Si hay selección, saltar
    // los calendarios no elegidos.
    if (selectedCalendars && selectedCalendars.size > 0 && !selectedCalendars.has(cal.id)) {
      continue;
    }
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`,
    );
    url.searchParams.set("timeMin", from);
    url.searchParams.set("timeMax", to);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      const err = new Error("google_reauth_required");
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    if (res.status === 403) {
      const body = await res.text();
      const reason = (() => {
        try {
          const j = JSON.parse(body) as {
            error?: { message?: string; errors?: Array<{ reason?: string }> };
          };
          return j.error?.errors?.[0]?.reason ?? j.error?.message?.slice(0, 80) ?? "unknown";
        } catch {
          return body.slice(0, 80) || "unknown";
        }
      })();
      const err = new Error(`google_403:${reason}`);
      (err as Error & { status?: number; googleReason?: string }).status = 403;
      (err as Error & { googleReason?: string }).googleReason = reason;
      throw err;
    }
    if (!res.ok) {
      throw new Error(`Google Calendar API failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { items?: GcalEvent[] };
    for (const ev of data.items ?? []) {
      const n = normalize(ev);
      if (n && !seen.has(n.id)) {
        seen.add(n.id);
        out.push(n);
      }
    }
  }

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
    // upsertUser no expone googleRefreshToken en la firma; leemos directo de DB.
    const row = await c.env.DB
      .prepare(`SELECT google_refresh_token FROM users WHERE id = ?1`)
      .bind(userId)
      .first() as { google_refresh_token: string | null } | null;
    const refreshToken = row?.google_refresh_token ?? null;
    if (!refreshToken) {
      return c.json({ error: "calendar not connected" }, 403);
    }

    // Filtro por calendarios seleccionados en Configuración (settings).
    const settings = await provider.getSettings(userId);
    const selected = settings.selectedCalendars;
    const selectedCalendars = Array.isArray(selected)
      ? new Set<string>(selected.filter((s): s is string => typeof s === "string"))
      : null;

    try {
      const events = await fetchCalendarEvents(
        c.env,
        refreshToken,
        fromDate.toISOString(),
        toDate.toISOString(),
        selectedCalendars,
      );
      return c.json({ events });
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 401) {
        return c.json({ error: "google_reauth_required" }, 401);
      }
      if (status === 403) {
        const reason = (e as Error & { googleReason?: string }).googleReason;
        log.warn("calendar_403", {
          request_id: c.get("request_id"),
          user_id: userId,
          google_reason: reason,
        });
        // accessNotConfigured = la Calendar API no está habilitada en GCP.
        // No es un problema de scope ni de sesión; reconectar no ayuda.
        if (reason?.toLowerCase().includes("accessnotconfigured")) {
          return c.json({ error: "calendar_api_not_configured" }, 403);
        }
        if (
          reason?.toLowerCase().includes("insufficient") ||
          reason?.toLowerCase().includes("permission") ||
          reason?.toLowerCase().includes("forbidden")
        ) {
          return c.json({ error: "calendar_scope_missing" }, 403);
        }
        return c.json({ error: "calendar_api_error", reason }, 403);
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