// Rate limit simple con Cloudflare KV. Fixed window con TTL: incrementa
// un counter en `rl:<route>:<scope>:<id>` y rechaza 429 si supera el límite
// dentro de la ventana.

import type { Context, MiddlewareHandler } from "hono";
import { log } from "../lib/log.ts";
import type { AppVariables } from "../lib/variables.ts";

export interface RateLimitEnv {
  Bindings: { RATE_LIMIT?: KVNamespace } & Record<string, unknown>;
  Variables: AppVariables & { user?: { sub: string; email: string } };
}

export interface RateLimitOpts {
  route: string;
  limit: number;
  windowSec: number;
  scope?: (c: Context<RateLimitEnv>) => string; // default: ip
}

/**
 * ponytail:el middleware devuelve el handler de Hono. Si excede, setea
 * Retry-After con el TTL restante (o windowSec como fallback) y responde 429.
 * Si no, deja pasar.
 */
export function rateLimit(opts: RateLimitOpts): MiddlewareHandler<RateLimitEnv> {
  return async (c, next) => {
    const kv = c.env.RATE_LIMIT;
    if (!kv) {
      // Sin KV binding (local dev sin secrets) no aplica. La doc lo dice.
      await next();
      return;
    }
    const id = (opts.scope ? opts.scope(c) : ipOf(c)) || "anon";
    const key = `rl:${opts.route}:${id}`;
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= opts.limit) {
      // KV get with metadata expone expirationTtl (tiempo restante en s)
      // en runtime. Sin API directa en la spec pública: usamos windowSec
      // como fallback y dejamos Retry-After >=1.
      const retry = opts.windowSec;
      c.header("Retry-After", String(retry));
      log.warn("rate_limit_exceeded", {
        request_id: c.get("request_id") as string | undefined,
        route: opts.route,
        scope_id: id,
        limit: opts.limit,
        window_sec: opts.windowSec,
      });
      return c.json({ error: "rate limit exceeded" }, 429);
    }
    const nextCount = count + 1;
    await kv.put(key, String(nextCount), { expirationTtl: opts.windowSec });
    await next();
  };
}

function ipOf(c: Context<RateLimitEnv>): string {
  // Cloudflare setea `cf-connecting-ip` en el edge.
  return c.req.header("cf-connecting-ip") ?? "0.0.0.0";
}

export function ipScope(): (c: Context<RateLimitEnv>) => string {
  return (c) => `ip:${ipOf(c)}`;
}

export function userScope(): (c: Context<RateLimitEnv>) => string {
  return (c) => {
    const u = c.get("user");
    return u ? `u:${u.sub}` : `ip:${ipOf(c)}`;
  };
}