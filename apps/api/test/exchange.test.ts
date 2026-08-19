// Test ad-hoc de store/consume de auth codes.
// Corre con `node --experimental-transform-types apps/api/test/exchange.test.ts`.

import { generateAuthCode, storeAuthCode, consumeAuthCode } from "../src/auth/code.ts";

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

// Happy path
const code = generateAuthCode();
if (!/^[0-9a-f]{64}$/.test(code)) {
  console.error(`FAIL: code no tiene formato esperado: ${code}`);
  process.exit(1);
}
const payload = { sub: "u1", email: "a@b.c", access: "acc", refresh: "ref" };
await storeAuthCode(kv, code, payload);
const consumed = await consumeAuthCode(kv, code);
if (!consumed || consumed.sub !== "u1" || consumed.access !== "acc") {
  console.error("FAIL: primer consume no devolvió el payload");
  process.exit(1);
}

// Second consume: debe devolver null
const second = await consumeAuthCode(kv, code);
if (second !== null) {
  console.error("FAIL: segundo consume debería devolver null");
  process.exit(1);
}

// Code inexistente
const missing = await consumeAuthCode(kv, "nonexistent");
if (missing !== null) {
  console.error("FAIL: consume de code inexistente debería devolver null");
  process.exit(1);
}

console.log("OK: auth code single-use con TTL, generate() produce 32 bytes hex.");