// /auth/google y /auth/google/callback — responsables del flujo OAuth
// y de la emisión del JWT.

import { Hono } from "hono";
import {
  buildAuthRedirectUrl,
  cryptoRandomState,
  exchangeCodeForToken,
  fetchGoogleProfile,
  type AuthRedirectEnv,
} from "../auth/google.ts";
import { signToken } from "../auth/jwt.ts";
import { getStorageProvider } from "../storage/index.ts";

type Bindings = AuthRedirectEnv & { DB?: D1Database; STORAGE_PROVIDER?: string; JWT_SECRET?: string };

export const authRoutes = new Hono<{ Bindings: Bindings }>();

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

authRoutes.get("/auth/google", (c) => {
  const callbackUrl = new URL("/auth/google/callback", c.req.url).toString();
  const state = cryptoRandomState();
  const url = buildAuthRedirectUrl(c.env, callbackUrl, state);
  c.header("Set-Cookie", buildStateCookie(state), { append: true });
  return c.redirect(url);
});

authRoutes.get("/auth/google/callback", async (c) => {
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
    const token = await signToken(c.env, { sub: profile.sub, email: profile.email });
    const redirectUrl = new URL("/auth/callback", c.env.WEB_URL);
    redirectUrl.hash = `token=${encodeURIComponent(token)}`;
    c.header("Set-Cookie", clearStateCookie(), { append: true });
    return c.redirect(redirectUrl.toString());
  } catch (e) {
    console.error("OAuth callback failed", e);
    c.header("Set-Cookie", clearStateCookie(), { append: true });
    return c.json({ error: "internal error" }, 400);
  }
});