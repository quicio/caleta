// Logger estructurado en JSON. Wrangler tail y Cloudflare Workers Logs
// capturan stdout/stderr por defecto — no requiere config.
//
// ponytail: shape estable { ts, level, msg, request_id?, ...ctx }. No
// usamos librerías para mantener el bundle pequeño; un log es un JSON.stringify.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  request_id?: string;
  user_id?: string;
  route?: string;
  method?: string;
  status?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel =
  ((globalThis as { CALETA_LOG_LEVEL?: LogLevel }).CALETA_LOG_LEVEL as LogLevel) ?? "info";

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug(msg: string, ctx?: LogContext): void {
    emit("debug", msg, ctx);
  },
  info(msg: string, ctx?: LogContext): void {
    emit("info", msg, ctx);
  },
  warn(msg: string, ctx?: LogContext): void {
    emit("warn", msg, ctx);
  },
  error(msg: string, ctx?: LogContext): void {
    emit("error", msg, ctx);
  },
};

export function newRequestId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}