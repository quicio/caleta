## Purpose

Define la nueva forma de portar la sesión del usuario: una cookie `__Host-caleta_session` httpOnly+Secure+SameSite=Lax, emitida por el backend vía un code de un solo uso que la SPA canjea en `POST /auth/exchange`. El JWT nunca aparece en JS ni en la URL, lo que cierra el riesgo de exfiltración por XSS del token en `localStorage`.

## ADDED Requirements

### Requirement: OAuth callback returns a one-time code, not a token

El callback de Google MUST generar un code de un solo uso (32 bytes random hex, TTL 60s) y redirigir a `WEB_URL/auth/callback?code=<code>`. El JWT nunca aparece en el redirect.

#### Scenario: callback success
- **WHEN** el callback valida state, exchange, y profile con `email_verified=true`
- **THEN** el redirect a `WEB_URL/auth/callback` tiene query `?code=<32 bytes hex>`. NO hay hash con tokens.

#### Scenario: callback error
- **WHEN** el callback falla por state inválido, exchange, o `email_verified=false`
- **THEN** el servicio responde `400` con un mensaje genérico (sin code ni tokens).

### Requirement: Auth code is single-use and short-lived

El code generado por el callback MUST almacenarse en KV con `expirationTtl: 60` y borrarse en el primer `consume` exitoso.

#### Scenario: first consume
- **WHEN** llega `POST /auth/exchange` con un code recién emitido
- **THEN** el servicio devuelve el payload asociado y elimina la entry de KV

#### Scenario: second consume
- **WHEN** llega `POST /auth/exchange` con un code ya consumido
- **THEN** el servicio responde `400` con `code inválido o expirado`

#### Scenario: expired code
- **WHEN** llega `POST /auth/exchange` con un code de más de 60s de antigüedad
- **THEN** el servicio responde `400` (KV lo evictó por TTL)

### Requirement: Session is a `__Host-` cookie

El servicio MUST emitir dos cookies con prefijo `__Host-`:

| Cookie | Valor | Max-Age | Flags |
| --- | --- | --- | --- |
| `__Host-caleta_session` | access token (1h) | 3600 | `Path=/; HttpOnly; Secure; SameSite=Lax` |
| `__Host-caleta_refresh` | refresh token (30d) | 2592000 | `Path=/; HttpOnly; Secure; SameSite=Lax` |

Las cookies se emiten por `POST /auth/exchange` (caso feliz) y se limpian por `POST /auth/logout` (`Max-Age=0`).

#### Scenario: dev HTTP localhost
- **WHEN** `WEB_URL` empieza con `http://localhost` o `http://127.0.0.1`
- **THEN** el flag `Secure` se omite (los browsers rechazan `Secure` sin HTTPS). En prod (HTTPS) `Secure` está siempre presente.

#### Scenario: production HTTPS
- **WHEN** `WEB_URL` es HTTPS
- **THEN** ambas cookies llevan `Secure`. El prefijo `__Host-` requiere `Secure` + `Path=/` + sin `Domain`.

### Requirement: Middleware accepts session cookie or Bearer header

El middleware `requireAuth` MUST leer la sesión de la cookie `__Host-caleta_session` primero, y caer al `Authorization: Bearer` header sólo si la cookie no está presente. Si la cookie existe y el token está por expirar, MUST renovar la cookie de sesión (sliding refresh) en la response.

#### Scenario: session cookie present and valid
- **WHEN** llega una request con `Cookie: __Host-caleta_session=<jwt válido>`
- **THEN** el middleware acepta la request y setea `c.set("user", { sub, email })`.

#### Scenario: session cookie near expiry
- **WHEN** el access expira en < 15min
- **THEN** la response incluye `Set-Cookie: __Host-caleta_session=<nuevo>; ...` con TTL 1h.

#### Scenario: bearer fallback
- **WHEN** no hay cookie de sesión pero hay `Authorization: Bearer <jwt>`
- **THEN** el middleware acepta la request con el mismo flujo de refresh.

#### Scenario: neither present
- **WHEN** no hay cookie ni `Authorization`
- **THEN** el middleware responde `401`.

### Requirement: Refresh reads from cookie, not body

`POST /auth/refresh` MUST leer el refresh token de la cookie `__Host-caleta_refresh`, no del body. La response setea una nueva cookie `__Host-caleta_session`.

#### Scenario: refresh happy path
- **WHEN** llega `POST /auth/refresh` con `Cookie: __Host-caleta_refresh=<válido>`
- **THEN** la response es `200` (body vacío o `{ ok: true }`) y `Set-Cookie: __Host-caleta_session=<nuevo>; ...`.

#### Scenario: refresh without cookie
- **WHEN** llega `POST /auth/refresh` sin cookie de refresh
- **THEN** la response es `401`.

### Requirement: Logout clears both cookies

`POST /auth/logout` MUST limpiar ambas cookies (`Max-Age=0`) y responder `200`.

#### Scenario: logout
- **WHEN** llega `POST /auth/logout` con o sin cookies
- **THEN** la response es `200` con `Set-Cookie: __Host-caleta_session=; Max-Age=0; ...` y `Set-Cookie: __Host-caleta_refresh=; Max-Age=0; ...`.

### Requirement: Web client never sees the JWT

La SPA MUST NO guardar el access ni el refresh token en `localStorage`, `sessionStorage` ni variables JS accesibles al scope global. La sesión se infiere via `GET /api/me` que viaja con la cookie.

#### Scenario: isAuthenticated check
- **WHEN** la SPA llama a `GET /api/me` con `credentials: "include"`
- **THEN** recibe `200 { sub, email }` si hay cookie válida, o `401` si no.

#### Scenario: login flow
- **WHEN** la SPA llega a `/auth/callback?code=...`
- **THEN** hace `POST /auth/exchange` con `{ code }`, recibe `Set-Cookie`, y navega a `/`. La SPA nunca ve el JWT.

#### Scenario: logout
- **WHEN** el usuario clickea logout
- **THEN** la SPA llama `POST /auth/logout` y limpia el cache de `isAuthenticated`. Las cookies las borra el server.

## MODIFIED Requirements

### Requirement: API requests use credentials: include

Modifica `task-sync/Client contract`. La SPA MUST hacer fetch con `credentials: "include"` para que las cookies viajen. NO MUST enviar `Authorization: Bearer`.

#### Scenario: api call
- **WHEN** la SPA hace `fetch(API_BASE + "/api/lists", { credentials: "include" })`
- **THEN** el browser manda la cookie `__Host-caleta_session` automáticamente.

### Requirement: Callback reads from query, not hash

Modifica `api-security/OAuth state is validated on callback`. El redirect final del callback MUST tener el code en el query string (`?code=...`), NO en el hash.

#### Scenario: callback URL
- **WHEN** el callback de OAuth termina OK
- **THEN** la URL es `https://caleta-web.<sub>.workers.dev/auth/callback?code=<hex>`. El browser no guarda tokens en history.