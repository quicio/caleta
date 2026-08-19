## Purpose

Endurecimiento transversal de la API de caleta y del pipeline de CI. Cubre riesgos que la auditoría inicial dejó como críticos o altos (SQL injection, OAuth sin `state`, persistencia de credenciales de GitHub Actions) y gaps de robustez (headers de seguridad, longitud de input, typecheck en CI, validación de email verificado). Las reglas viven como contrato: una implementación que rompa cualquiera de estos requisitos debe romper su typecheck o su test ad-hoc.

## ADDED Requirements

### Requirement: OAuth state is validated on callback

El servicio SHALL emita un `state` aleatorio en cada redirect a Google y SHALL lo persista en una cookie de corta vida. El callback SHALL comparar el `state` del query con el de la cookie y SHALL rechazar con `400 Bad Request` si falta o no coincide.

#### Scenario: state cookie missing
- **WHEN** llega `GET /auth/google/callback` con `code` y `state` pero sin cookie `caleta_oauth_state`
- **THEN** el servicio responde `400` sin hacer el exchange con Google

#### Scenario: state cookie mismatched
- **WHEN** llega `GET /auth/google/callback` con `code` y un `state` que no coincide con la cookie `caleta_oauth_state`
- **THEN** el servicio responde `400` sin hacer el exchange con Google

#### Scenario: state cookie matches
- **WHEN** llega `GET /auth/google/callback` con `code`, `state` y la cookie `caleta_oauth_state` coincide
- **THEN** el servicio procede con el exchange, setea el JWT, y borra la cookie

#### Scenario: state cookie has Secure, HttpOnly, SameSite=Lax, Path=/auth/
- **WHEN** el servicio setea la cookie `caleta_oauth_state`
- **THEN** la respuesta incluye `Set-Cookie: caleta_oauth_state=<value>; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`

### Requirement: Sync snapshot binds the `since` parameter

El parámetro `since` del snapshot de sync MUST pasarse siempre como parámetro bindeado a la consulta SQL. Ningún valor controlado por el cliente SHALL interpolarse en una cláusula SQL.

#### Scenario: since parameter is bound
- **WHEN** un cliente pide `GET /api/sync?since=<valor>`
- **THEN** la SQL preparada para `lists` y `tasks` incluye un placeholder (`?2`) y el valor se pasa vía `bind()`. El valor nunca aparece como literal dentro de la SQL.

#### Scenario: injection payload stays a literal
- **WHEN** `since` contiene `'; DROP TABLE lists; --` o cualquier otro patrón
- **THEN** la query trata el valor como string literal (la comparación `updated_at > '...'` falla silenciosamente) y no se interpreta como SQL ejecutable.

### Requirement: Sync snapshot tolerates malformed `since`

El servicio MUST tolerar un `since` malformado tratándolo como ausente.

#### Scenario: invalid `since` does not throw
- **WHEN** `since` no es ISO 8601 o no es un string
- **THEN** el servicio trata el parámetro como ausente y devuelve todas las filas no-borradas del usuario con watermark `now()`.

## MODIFIED Requirements

### Requirement: User upsert requires `email_verified`

Modifica `task-sync/User upsert`. El perfil de Google MUST tener `email_verified === true` para que el callback proceda. Si es `false`, el callback de OAuth SHALL devolver `400 Bad Request` sin crear la fila `users`. Si la propiedad viene `undefined` (perfiles legacy), MUST aceptarse sin romper.

#### Scenario: email_verified=false
- **WHEN** Google devuelve un perfil con `email_verified: false`
- **THEN** el callback responde `400` con mensaje genérico y no llama a `provider.upsertUser`.

#### Scenario: email_verified=true
- **WHEN** Google devuelve un perfil con `email_verified: true`
- **THEN** el callback llama a `provider.upsertUser` y emite el JWT como hoy.

### Requirement: API responses carry baseline security headers

Modifica `task-sync/API contract`. Toda response JSON MUST llevar `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` y `Content-Security-Policy` (default-src 'none'; frame-ancestors 'none').

#### Scenario: any endpoint returns the headers
- **WHEN** un cliente pide cualquier endpoint (`/healthz`, `/api/lists`, etc.)
- **THEN** la response incluye los cuatro headers independientemente del status code.

### Requirement: API errors do not leak internals

Modifica `task-sync/API contract`. El handler de errores global y los catches específicos SHALL devolver mensajes genéricos. Los detalles MUST loggearse en consola (`console.error`) y SHALL nunca aparecer en el body.

#### Scenario: thrown error in handler
- **WHEN** un handler lanza una excepción (D1, jose, etc.)
- **THEN** el cliente recibe `{ "error": "internal error" }` con status 500. El stack y mensaje original no aparecen en el body.

### Requirement: Input length caps

Modifica `task-sync/Task CRUD with Required Fields` y `task-sync/Users have Lists, Lists have Tasks`. El servicio MUST rechazar con `400` cualquier input que exceda los topes.

| Campo | Tope |
| --- | --- |
| `name` (list) | 120 caracteres |
| `title` (task) | 500 caracteres |
| `description` (task) | 5000 caracteres |

#### Scenario: title exceeds cap
- **WHEN** un cliente manda `title` con más de 500 caracteres
- **THEN** el servicio responde `400` con `"title demasiado largo (máx 500)"`.

#### Scenario: name exceeds cap
- **WHEN** un cliente manda `name` con más de 120 caracteres
- **THEN** el servicio responde `400` con `"name demasiado largo (máx 120)"`.

## CI Requirements

### Requirement: Deploy workflow does not persist credentials

El workflow `.github/workflows/deploy.yml` MUST hacer checkout con `persist-credentials: false`. El push del tfstate MUST usar el `${{ github.token }}` directamente como helper de credenciales inline (sin persistir token en `.git/config`).

#### Scenario: checkout step
- **WHEN** se ejecuta el job `deploy`
- **THEN** el step `Checkout` tiene `persist-credentials: false`. No queda token del runner en `.git/config`.

### Requirement: Deploy workflow runs typecheck

El workflow MUST ejecutar `npm run typecheck --workspaces --if-present` después de `npm ci` y antes de cualquier build. Si falla, el job SHALL fallar.

#### Scenario: typecheck step runs
- **WHEN** se ejecuta el job `deploy`
- **THEN** hay un step `Typecheck` que invoca el script de npm mencionado. Un error de TypeScript falla el job.

## Infra Requirements

### Requirement: Both workers pin the same `compatibility_date`

El recurso `cloudflare_workers_script.web` MUST declarar `compatibility_date = "2025-08-01"`, igual que el worker de la API.

#### Scenario: web worker compatibility_date set
- **WHEN** se aplica el Terraform
- **THEN** ambos workers (`caleta-api` y `caleta-web`) tienen el mismo `compatibility_date`.