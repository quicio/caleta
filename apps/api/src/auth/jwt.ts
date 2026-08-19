// JWT simple con jose (HS256). El cliente sólo presenta el token; el servidor
// lo emite y verifica. La rotación del secret invalida todas las sesiones.

import { jwtVerify, SignJWT } from "jose";

export interface JwtClaims {
  sub: string; // Google user id
  email: string;
}

export interface JwtEnv {
  JWT_SECRET?: string;
}

function getSecret(env: JwtEnv): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(env: JwtEnv, claims: JwtClaims, ttlDays = 30): Promise<string> {
  return await new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .setIssuer("caleta")
    .setAudience("caleta-web")
    .sign(getSecret(env));
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
