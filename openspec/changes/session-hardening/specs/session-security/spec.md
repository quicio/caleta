## Purpose

Cierra dos riesgos restantes del MVP relacionados con la longevidad de la sesión: el JWT de 30 días sin refresh y la ausencia de rate limit. La capacidad `session-security` define el ciclo de vida de los tokens (access corto + refresh largo) y la política de rate limit por IP/usuario en endpoints sensibles. Cualquier cambio que rompa el contrato (un JWT con TTL mayor, un endpoint sensible sin rate limit) debe romper uno de los tests ad-hoc.

## ADDED Requirements

### Requirement: Access token TTL is at most one hour

El servicio MUST emitir access tokens con un TTL ≤ 1 hora. El TTL anterior de 30 días queda eliminado.

#### Scenario: access token TTL
- **WHEN** un cliente completa el callback de OAuth o llama `POST /auth/refresh`
- **THEN** el access token devuelto tiene `exp - iat ≤ 3600` segundos.

#### Scenario: refresh token TTL
- **WHEN** un cliente completa el callback de OAuth
- **THEN** el refresh token devuelto tiene `exp - iat ≈ 30 días` y no se usa nunca para autenticar requests — sólo para pedir access tokens nuevos.

### Requirement: Sliding refresh on authenticated requests

El middleware de autenticación MUST renovar el access token cuando faltan < 15 minutos para expirar, emitiendo el nuevo token en el header `X-Refresh-Token` de la response.

#### Scenario: access token expiring soon
- **WHEN** una request autenticada llega con un access token cuyo `exp - now < 15min`
- **THEN** la response incluye `X-Refresh-Token: <nuevo access token>` con TTL 1h

#### Scenario: access token with more than 15 minutes remaining
- **WHEN** una request autenticada llega con un access token cuyo `exp - now ≥ 15min`
- **THEN** la response NO incluye `X-Refresh-Token`

#### Scenario: explicit refresh endpoint
- **WHEN** un cliente hace `POST /auth/refresh` con `{ refresh_token: <válido> }`
- **THEN** el servicio responde `200` con `{ access_token, exp }`. Si el refresh es inválido o expiró, responde `401`.

### Requirement: Rate limit on auth endpoints

El servicio MUST aplicar rate limit por IP al callback de OAuth y al endpoint que inicia el redirect.

| Endpoint | Límite | Ventana |
| --- | --- | --- |
| `GET /auth/google` | 5 req | 60s por IP |
| `GET /auth/google/callback` | 10 req | 60s por IP |

#### Scenario: exceeding limit
- **WHEN** una IP hace más requests que el límite dentro de la ventana
- **THEN** el servicio responde `429 Too Many Requests` con header `Retry-After: <segundos restantes>`

#### Scenario: within limit
- **WHEN** una IP está dentro del límite
- **THEN** el servicio procesa el request normalmente

### Requirement: Rate limit on sync push

El servicio MUST aplicar rate limit por usuario autenticado a `POST /api/sync`.

| Endpoint | Límite | Ventana |
| --- | --- | --- |
| `POST /api/sync` | 30 req | 60s por `sub` del JWT |

#### Scenario: exceeding push limit
- **WHEN** un usuario autenticado hace más de 30 POST a `/api/sync` en 60s
- **THEN** el servicio responde `429` con `Retry-After`

#### Scenario: pull is not rate limited
- **WHEN** un usuario autenticado hace `GET /api/sync`
- **THEN** el servicio no aplica rate limit (los reads no cuentan)

### Requirement: Rate limit storage uses Cloudflare KV

El middleware de rate limit MUST usar el binding `RATE_LIMIT` (Cloudflare KV) para almacenar contadores. Las keys tienen la forma `rl:<route>:<scope>:<id>` con `expirationTtl` igual a la ventana.

#### Scenario: first request in window
- **WHEN** llega el primer request a una key
- **THEN** el middleware hace `put(key, "1", { expirationTtl: windowSec })` y permite pasar

#### Scenario: subsequent requests under limit
- **WHEN** el contador actual es `< limit`
- **THEN** el middleware hace `put(key, String(n+1), { expirationTtl: windowSec })` y permite pasar

#### Scenario: over limit
- **WHEN** el contador actual es `≥ limit`
- **THEN** el middleware responde `429` con `Retry-After` igual al TTL restante de la key (o `windowSec` si no se puede leer)

## MODIFIED Requirements

### Requirement: OAuth callback returns access and refresh tokens

Modifica `api-security/OAuth state is validated on callback`. El callback de OAuth MUST emitir dos tokens en el fragment del redirect.

#### Scenario: callback success
- **WHEN** el callback valida state, exchange, y profile
- **THEN** el redirect a `WEB_URL/auth/callback` tiene hash `#access=<jwt>&refresh=<jwt>&exp=<unix>`

#### Scenario: callback error
- **WHEN** el callback falla por state inválido, exchange, o `email_verified=false`
- **THEN** el servicio responde `400` con un mensaje genérico (sin tokens)

### Requirement: Web client stores both tokens

Modifica `task-sync/Client contract`. El cliente web MUST guardar access y refresh en `localStorage` con keys distintas (`caleta.access`, `caleta.refresh`).

#### Scenario: tokens persisted
- **WHEN** el callback recibe `access` y `refresh` del hash
- **THEN** ambos se guardan en `localStorage`. `caleta.exp` también.

#### Scenario: silent refresh on X-Refresh-Token
- **WHEN** una response autenticada incluye `X-Refresh-Token`
- **THEN** el cliente actualiza `caleta.access` y `caleta.exp` silenciosamente

#### Scenario: 401 retry with refresh
- **WHEN** una request autenticada falla con `401` y hay `caleta.refresh`
- **THEN** el cliente hace `POST /auth/refresh` una vez, actualiza `caleta.access`, y reintenta el request original

## Infra Requirements

### Requirement: KV namespace for rate limit

El recurso `cloudflare_workers_kv_namespace` `caleta_ratelimit` MUST existir y estar bindeado al worker de la API como `RATE_LIMIT`.

#### Scenario: terraform plan shows the namespace
- **WHEN** se aplica Terraform
- **THEN** existe un recurso `cloudflare_workers_kv_namespace.caleta_ratelimit` y el worker API lo declara como binding `RATE_LIMIT`