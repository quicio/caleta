## Why

La auditoría inicial del MVP identificó tres riesgos críticos y varios altos/medios en seguridad y CI. Este cambio cierra los hallazgos de alto impacto y bajo costo que no requieren un rediseño mayor: **SQL injection en el snapshot de sync**, **ausencia de validación del `state` de OAuth** (login CSRF), **`persist-credentials: true` en el workflow de deploy** (token de Actions expuesto en PRs de forks), y gaps relacionados (headers de seguridad, typecheck en CI, fugas de errores, validación de longitud de input, `email_verified` de Google, paridad de `compatibility_date` entre workers).

Este cambio **no** rehace la autenticación (no migramos a cookies httpOnly), **no** introduce rate limiting (queda para un cambio futuro), **no** mueve el tfstate a backend remoto, y **no** introduce framework de tests. Las elecciones están acotadas para que cada fix sea legible en menos de 50 líneas y verificable de un vistazo.

## What Changes

- **API (`apps/api`):**
  - `storage/d1.ts`: `getSyncSnapshot` deja de interpolar `since` a SQL y lo pasa como parámetro bindeado. Misma técnica que `listLists`/`listTasksInList`.
  - `routes/auth.ts`: el callback de Google exige cookie de state y compara con el `state` del query; 400 si no coincide.
  - `auth/google.ts`: el `state` se sigue generando con CSPRNG pero ahora la ruta `/auth/google` lo deposita en una cookie httpOnly+Secure+SameSite=Lax+Path=/auth/.
  - `auth/google.ts` + `routes/auth.ts`: aceptar únicamente perfiles con `email_verified=true`; 400 si no.
  - `index.ts`: middleware que añade headers `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` y CSP estricta en responses JSON (sin recursos). `onError` ya no expone `e.message`.
  - `routes/lists.ts`, `routes/tasks.ts`: tope de longitud en `name` (≤120), `title` (≤500) y `description` (≤5000); 400 si excede.
- **CI (`.github/workflows/deploy.yml`):**
  - `persist-credentials: false` en el checkout.
  - Step de `npm run typecheck --workspaces --if-present` después de `npm ci`.
- **Infra (`infra/main.tf`):**
  - `cloudflare_workers_script.web` declara `compatibility_date = "2025-08-01"` para mantener paridad con el worker de la API.

### Fuera de alcance (cambios futuros)

- Migración de JWT en localStorage a cookie httpOnly + auth code de un solo uso.
- Refresh tokens / TTL corto de JWT.
- Rate limiting por IP/token.
- Backend remoto para tfstate + Dependabot.
- Framework de tests (Vitest, etc.); este cambio deja un único test ad-hoc como guarda de la inyección (#1).
- CSP en el HTML del web (meta tag o header del Worker de assets).

## Capabilities

### New Capabilities

- `api-security`: endurezco transversal de la API y del CI. Cubre SQL injection en sync, validación de OAuth state, headers de seguridad, longitud de input, typecheck en CI, y secretos en checkout de Actions.

### Modified Capabilities

- `task-sync` (modifica):
  - El snapshot de sync pasa a bindear `since` como parámetro en vez de interpolarlo; el comportamiento observable desde el cliente es idéntico.
  - El callback de OAuth exige un `state` válido contra una cookie server-side; el comportamiento observable del login legítimo es idéntico (Google sigue rechazando `state` ausente).
  - Se rechazan perfiles de Google sin `email_verified=true`.

## Impact

- Código y archivos afectados:
  - `apps/api/src/storage/d1.ts`
  - `apps/api/src/auth/google.ts`
  - `apps/api/src/routes/auth.ts`
  - `apps/api/src/routes/lists.ts`
  - `apps/api/src/routes/tasks.ts`
  - `apps/api/src/index.ts`
  - `apps/api/test/sync-no-injection.test.ts` (nuevo, único test ad-hoc)
  - `.github/workflows/deploy.yml`
  - `infra/main.tf`
- Sin nuevas dependencias runtime. Sin cambios en schema de DB.
- Sistemas externos: Google OAuth (sin cambios contractuales; el redirect URI y los scopes siguen iguales).
- Riesgos operacionales: si Google deja de devolver `email_verified` (cambio improbable), el login cae para todos — mitigable ignorando el campo si no viene (decisión a tomar si ocurre).