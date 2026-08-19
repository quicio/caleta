// /api/me — endpoint trivial que devuelve la identidad del usuario actual.
// Usado por la SPA para chequear sesión sin tocar tokens.

import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";

export const meRoutes = new Hono<{ Variables: AuthEnv["Variables"] }>();
meRoutes.use("*", requireAuth);
meRoutes.get("/api/me", (c) => {
  const user = c.get("user");
  return c.json({ sub: user.sub, email: user.email });
});