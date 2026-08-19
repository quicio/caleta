// Middleware Hono: lee Authorization header, valida JWT, inyecta usuario.
// Si el access token está por expirar (< REFRESH_THRESHOLD_SEC), emite uno
// nuevo en el header `X-Refresh-Token` de la response.

import type { Context, MiddlewareHandler } from "hono";
import { verifyAndRefresh, type JwtEnv, REFRESH_THRESHOLD_SEC } from "../auth/jwt.ts";

export type AuthEnv = {
  Variables: { user: { sub: string; email: string } };
  Bindings: JwtEnv & Record<string, unknown>;
};

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }
  try {
    const { claims, refreshed } = await verifyAndRefresh(c.env, token, REFRESH_THRESHOLD_SEC);
    c.set("user", { sub: claims.sub, email: claims.email });
    if (refreshed) {
      c.res.headers.set("X-Refresh-Token", refreshed);
    }
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  await next();
};

export function authedUser(c: Context<AuthEnv>): { sub: string; email: string } {
  return c.get("user");
}