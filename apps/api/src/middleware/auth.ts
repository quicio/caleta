// Middleware Hono: lee Authorization header, valida JWT, inyecta usuario.

import type { Context, MiddlewareHandler } from "hono";
import { verifyToken, type JwtEnv } from "../auth/jwt.ts";

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
    const claims = await verifyToken(c.env, token);
    c.set("user", { sub: claims.sub, email: claims.email });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  await next();
};

// Helper de uso
export function authedUser(c: Context<AuthEnv>): { sub: string; email: string } {
  return c.get("user");
}
