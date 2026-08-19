// Auth codes: códigos de un solo uso para canjear por una sesión cookie.
// Se almacenan en KV con TTL 60s y se eliminan en el primer consume exitoso.

export interface CodePayload {
  sub: string;
  email: string;
  access: string;
  refresh: string;
}

export const AUTH_CODE_TTL_SEC = 60;
const KEY_PREFIX = "authcode:";

export function generateAuthCode(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function storeAuthCode(
  kv: KVNamespace,
  code: string,
  payload: CodePayload,
  ttlSec: number = AUTH_CODE_TTL_SEC,
): Promise<void> {
  await kv.put(KEY_PREFIX + code, JSON.stringify(payload), { expirationTtl: ttlSec });
}

/**
 * Lee y elimina el code. Atómico best-effort: si get devuelve algo, delete
 * y devolvemos. Si no, null. KV no garantiza read-then-delete atómico entre
 * réplicas, pero los codes de 60s son de un solo uso por diseño — si dos
 * requests llegan casi-simultáneos con el mismo code, uno gana.
 */
export async function consumeAuthCode(
  kv: KVNamespace,
  code: string,
): Promise<CodePayload | null> {
  const raw = await kv.get(KEY_PREFIX + code);
  if (!raw) return null;
  await kv.delete(KEY_PREFIX + code);
  try {
    return JSON.parse(raw) as CodePayload;
  } catch {
    return null;
  }
}