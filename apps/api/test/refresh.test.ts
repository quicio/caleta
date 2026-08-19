// Test ad-hoc del refresh sliding en el middleware auth.
// Corre con `node --experimental-transform-types apps/api/test/refresh.test.ts`.
//
// Estrategia: crear un JWT con exp = now + 600 (< threshold de 900s), pasarlo
// por verifyAndRefresh y assert que devuelve un token nuevo con exp ≈ now + 3600.

import { signToken, verifyAndRefresh, REFRESH_THRESHOLD_SEC } from "../src/auth/jwt.ts";

const env = { JWT_SECRET: "test-secret-needs-to-be-long-enough-for-hs256-32+" };

// Caso 1: token con poco tiempo restante (< threshold) → debe refrescar
const soonExp = Math.floor(Date.now() / 1000) + 600;
const shortLived = await signToken(env, { sub: "user-1", email: "a@b.c" }, 600);
const { claims, refreshed } = await verifyAndRefresh(env, shortLived, REFRESH_THRESHOLD_SEC);
if (!refreshed) {
  console.error("FAIL: token con 10min restantes no fue refrescado");
  process.exit(1);
}
const { jwtVerify, importJWK } = await import("jose");
const { payload } = await jwtVerify(refreshed, new TextEncoder().encode(env.JWT_SECRET), {
  issuer: "caleta",
  audience: "caleta-web",
});
const newRemaining = payload.exp - Math.floor(Date.now() / 1000);
if (newRemaining < 3500 || newRemaining > 3700) {
  console.error(`FAIL: nuevo token exp=${newRemaining}s, esperado ~3600s`);
  process.exit(1);
}
if (claims.sub !== "user-1" || claims.email !== "a@b.c") {
  console.error("FAIL: claims no matchean");
  process.exit(1);
}

// Caso 2: token con mucho tiempo restante (> threshold) → NO debe refrescar
const longLived = await signToken(env, { sub: "user-1", email: "a@b.c" }, 3600);
const r2 = await verifyAndRefresh(env, longLived, REFRESH_THRESHOLD_SEC);
if (r2.refreshed) {
  console.error("FAIL: token con 1h restantes fue refrescado (no debería)");
  process.exit(1);
}

console.log("OK: refresh sliding emite nuevo token cuando quedan <15min; respeta el threshold.");