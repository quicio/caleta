## Why

La auditoría inicial dejó como riesgo alto el JWT con TTL de 30 días sin mecanismo de refresh y la ausencia total de rate limiting. Combinado con que el token vive en `localStorage`, una sesión capturada por XSS es válida por un mes. Adicionalmente, los endpoints sensibles (`/auth/google/callback`, `/api/sync`) carecen de protección contra fuerza bruta o abuso de cuota.

Este cambio cierra ambos huecos con la cantidad mínima de código que resuelve el problema:

- TTL de JWT: 1 hora, con refresh "sliding" — cada respuesta a un endpoint autenticado emite un nuevo JWT (vía header `X-Refresh-Token`). El cliente lo reemplaza silenciosamente. Una sesión robada se invalida sola como máximo en 1h.
- Rate limit: por IP y por usuario, sliding window de 60s, almacenado en Cloudflare KV. Aplicado a `/auth/google` (5/min), `/auth/google/callback` (10/min), `/api/sync` POST (30/min). 429 con `Retry-After`.

Decisiones deliberadas:

- **No migramos a cookie httpOnly** en este cambio (es un refactor mayor del flujo OAuth y del frontend; queda para `auth-cookie-hardening`).
- **No usamos Rate Limit rules de Cloudflare** (limitación: operan por path/header en el edge, no por usuario). KV da control por usuario cuando hay token.
- **No introducimos DB-side counters** (D1 sumaría latencia y una tabla más para un feature que tira al cache).

## What Changes

- **API (`apps/api`):**
  - `auth/jwt.ts`: `signToken` con TTL default 1h, helper `verifyAndRefresh` que verifica un token y emite uno nuevo.
  - `routes/auth.ts`: en el callback, emitir dos tokens — un `access_token` (1h) y un `refresh_token` (30d). Mantener el redirect con `#token=...` (compat con cliente actual) pero incluir también `#refresh=...`. Refresh endpoint nuevo: `POST /auth/refresh` con `{ refresh_token }` que responde `{ access_token }`.
  - `middleware/auth.ts`: tras verificar el token, si quedan < 15min para expirar, setear `X-Refresh-Token` con uno nuevo. Helper `getRefreshedToken()`.
  - Nuevo `middleware/ratelimit.ts`: factory `rateLimit({ key, limit, windowSec })` que usa el binding `RATE_LIMIT` (KV). Incrementa con `put`+TTL. Devuelve 429 con header `Retry-After` si excede.
  - Aplicar en `authRoutes` (5/min `/auth/google`, 10/min `/auth/google/callback`) y en `syncRoutes` POST (30/min).
- **Infra (`infra/main.tf`):**
  - Crear `cloudflare_workers_kv_namespace` `caleta_ratelimit`.
  - Wire binding `RATE_LIMIT` en el worker API.
  - Actualizar la `wrangler.toml` local con un placeholder similar a `database_id`.
- **Web (`apps/web`):**
  - `lib/auth.ts`: guardar ambos tokens (`caleta.access`, `caleta.refresh`); método `getAccessToken()`.
  - `lib/api.ts`: cuando la response trae `X-Refresh-Token`, actualizar storage silenciosamente. Si recibe 401, intentar un refresh y reintentar una vez.
  - `routes/Callback.svelte`: leer `access` y `refresh` del hash.
- **Tests:**
  - Test ad-hoc para el rate limit: 6 requests en <60s al endpoint, assert que la sexta da 429.
  - Test ad-hoc para el refresh: token con `exp - now < 15min` recibe header `X-Refresh-Token`.

### Fuera de alcance

- Migrar a cookie httpOnly (`auth-cookie-hardening` futuro).
- Persistir refresh tokens en DB para revocación individual.
- Rate limit por usuario (no solo por IP) en endpoints no autenticados.

## Capabilities

### New Capabilities

- `session-security`: define el ciclo de vida de los tokens de sesión (TTL corto, refresh sliding) y la política de rate limit por IP/usuario en endpoints sensibles.

### Modified Capabilities

- `task-sync` (modifica):
  - El callback de OAuth emite dos tokens (`access` 1h + `refresh` 30d). El comportamiento del cliente que lee `#token=...` no cambia: el campo se llama igual.
  - El middleware de auth puede emitir un `X-Refresh-Token` en cualquier response autenticada cuando el access token está por expirar.
- `api-security` (modifica):
  - `/auth/google` y `/auth/google/callback` pasan a tener rate limit por IP.
  - `POST /api/sync` pasa a tener rate limit por usuario.

## Impact

- Código afectado:
  - `apps/api/src/auth/jwt.ts` (TTL default + helper refresh)
  - `apps/api/src/middleware/auth.ts` (refresh header)
  - `apps/api/src/middleware/ratelimit.ts` (nuevo)
  - `apps/api/src/routes/auth.ts` (dos tokens, endpoint refresh)
  - `apps/api/src/routes/sync.ts` (rate limit)
  - `apps/api/src/index.ts` (montar rate limit en authRoutes)
  - `apps/api/src/wrangler.toml` (placeholder binding)
  - `apps/web/src/lib/auth.ts` (dos tokens)
  - `apps/web/src/lib/api.ts` (manejar X-Refresh-Token)
  - `apps/web/src/routes/Callback.svelte` (dos tokens)
  - `apps/api/test/ratelimit.test.ts` (nuevo)
  - `apps/api/test/refresh.test.ts` (nuevo)
  - `infra/main.tf` (KV namespace + binding)
  - `infra/variables.tf` (sin cambios — el binding se crea desde el recurso, no requiere variable nueva)
- Dependencias nuevas runtime: ninguna.
- Sistemas externos: Cloudflare Workers KV (free tier: 100k reads/día, 1k writes/día, 1 GB — suficiente).
- Riesgos operacionales: usuarios con JWT viejo (TTL 30d) emitido antes del cambio siguen funcionando hasta su expiración natural; no hay invalidación forzada.