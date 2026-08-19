// /auth/google y /auth/google/callback — responsables del flujo OAuth
// y de la emisión del JWT.

import { Hono } from "hono";
import {
  buildAuthRedirectUrl,
  exchangeCodeForToken,
  fetchGoogleProfile,
  type AuthRedirectEnv,
} from "../auth/google.ts";
import { signToken } from "../auth/jwt.ts";
import { getStorageProvider } from "../storage/index.ts";

type Bindings = AuthRedirectEnv & { DB?: D1Database; STORAGE_PROVIDER?: string; JWT_SECRET?: string };

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.get("/auth/google", (c) => {
  const callbackUrl = new URL("/auth/google/callback", c.req.url).toString();
  const url = buildAuthRedirectUrl(c.env, callbackUrl);
  return c.redirect(url);
});

authRoutes.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing code" }, 400);
  const callbackUrl = new URL("/auth/google/callback", c.req.url).toString();
  try {
    const { accessToken } = await exchangeCodeForToken(c.env, code, callbackUrl);
    const profile = await fetchGoogleProfile(accessToken);
    const provider = getStorageProvider(c.env);
    await provider.upsertUser({
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.picture,
    });
    if (!c.env.JWT_SECRET) return c.json({ error: "JWT_SECRET missing" }, 500);
    const token = await signToken(c.env, { sub: profile.sub, email: profile.email });
    const redirectUrl = new URL("/auth/callback", c.env.WEB_URL);
    redirectUrl.hash = `token=${encodeURIComponent(token)}`;
    return c.redirect(redirectUrl.toString());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown auth error";
    return c.json({ error: message }, 400);
  }
});
