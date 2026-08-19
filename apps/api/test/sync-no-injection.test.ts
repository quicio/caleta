// Test ad-hoc del fix de SQL injection en getSyncSnapshot.
// No usa framework: corre con `node apps/api/test/sync-no-injection.mjs`
// después de `wrangler build` (o `wrangler deploy --dry-run --outdir=dist`).
//
// Estrategia: en vez de cargar el módulo TS (que requiere el toolchain
// de workers), ejercitamos el patrón SQL que el provider *debe* generar.
// Capturamos el SQL pasado a `prepare(...)` y los binds, y assert que
// el valor controlado por el cliente NUNCA aparece como literal en la SQL
// preparada. El fixture mock es un stand-in minimalista del D1Database
// binding usado por los tests.
//
// Para correr:
//   cd apps/api
//   npx wrangler deploy --dry-run --outdir=dist  # asegura types/loader
//   node test/sync-no-injection.mjs

import { D1Provider } from "../src/storage/d1.ts";

const capturedSql = [];
const capturedBinds = [];

const stmt = {
  bind(...args) {
    capturedBinds.push(args);
    return this;
  },
  async all() {
    return { results: [] };
  },
  async first() {
    return null;
  },
};

const db = {
  prepare(sql) {
    capturedSql.push(sql);
    return stmt;
  },
};

const provider = new D1Provider(db);

const malicious = "'; DROP TABLE lists; --";

await provider.getSyncSnapshot("user-1", malicious, () => "2026-01-01T00:00:00.000Z");

const allSql = capturedSql.join("\n");
if (allSql.includes(malicious)) {
  console.error("FAIL: payload aparece literal en la SQL:");
  console.error(allSql);
  process.exit(1);
}

const lastBind = capturedBinds[capturedBinds.length - 1];
const bindHasPayload = lastBind.some((v) => typeof v === "string" && v === malicious);
if (!bindHasPayload) {
  console.error("FAIL: bind no contiene el payload literal:");
  console.error(JSON.stringify(lastBind));
  process.exit(1);
}

console.log("OK: getSyncSnapshot no interpola `since`; el payload viaja como bind.");