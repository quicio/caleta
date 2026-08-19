// /auth/google y /auth/google/callback — OAuth flow.
// /auth/exchange: canje del code por cookie de sesión.
// /auth/refresh: sliding refresh vía cookie.
// /auth/logout: limpia cookies.

import { Hono } from "hono";
import {
  buildAuthRedirectUrl,
  cryptoRandomState,
  exchangeCodeForToken,
  fetchGoogleProfile,
  type AuthRedirectEnv,
} from "../auth/google.ts";
import {
  buildRefreshCookie,
  buildSessionCookie,
  clearRefreshCookie,
  clearSessionCookie,
  readCookie,
  REFRESH_COOKIE,
  SESSION_COOKIE,
} from "../auth/cookies.ts";
import { signRefreshToken, signToken, verifyToken, ACCESS_TOKEN_TTL_SEC } from "../auth/jwt.ts";
import {
  consumeAuthCode,
  generateAuthCode,
  storeAuthCode,
} from "../auth/code.ts";
import { getStorageProvider } from "../storage/index.ts";
import { ipScope, rateLimit, type RateLimitEnv } from "../middleware/ratelimit.ts";

type Bindings = AuthRedirectEnv & {
  DB?: D1Database;
  STORAGE_PROVIDER?: string;
  JWT_SECRET?: string;
  RATE_LIMIT?: KVNamespace;
  WEB_URL: string;
};

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: RateLimitEnv["Variables"] }>();

const STATE_COOKIE = "caleta_oauth_state";
const STATE_MAX_AGE = 600;

function buildStateCookie(value: string): string {
  return [
    `${STATE_COOKIE}=${value}`,
    "Path=/auth/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${STATE_MAX_AGE}`,
  ].join("; ");
}

function clearStateCookie(): string {
  return [`${STATE_COOKIE}=`, "Path=/auth/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=0"].join(
    "; ",
  );
}

authRoutes.get(
  "/auth/google",
  rateLimit({ route: "auth_start", limit: 5, windowSec: 60, scope: ipScope() }),
  (c) => {
    const callbackUrl = new URL("/auth/google/callback", c.req.url).toString();
    const state = cryptoRandomState();
    const url = buildAuthRedirectUrl(c.env, callbackUrl, state);
    c.header("Set-Cookie", buildStateCookie(state), { append: true });
    return c.redirect(url);
  },
);

authRoutes.get(
  "/auth/google/callback",
  rateLimit({ route: "auth_callback", limit: 10, windowSec: 60, scope: ipScope() }),
  async (c) => {
    const code = c.req.query("code");
    const stateQuery = c.req.query("state");
    if (!code) {
      c.header("Set-Cookie", clearStateCookie(), { append: true });
      return c.json({ error: "Missing code" }, 400);
    }
    const stateCookie = readCookie(c.req.header("cookie"), STATE_COOKIE);
    if (!stateCookie || !stateQuery || stateCookie !== stateQuery) {
      c.header("Set-Cookie", clearStateCookie(), { append: true });
      return c.json({ error: "Invalid OAuth state" }, 400);
    }
    const callbackUrl = new URL("/auth/google/callback", c.req.url).toString();
    try {
      const { accessToken } = await exchangeCodeForToken(c.env, code, callbackUrl);
      const profile = await fetchGoogleProfile(accessToken);
      if (profile.email_verified === false) {
        c.header("Set-Cookie", clearStateCookie(), { append: true });
        return c.json({ error: "Google account email not verified" }, 400);
      }
      const provider = getStorageProvider(c.env);
      await provider.upsertUser({
        id: profile.sub,
        email: profile.email,
        name: profile.name,
        pictureUrl: profile.picture,
      });
      if (!c.env.JWT_SECRET || !c.env.RATE_LIMIT) {
        c.header("Set-Cookie", clearStateCookie(), { append: true });
        return c.json({ error: "internal error" }, 500);
      }
      const access = await signToken(c.env, { sub: profile.sub, email: profile.email });
      const refresh = await signRefreshToken(c.env, {
        sub: profile.sub,
        email: profile.email,
      });
      const oneTime = generateAuthCode();
      await storeAuthCode(c.env.RATE_LIMIT, oneTime, {
        sub: profile.sub,
        email: profile.email,
        access,
        refresh,
      });
      const redirectUrl = new URL("/auth/callback", c.env.WEB_URL);
      redirectUrl.searchParams.set("code", oneTime);
      c.header("Set-Cookie", clearStateCookie(), { append: true });
      return c.redirect(redirectUrl.toString());
    } catch (e) {
      console.error("OAuth callback failed", e);
      c.header("Set-Cookie", clearStateCookie(), { append: true });
      return c.json({ error: "internal error" }, 400);
    }
  },
);

authRoutes.post("/auth/exchange", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: string };
  if (!body.code || !c.env.RATE_LIMIT) {
    return c.json({ error: "code requerido" }, 400);
  }
  const payload = await consumeAuthCode(c.env.RATE_LIMIT, body.code);
  if (!payload) {
    return c.json({ error: "code inválido o expirado" }, 400);
  }
  c.header("Set-Cookie", buildSessionCookie(payload.access, c.env.WEB_URL), { append: true });
  c.header("Set-Cookie", buildRefreshCookie(payload.refresh, c.env.WEB_URL), { append: true });
  return c.json({ ok: true, email: payload.email });
});

authRoutes.post("/auth/refresh", async (c) => {
  const refreshToken = readCookie(c.req.header("cookie"), REFRESH_COOKIE);
  if (!refreshToken) {
    return c.json({ error: "missing refresh cookie" }, 401);
  }
  try {
    const claims = await verifyToken(c.env, refreshToken);
    const newAccess = await signToken(c.env, claims);
    c.header("Set-Cookie", buildSessionCookie(newAccess, c.env.WEB_URL), { append: true });
    return c.json({ ok: true });
  } catch {
    c.header("Set-Cookie", clearSessionCookie(c.env.WEB_URL), { append: true });
    c.header("Set-Cookie", clearRefreshCookie(c.env.WEB_URL), { append: true });
    return c.json({ error: "invalid or expired refresh" }, 401);
  }
});

authRoutes.post("/auth/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie(c.env.WEB_URL), { append: true });
  c.header("Set-Cookie", clearRefreshCookie(c.env.WEB_URL), { append: true });
  return c.json({ ok: true });
});
// ponytail: SESSION_COOKIE está exportado para el middleware pero no se usa acá
// directamente; lo importamos para que el barrel esté completo y futuro
// logging/métricas lo encuentre.
void SESSION_COOKIE;
// ACCESS_TOKEN_TTL_SEC se mantiene para futuras métricas (p.ej. header Age).
void ACCESS_TOKEN_TTL_SEC;