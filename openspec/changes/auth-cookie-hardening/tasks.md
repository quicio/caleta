## 1. Backend — auth code en KV

- [ ] 1.1 Crear `apps/api/src/auth/code.ts`. Funciones: `generateAuthCode()` (32 bytes hex), `storeAuthCode(env, code, claims, ttlSec=60)` con `kv.put("authcode:"+code, JSON.stringify({sub,email,exp}), {expirationTtl:60})`, `consumeAuthCode(env, code)` con `get`+`delete` (atómico best-effort; si el get devuelve algo, lo borra y lo devuelve). Si no existe o expiró, devuelve `null`.
- [ ] 1.2 En `apps/api/src/routes/auth.ts` callback: después de upsertUser, generar access+refresh tokens (helpers de `jwt.ts`); `storeAuthCode` con `{ sub, email, access, refresh }`; redirect a `${WEB_URL}/auth/callback?code=<code>` (sin hash). El borrado de la cookie de state sigue igual.

## 2. Backend — endpoints de auth

- [ ] 2.1 Nuevo `POST /auth/exchange` en `routes/auth.ts`: recibe `{ code }`, llama `consumeAuthCode`. Si null, 400. Si OK, setea `Set-Cookie: __Host-caleta_session=<access>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600` y `Set-Cookie: __Host-caleta_refresh=<refresh>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` y responde `{ ok: true }`. Si `WEB_URL` empieza con `http://localhost`, omitir `Secure` para dev local.
- [ ] 2.2 Nuevo `POST /auth/logout`: setea ambas cookies con `Max-Age=0`. Responde `{ ok: true }`.
- [ ] 2.3 Cambiar `POST /auth/refresh`: lee `__Host-caleta_refresh` de las cookies, verifica, emite nuevo access, lo setea en `__Host-caleta_session`. Mantiene refresh igual (no rota por ahora). 401 si no hay cookie o el token es inválido.
- [ ] 2.4 Nuevo `GET /api/me`: requiere auth, responde `{ sub, email }`. Usado por la SPA para `isAuthenticated()`.

## 3. Backend — middleware dual

- [ ] 3.1 En `apps/api/src/middleware/auth.ts`: helper `readSession(c)`:
  - Lee `Cookie` header; si encuentra `__Host-caleta_session`, llama `verifyAndRefresh`. Si OK, devuelve claims y (si hay) un nuevo access. Si falla, intenta `Authorization: Bearer ...` como fallback.
  - Si cookie existe y `verifyAndRefresh` renovó, el middleware setea `Set-Cookie: __Host-caleta_session=<nuevo>; ...` en la response (no `X-Refresh-Token` — la cookie ya viaja en la response del browser).
- [ ] 3.2 El `requireAuth` middleware usa `readSession` y mantiene el comportamiento actual (setear `c.set("user", ...)`).

## 4. Web — borrar tokens locales

- [ ] 4.1 `apps/web/src/lib/auth.ts`: reescribir. Eliminar `getAccessToken`, `getRefreshToken`, `setTokens`, `setAccess`, `decodeToken`. Sólo dejar:
  - `isAuthenticated(): Promise<boolean>` que llama a `GET /api/me` con `credentials: include`; cachea el resultado en memoria por 5s para no martillar.
  - `getCurrentUser(): { sub, email } | null` lee del cache.
  - `clearSession(): Promise<void>` llama `POST /auth/logout` y limpia el cache.
- [ ] 4.2 `apps/web/src/lib/api.ts`: `call()`:
  - Quitar header `Authorization`.
  - Agregar `credentials: "include"` a `fetch`.
  - En 401, llamar `clearSession()` y redirigir a `/`. Sin retry de refresh (el server sliding refresh ya manejó la renovación vía cookie).
  - Eliminado: `tryRefresh`, `refreshInFlight`, header `X-Refresh-Token` (la cookie viaja en la response).
- [ ] 4.3 `apps/web/src/routes/Callback.svelte`: leer `code` de query (no del hash). Llamar `POST /auth/exchange` con `{ code }`. Si OK, navegar a `/`. Si falla, mostrar error.
- [ ] 4.4 `apps/web/src/App.svelte`: `onMount` hace un `isAuthenticated()` (en vez de leer localStorage). `onLogout` llama `clearSession()`. `onAuthChange` re-llama a `isAuthenticated()` cuando recibe `popstate`.

## 5. Infra

- [ ] 5.1 Sin cambios en `infra/main.tf` — el mismo KV `RATE_LIMIT` se reusa para `authcode:*` (prefijos distintos, sin colisión).

## 6. Tests

- [ ] 6.1 `apps/api/test/exchange.test.ts`:
  - `storeAuthCode` + `consumeAuthCode` happy path: store con un code, consume devuelve el payload, segundo consume devuelve null.
  - `consumeAuthCode` con code inexistente: null.
  - Mock de KV que respeta `expirationTtl`.

## 7. Validación

- [ ] 7.1 `npm run typecheck --workspace=apps/api` sin errores.
- [ ] 7.2 `npm run test --workspace=apps/api` pasa los 4 tests (sync-no-injection, refresh, ratelimit, exchange).
- [ ] 7.3 `npm run build:api` y `npm run build:web` pasan.
- [ ] 7.4 `terraform -chdir=infra fmt -check` y `validate` pasan.
- [ ] 7.5 `openspec validate auth-cookie-hardening` sin errores.
- [ ] 7.6 CI verde en el PR.