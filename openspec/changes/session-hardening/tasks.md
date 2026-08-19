## 1. JWT TTL corto y refresh sliding

- [ ] 1.1 En `apps/api/src/auth/jwt.ts`: `signToken` toma `ttlSeconds` (default `3600`). Helper `verifyAndRefresh(env, token, thresholdSec=900)` que verifica y emite un nuevo token si quedan < `thresholdSec` para expirar. Helper `signRefreshToken(env, claims, ttlDays=30)`.
- [ ] 1.2 En `apps/api/src/middleware/auth.ts`: tras `verifyToken`, llamar a `verifyAndRefresh`. Si devuelve un nuevo token, setear header `X-Refresh-Token: <token>` en `c.res.headers`. Helper `getRefreshedToken(c)` que retorna el token nuevo o `null`.
- [ ] 1.3 En `apps/api/src/routes/auth.ts` callback: emitir dos tokens. Cambiar el hash del redirect de `#token=...` a `#access=...&refresh=...&exp=<unix>`. Mantener compat: si el cliente lee solo `access`, funciona; si lee `token` viejo, intentar `access` después.
- [ ] 1.4 Crear `POST /auth/refresh` que recibe `{ refresh_token }` y responde `{ access_token, exp }`. 401 si el refresh es inválido o expiró.

## 2. Rate limit con KV

- [ ] 2.1 Crear `apps/api/src/middleware/ratelimit.ts`. Función `rateLimit({ key, limit, windowSec })` que:
  - usa `env.RATE_LIMIT.get(key)` para leer el contador actual,
  - si no existe, `put(key, "1", { expirationTtl: windowSec })`,
  - si existe y `Number(value) >= limit`, retorna 429 con `Retry-After: <ttlRestante>`,
  - sino, `put(key, String(n+1), { expirationTtl: windowSec })` y permite pasar.
  - `key` por default: `rl:<route>:<ip>`; si hay `c.get("user")`, prefiere `rl:<route>:u:<sub>`.
- [ ] 2.2 En `apps/api/src/index.ts`: aplicar `rateLimit({ limit: 5, windowSec: 60, route: "auth_start" })` a `GET /auth/google`.
- [ ] 2.3 En `apps/api/src/routes/auth.ts`: aplicar `rateLimit({ limit: 10, windowSec: 60, route: "auth_callback" })` a `GET /auth/google/callback` (antes del exchange).
- [ ] 2.4 En `apps/api/src/routes/sync.ts`: aplicar `rateLimit({ limit: 30, windowSec: 60, route: "sync_push" })` a `POST /api/sync`.

## 3. Web — manejo de dos tokens

- [ ] 3.1 En `apps/web/src/lib/auth.ts`: storage con `caleta.access` y `caleta.refresh`. Helper `getAccessToken()`, `getRefreshToken()`, `setTokens({ access, refresh, exp })`, `clearTokens()`. `isAuthenticated()` chequea `access` + `exp > now`.
- [ ] 3.2 En `apps/web/src/lib/api.ts`: en el wrapper `call`, si la response trae `X-Refresh-Token`, llamar a `setTokens` con el nuevo (manteniendo el refresh viejo). Si la response es 401 y tenemos refresh, hacer `POST /auth/refresh` una vez y reintentar el request original.
- [ ] 3.3 En `apps/web/src/routes/Callback.svelte`: leer `access`, `refresh`, `exp` del hash. Compat: si no están, intentar `token` viejo y usar como access (sin refresh).

## 4. Infra

- [ ] 4.1 En `infra/main.tf`: crear `cloudflare_workers_kv_namespace` `caleta_ratelimit` con `account_id = var.account_id`. Agregar binding `RATE_LIMIT` (type `kv_namespace`, `namespace_id = ...`) al `cloudflare_workers_script.api`.
- [ ] 4.2 En `apps/api/wrangler.toml`: añadir `[[kv_namespaces]]` con placeholder `id = "TODO_PEGAR_DESPUES_DE_terraform_apply"` para que `wrangler dev` local pueda instanciar el provider (no estrictamente necesario en este cambio — el binding lo crea Terraform; documentar en el spec).

## 5. Tests

- [ ] 5.1 `apps/api/test/ratelimit.test.ts`: mock de KV que cuenta `get`/`put`. Llamar al middleware con `limit=5, windowSec=60` 6 veces seguidas. La sexta debe devolver 429. Validar `Retry-After` presente.
- [ ] 5.2 `apps/api/test/refresh.test.ts`: crear un token con `exp = now + 600`. Pasarlo por el middleware. La response debe incluir `X-Refresh-Token`. Validar que el nuevo token tiene `exp ≈ now + 3600`.

## 6. Validación

- [ ] 6.1 `npm run typecheck --workspace=apps/api` sin errores.
- [ ] 6.2 `npm run test --workspace=apps/api` pasa los dos tests.
- [ ] 6.3 `npm run build:api` y `npm run build:web` pasan.
- [ ] 6.4 `terraform -chdir=infra fmt -check` y `terraform -chdir=infra validate` pasan.
- [ ] 6.5 `openspec validate session-hardening` sin errores.
- [ ] 6.6 CI verde en el PR.