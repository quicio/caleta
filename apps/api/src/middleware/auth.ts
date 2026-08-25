// Middleware Hono: lee sesión de cookie `__Host-caleta_session` o
// `Authorization: Bearer` (fallback). Si la sesión está por expirar,
// renueva la cookie de sesión (sliding refresh) en la response.

import type { Context, MiddlewareHandler } from "hono";
import { SESSION_COOKIE, buildSessionCookie, readCookie } from "../auth/cookies.ts";
import { verifyAndRefresh, type JwtEnv, REFRESH_THRESHOLD_SEC } from "../auth/jwt.ts";
import { log } from "../lib/log.ts";
import type { AppVariables } from "../lib/variables.ts";

export type AuthEnv = {
  Variables: AppVariables & { user: { sub: string; email: string } };
  Bindings: JwtEnv & Record<string, unknown>;
};

interface SessionInfo {
  claims: { sub: string; email: string };
  newAccess: string | null;
}

async function readSession(
  c: Context<AuthEnv>,
  env: JwtEnv,
): Promise<SessionInfo | null> {
  // Cookie primero.
  const cookieToken = readCookie(c.req.header("cookie"), SESSION_COOKIE);
  if (cookieToken) {
    try {
      const { claims, refreshed } = await verifyAndRefresh(env, cookieToken, REFRESH_THRESHOLD_SEC);
      return { claims, newAccess: refreshed };
    } catch {
      // Cookie inválida o expirada. Probamos Bearer como fallback.
    }
  }
  // Fallback: Authorization Bearer.
  const auth = c.req.header("authorization") ?? "";
  const [scheme, token] = auth.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const { claims, refreshed } = await verifyAndRefresh(env, token, REFRESH_THRESHOLD_SEC);
      return { claims, newAccess: refreshed };
    } catch {
      return null;
    }
  }
  return null;
}

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const session = await readSession(c, c.env);
  if (!session) {
    log.warn("auth_failed", {
      request_id: c.get("request_id"),
      path: c.req.path,
    });
    return c.json({ error: "Missing or invalid session" }, 401);
  }
  c.set("user", { sub: session.claims.sub, email: session.claims.email });
  await next();
  if (session.newAccess) {
    c.res.headers.append(
      "Set-Cookie",
      buildSessionCookie(session.newAccess, (c.env as { WEB_URL?: string }).WEB_URL),
    );
  }
};

export function authedUser(c: Context<{ Variables: { user: { sub: string; email: string } } }>): { sub: string; email: string } {
  const u = c.get("user");
  return u;
}