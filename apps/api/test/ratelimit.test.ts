// Test ad-hoc del rate limit middleware.
// Corre con `node --experimental-transform-types apps/api/test/ratelimit.test.ts`.
//
// Estrategia: mock de KVNamespace (objeto plano) + Hono minimal.
// Llamar al middleware 6 veces con limit=5. La sexta debe devolver 429 con Retry-After.

import { Hono } from "hono";
import { rateLimit, ipScope } from "../src/middleware/ratelimit.ts";

const store = new Map<string, { value: string; expires: number }>();
const kv: KVNamespace = {
  async get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },
  async put(key, value, opts) {
    store.set(key, { value, expires: Date.now() + (opts?.expirationTtl ?? 60) * 1000 });
  },
  async delete(key) {
    store.delete(key);
  },
  async list() {
    return { keys: [], list_complete: true, cacheStatus: null };
  },
  async getWithMetadata() {
    return { value: null, metadata: null, cacheStatus: null };
  },
} as unknown as KVNamespace;

type Bindings = { RATE_LIMIT?: KVNamespace };
const app = new Hono<{ Bindings: Bindings; Variables: { user?: { sub: string } } }>();
app.get(
  "/probe",
  rateLimit({ route: "test_route", limit: 5, windowSec: 60, scope: () => "ip:1.2.3.4" }),
  (c) => c.json({ ok: true }),
);

let lastStatus = 0;
let lastRetryAfter = "";
for (let i = 0; i < 6; i++) {
  const res = await app.request("/probe", { headers: { "cf-connecting-ip": "1.2.3.4" } }, {
    RATE_LIMIT: kv,
  } as any);
  lastStatus = res.status;
  lastRetryAfter = res.headers.get("Retry-After") ?? "";
  if (i < 5 && res.status !== 200) {
    console.error(`FAIL: request ${i + 1} devolvió ${res.status}, esperado 200`);
    process.exit(1);
  }
}

if (lastStatus !== 429) {
  console.error(`FAIL: sexta request devolvió ${lastStatus}, esperado 429`);
  process.exit(1);
}
if (!lastRetryAfter) {
  console.error("FAIL: 429 no incluye Retry-After header");
  process.exit(1);
}

console.log("OK: rate limit bloquea con 429 + Retry-After tras el límite.");