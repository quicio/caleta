// ponytail: el middleware genera un request_id por request, lo expone en el
// header `x-request-id` para correlación cliente↔server, y emite un access
// log JSON con duración y status al final.

import type { MiddlewareHandler } from "hono";
import { log, newRequestId, type LogContext } from "../lib/log.ts";
import type { AppVariables } from "../lib/variables.ts";

export interface LoggerEnv {
  Variables: AppVariables & { user?: { sub: string; email: string } };
}

export function logger(): MiddlewareHandler<LoggerEnv> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? newRequestId();
    c.set("request_id", requestId);
    c.header("x-request-id", requestId);

    const startedAt = Date.now();
    try {
      await next();
    } finally {
      const duration = Date.now() - startedAt;
      const ctx: LogContext = {
        request_id: requestId,
        method: c.req.method,
        route: c.req.path,
        status: c.res.status,
        duration_ms: duration,
      };
      const user = c.get("user");
      if (user) ctx.user_id = user.sub;
      const level = c.res.status >= 500 ? "error" : c.res.status >= 400 ? "warn" : "info";
      log[level]("http", ctx);
    }
  };
}