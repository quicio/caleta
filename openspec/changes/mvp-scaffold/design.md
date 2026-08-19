## Context

Proyecto nuevo. La propuesta del cambio actual establece la motivación y el alcance. Aquí se documentan las decisiones técnicas concretas.

**Restricciones del entorno:**
- Workspace se aloja en un directorio local plano; sin CI en este cambio. Deploy a Cloudflare es manual (`pnpm -F api exec wrangler deploy`, `pnpm -F web exec wrangler pages deploy dist`).
- El ambiente local corre Node 26 + npm 11; verificamos si `pnpm` está disponible antes de adoptarlo como package manager; si no, caemos a `npm workspaces`.
- Variables de entorno necesarias: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `STORAGE_PROVIDER` (`d1` por defecto).

**Restricciones del producto:**
- Multi-dispositivo vía pull/push manual; sin conectividad persistente real-time. Esto descarta la necesidad de WebSockets/Durable Objects en el MVP.
- Login es OAuth Google, una sola identidad por usuario. No hay password, no hay teams, no hay sharing.

## Goals / Non-Goals

**Goals:**
- Un Worker HTTP autocontenido con cuatro endpoints (`/auth/google`, `/auth/google/callback`, `/api/lists/*`, `/api/sync`).
- `StorageProvider` como interfaz puramente TypeScript, sin filtrarse a capas de transporte; `D1Provider` como única implementación funcional hoy.
- D1 con migraciones idempotentes y un script `db:migrate` que aplique vía `wrangler d1 execute`.
- App Svelte 5 en `apps/web` con login redirect, página de listas, página de tareas, sync manual.
- Tailwind v4 sin pipeline PostCSS pesado; build rápido.

**Non-Goals:**
- WebSockets o push.
- Offline-first con CRDTs.
- Tests automatizados exhaustivos (algunos unitarios del provider están bien; coverage alto no es parte del MVP).
- Observabilidad/metrics (el free tier de CF tiene logs básicos, suficientes para hobby).
- Internacionalización. UI en español; copy en español aceptable.

## Decisions

### 1. Backend: Hono sobre Cloudflare Workers

**Decisión:** usar [Hono](https://hono.dev) en lugar de itty-router o escribir el router a mano.

**Razón:** Hono da un router idiomático, middleware composition (perfecto para auth), y context typing fuerte con TypeScript. Existe adaptador específico de Cloudflare Workers; ~6kB de bundle. itty-router es más liviano pero menos DX. Workers sin framework escribe a mano repetiría demasiado middleware.

**Alternativa considerada:** `itty-router` — descartada por DX; el router a mano — descartada por riesgo de bugs en middleware.

### 2. Storage: D1 con SQL crudo, sin ORM

**Decisión:** usar D1 directamente con `D1Database` del binding y SQL crudo parametrizado (`db.prepare(...).bind(...)`).

**Razón:** D1 es SQLite en edge; un ORM no aporta abstracción que necesitemos (no hay migraciones entre múltiples DBs, no hay queries complicadas). SQL crudo es más explícito, más performante, y hace que `D1Provider` sea casi una traducción literal de la interfaz.

**Alternativa considerada:** Drizzle ORM — buena, pero introduce dependencia y la abstracción que aporta se solapa con la abstracción que `StorageProvider` ya da. Otro proveedor (futuro Postgres) requeriría queries específicas de Drizzle con un dialecto.

### 3. Autenticación: Google OIDC redirect → JWT HS256

**Decisión:** el frontend hace redirect a Google, Google devuelve al callback del Worker (no del cliente), el Worker intercambia el code por tokens, emite un JWT HS256 firmado con `JWT_SECRET` (env), y lo devuelve al frontend en una URL fragment para que el SPA lo capture.

**Razón:** HS256 es suficiente porque el cliente nunca necesita verificar el token — sólo lo presenta en headers. RS256 añadiría fricción operativa (gestión de claves). El redirect fragment (`#token=...`) evita que el JWT pase al servidor del frontend vía HTTP history.

**Alternativa considerada:** JWT en cookie HttpOnly — descartada porque complica el ciclo entre SPA y API en dominios distintos (Cloudflare Pages suele servir en un subdominio del Worker o al revés).

### 4. Frontend: Svelte 5 + Vite sin SvelteKit

**Decisión:** SPA pura con Svelte 5 + Vite + svelte-routing (no SvelteKit).

**Razón:** SvelteKit añade SSR, loaders, server endpoints — innecesario dado que el API es un Worker separado. Una SPA simple comunica via fetch. Reduce superficie y dependencias.

**Alternativa considerada:** SvelteKit con adapters — descartada para evitar SSR en MVP (no aporta valor real aquí).

### 5. Tailwind v4 vía `@tailwindcss/vite`

**Decisión:** usar Tailwind v4 con el plugin de Vite (no PostCSS pipeline tradicional).

**Razón:** setup más limpio (un plugin en `vite.config.ts`); build más rápido. Tailwind v4 ya tiene el motor de Vite nativo.

### 6. Watermark como header HTTP

**Decisión:** el watermark va en `X-Watermark` response header, no en el body.

**Razón:** algunos clientes sólo quieren saber "qué pasó después de X" sin parsear body. El header les permite comparar `if-modified-since`-style. El body sigue conteniendo los datos para los clientes que sí los necesitan.

### 7. Soft delete para tasks

**Decisión:** `deleted_at` (timestamp ISO8601) en `tasks`. Nunca se borra físicamente en el MVP.

**Razón:** el sync incremental necesita ver deletes de un dispositivo en otro; si se borra físicamente, el dispositivo B nunca se entera. Soft delete es la forma estándar.

### 8. UUIDv7 para ids generadas en cliente

**Decisión:** cuando un cliente crea una task offline, genera el `id` con UUIDv7. Si está online, el Worker acepta el id del cliente y lo inserta; sólo asigna id cuando no viene.

**Razón:** ordenabilidad temporal ayuda a futuro si hay resolución de conflictos. UUIDv7 es 2025 y no requiere dependencias raras.

### 9. Sin `OfflineSyncProvider` hoy

**Decisión:** el MVP sólo incluye `D1Provider`. La spec del StorageProvider está modelada para que añadir `PostgresProvider` o `IndexedDBProvider` sea trivial, pero **no construimos IndexedDBProvider ahora**: la SPA es online-only (f5 y se cae el local cache), el offline es un cambio futuro.

**Razón:** la abstracción igual vale con un solo implementation concreta; el spec protege el contrato. Saltar a IndexedDBProvider dilataría el MVP.

## Risks / Trade-offs

- **Riesgo:** JWT HS256 con secreto compartido exige rotar `JWT_SECRET` con cuidado (invalida todas las sesiones). Mitigación: documentar el procedimiento de rotación en `README.md` y considerar pasar a RS256 en un cambio posterior si lo necesitamos.
- **Riesgo:** Cloudflare Workers free tier limita a 100k requests/día. Para hobby sobra; si lo usamos mucho (con auto-sync cada 30s), consume rápido. Mitigación: sync manual por ahora; considerar poller con backoff más adelante.
- **Riesgo:** D1 free tier son 5GB de almacenamiento. Si los soft-deletes acumulan, eventualmente puede llenar. Mitigación: aceptar que habrá un cron de purga en un cambio futuro; documentar la necesidad.
- **Riesgo:** Sync incremental sin conflict resolution puede perder updates offline-then-online. Mitigación: actualizar entidad por `id` con last-write-wins en `updated_at`. Conflictos concurrentes sin timestamps separados se resuelven por orden de llegada; documentar esta limitación.
- **Trade-off:** SPA sin SSR significa SEO irrelevante (correcto) pero first-paint lento en móvil. Aceptable para hobby; una PWA con service-worker puede cerrarlo luego.
- **Trade-off:** usar SQL crudo en vez de ORM cuesta un poco más de escribir queries, pero hace la abstracción `StorageProvider` legible y testeable a mano.
