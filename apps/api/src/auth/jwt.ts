// JWT con jose (HS256). El cliente sólo presenta el access token; el servidor
// lo emite y verifica. La rotación del secret invalida todas las sesiones.

import { jwtVerify, SignJWT } from "jose";

export interface JwtClaims {
  sub: string; // Google user id
  email: string;
}

export interface JwtEnv {
  JWT_SECRET?: string;
}

export const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1h
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30d
export const REFRESH_THRESHOLD_SEC = 15 * 60; // refresh sliding cuando quedan <15min

function getSecret(env: JwtEnv): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(
  env: JwtEnv,
  claims: JwtClaims,
  ttlSec: number = ACCESS_TOKEN_TTL_SEC,
): Promise<string> {
  return await new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .setIssuer("caleta")
    .setAudience("caleta-web")
    .sign(getSecret(env));
}

export async function signRefreshToken(env: JwtEnv, claims: JwtClaims): Promise<string> {
  return signToken(env, claims, REFRESH_TOKEN_TTL_SEC);
}

export async function verifyToken(env: JwtEnv, token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, getSecret(env), {
    issuer: "caleta",
    audience: "caleta-web",
  });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Missing sub");
  }
  const email = payload.email;
  if (typeof email !== "string") {
    throw new Error("Missing email");
  }
  return { sub: payload.sub, email };
}

/**
 * Verifica el token y, si faltan < thresholdSec para expirar, emite uno nuevo
 * con TTL completo. Retorna { claims, refreshed } donde `refreshed` es el
 * nuevo access token o null si no se renovó.
 */
export async function verifyAndRefresh(
  env: JwtEnv,
  token: string,
  thresholdSec: number = REFRESH_THRESHOLD_SEC,
): Promise<{ claims: JwtClaims; refreshed: string | null }> {
  const { payload, claims } = await verifyTokenWithPayload(env, token);
  if (typeof payload.exp !== "number") {
    return { claims, refreshed: null };
  }
  const remaining = payload.exp - Math.floor(Date.now() / 1000);
  if (remaining < thresholdSec) {
    return { claims, refreshed: await signToken(env, claims) };
  }
  return { claims, refreshed: null };
}

async function verifyTokenWithPayload(
  env: JwtEnv,
  token: string,
): Promise<{ payload: Record<string, unknown>; claims: JwtClaims }> {
  const { payload } = await jwtVerify(token, getSecret(env), {
    issuer: "caleta",
    audience: "caleta-web",
  });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Missing sub");
  }
  const email = payload.email;
  if (typeof email !== "string") {
    throw new Error("Missing email");
  }
  return { payload: payload as Record<string, unknown>, claims: { sub: payload.sub, email } };
}