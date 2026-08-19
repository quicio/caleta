// /auth/google y /auth/google/callback — responsables del flujo OAuth
// y de la emisión de access + refresh tokens.

import { Hono } from "hono";
import {
  buildAuthRedirectUrl,
  cryptoRandomState,
  exchangeCodeForToken,
  fetchGoogleProfile,
  type AuthRedirectEnv,
} from "../auth/google.ts";
import { signRefreshToken, signToken, ACCESS_TOKEN_TTL_SEC } from "../auth/jwt.ts";
import { getStorageProvider } from "../storage/index.ts";
import { ipScope, rateLimit, type RateLimitEnv } from "../middleware/ratelimit.ts";

type Bindings = AuthRedirectEnv & {
  DB?: D1Database;
  STORAGE_PROVIDER?: string;
  JWT_SECRET?: string;
  RATE_LIMIT?: KVNamespace;
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

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
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
      // email_verified === false => rechazamos; undefined se acepta (tolerancia legacy)
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
      if (!c.env.JWT_SECRET) {
        c.header("Set-Cookie", clearStateCookie(), { append: true });
        return c.json({ error: "internal error" }, 500);
      }
      const access = await signToken(c.env, { sub: profile.sub, email: profile.email });
      const refresh = await signRefreshToken(c.env, {
        sub: profile.sub,
        email: profile.email,
      });
      const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SEC;
      const redirectUrl = new URL("/auth/callback", c.env.WEB_URL);
      const hash = new URLSearchParams({
        access: access,
        refresh: refresh,
        exp: String(exp),
      }).toString();
      redirectUrl.hash = hash;
      c.header("Set-Cookie", clearStateCookie(), { append: true });
      return c.redirect(redirectUrl.toString());
    } catch (e) {
      console.error("OAuth callback failed", e);
      c.header("Set-Cookie", clearStateCookie(), { append: true });
      return c.json({ error: "internal error" }, 400);
    }
  },
);

authRoutes.post("/auth/refresh", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { refresh_token?: string };
  if (!body.refresh_token) {
    return c.json({ error: "refresh_token requerido" }, 400);
  }
  try {
    const { verifyToken, signToken } = await import("../auth/jwt.ts");
    const claims = await verifyToken(c.env, body.refresh_token);
    const access = await signToken(c.env, claims);
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SEC;
    return c.json({ access_token: access, exp });
  } catch {
    return c.json({ error: "invalid or expired refresh token" }, 401);
  }
});