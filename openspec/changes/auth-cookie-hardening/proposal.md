## Why

La auditoría inicial dejó como crítico/alto el hecho de que el JWT se guardaba en `localStorage` (#4) y viajaba en el fragmento de la URL (#5). Combinado con la ausencia de CSP estricta, una XSS exfiltra un token válido por 1h (después del #3). Este cambio cierra ambos: el token nunca toca JS ni la barra del navegador, vive en una cookie `__Host-` con flags endurecidos.

El mecanismo es el patrón estándar de OAuth/OIDC "auth code": el callback del backend genera un código de un solo uso (32 bytes random) con TTL 60s, lo guarda en KV con el JWT adentro, y redirige a la web con `?code=...` (query, no fragment — la query es visible al server, lo que queremos). La SPA hace `POST /auth/exchange` con `{ code }`, el backend responde 200 con `Set-Cookie: __Host-caleta_session=...` y elimina la entry de KV. El cliente nunca ve el JWT.

Decisiones clave:

- **`__Host-` prefix**: exige `Secure`, `Path=/`, sin `Domain`. Garantiza que la cookie no se filtra a subdominios.
- **`SameSite=Lax`**: bloquea CSRF cross-site en requests de terceros; permite navegación top-level desde Google (que es lo que queremos después del callback).
- **Soporte dual en el middleware**: lee sesión de cookie O de `Authorization: Bearer`. Compat con clientes que aún usen header (programáticos, mobile, etc.).
- **Refresh y logout contra cookie**: `/auth/refresh` lee el refresh token de la cookie; `/auth/logout` borra la cookie. La SPA ya no toca `caleta.access` ni `caleta.refresh`.
- **Sin revocación individual**: sigue siendo JWT stateless. La rotación de `JWT_SECRET` invalida todo. Está OK para hobby.

Lo que NO cambia:

- TTL de access (1h) y refresh (30d) — los decide `session-hardening`.
- Rate limit en `/auth/google` y callback — igual.
- Storage en D1 — sin cambios.
- Frontend UI — sin cambios (sólo el flujo interno del Callback).

## What Changes

- **Backend (`apps/api`):**
  - `auth/code.ts` (nuevo): helpers `generateAuthCode()`, `storeAuthCode(env, code, claims)`, `consumeAuthCode(env, code)`. Storage en KV con TTL 60s.
  - `routes/auth.ts`: callback genera code, guarda en KV, redirect a `WEB_URL/auth/callback?code=...` (sin `#access=...` ya). Nuevo `POST /auth/exchange` que consume el code y setea la cookie. Nuevo `POST /auth/logout` que limpia la cookie. `POST /auth/refresh` lee el refresh de la cookie en vez del body.
  - `middleware/auth.ts`: helper `readSession(c)` que devuelve `{ claims, refreshed }` desde cookie (preferido) o `Authorization` (fallback). Mantiene el `X-Refresh-Token` set cuando refresca.
  - `index.ts`: ya no necesita `CORS Allow-Credentials` (cookie se manda same-origin), pero ajustamos para que el preflight CORS siga funcionando cuando se llame cross-origin desde el web.
- **Infra (`infra/main.tf`):** sin cambios — el mismo KV `caleta_ratelimit` se usa para auth codes (separa con prefijo `authcode:` vs `rl:`).
- **Web (`apps/web`):**
  - `lib/auth.ts`: borramos `getAccessToken`, `getRefreshToken`, `setTokens`, `setAccess`. Sólo queda `isAuthenticated()` que hace un `GET /api/me` o un refresh preventivo para saber si hay sesión. `clearSession()` llama `POST /auth/logout`.
  - `lib/api.ts`: `call()` no agrega `Authorization`. Usa `credentials: "include"` para mandar la cookie. Lee `X-Refresh-Token` y, si la cookie de sesión fue refrescada, no tiene que hacer nada del lado del cliente — el server actualiza la cookie. Eliminado el flujo de 401+refresh manual (el server lo hace cuando la cookie expira via sliding refresh).
  - `routes/Callback.svelte`: lee `code` de query (no del hash), llama `POST /auth/exchange`, navega a `/`. Si el exchange falla, muestra error.
  - `App.svelte`: el botón "logout" llama `clearSession()` (que llama a `POST /auth/logout`). `isAuthenticated` se resuelve vía un endpoint trivial `GET /api/me` que devuelve `{ email }` o 401.

### Fuera de alcance

- CSP estricta en el HTML del web (meta tag o header del worker de assets). Queda para `csp-headers`.
- Refresh tokens persistidos en DB para revocación individual.
- Rotación automática de `JWT_SECRET`.

## Capabilities

### New Capabilities

- `cookie-auth`: define el ciclo de vida de la sesión via cookie httpOnly. El JWT nunca aparece en JS ni en la URL.

### Modified Capabilities

- `task-sync` (modifica):
  - El callback de OAuth ya no emite JWT en el hash. Emite un code de un solo uso.
  - Las requests autenticadas pueden usar cookie o `Authorization: Bearer`. El server prefiere cookie.
- `session-security` (modifica):
  - `/auth/refresh` lee de cookie en vez de body.
  - Nuevo `/auth/exchange` (canje de code) y `/auth/logout`.
- `api-security` (modifica):
  - El callback de OAuth redirige a `WEB_URL/auth/callback?code=...` en vez de `#access=...&refresh=...&exp=...`.

## Impact

- Código afectado:
  - `apps/api/src/auth/code.ts` (nuevo)
  - `apps/api/src/auth/jwt.ts` (helpers de cookie, sin cambios de sign/verify)
  - `apps/api/src/middleware/auth.ts` (readSession dual: cookie primero, header fallback)
  - `apps/api/src/routes/auth.ts` (callback usa code; nuevo /exchange; nuevo /logout; /refresh lee cookie)
  - `apps/api/src/routes/me.ts` (nuevo — `GET /api/me` para que la SPA sepa si hay sesión)
  - `apps/api/src/index.ts` (monta /api/me)
  - `apps/web/src/lib/auth.ts` (reescrito: sin tokens, sólo `isAuthenticated` + `clearSession`)
  - `apps/web/src/lib/api.ts` (`credentials: include`, sin Authorization)
  - `apps/web/src/routes/Callback.svelte` (lee `?code=`, llama `/auth/exchange`)
  - `apps/web/src/App.svelte` (logout via API, check via /api/me)
  - `apps/api/test/exchange.test.ts` (nuevo — code store/consume)
- Compatibilidad:
  - El backend sigue aceptando `Authorization: Bearer` (para clientes programáticos).
  - El frontend NO migra clientes externos — la SPA sí cambia.
- Riesgos operacionales:
  - Sesiones existentes en `localStorage` quedan inservibles cuando el usuario recarga; el flujo de login los re-emite via cookie. No hay acción manual necesaria.
  - Si la cookie de sesión se setea con `Secure` y el dev es HTTP, no funciona. Mitigación: detectar env y relajar `Secure` cuando `WEB_URL` es `http://localhost` (lo cual ya hace el codepath de state cookie).
- Sin nuevas dependencias runtime.