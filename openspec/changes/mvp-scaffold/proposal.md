## Why

Hoy dependo de un servicio externo de terceros para gestionar listas de pendientes a través de mis dispositivos. Como hobby quiero construir una alternativa propia, sirviéndome del free tier de Cloudflare y un subdominio del que ya dispongo. La meta de este primer cambio es **entregar un MVP andante y desplegable, no un producto completo**: lo suficiente para validar la arquitectura y la separación proveedor/storage, y dejarle al cambio futuro "completar features que falten" un terreno limpio donde evolucionar.

Este primer cambio se enfoca en conseguir tres propiedades fundacionales:

1. Un backend que viva al borde (Cloudflare Workers) con storage serverless (D1).
2. Una **abstracción de proveedor de storage** desde el primer commit: la primera implementación es `D1Provider`, pero un cambio futuro puede introducir `PostgresProvider` o `IndexedDBProvider` para los clientes sin tocar la API.
3. Un frontend Svelte 5 minimal que sincronice entre dispositivos vía login Google.

## What Changes

- Añadir un nuevo paquete `apps/api` (Cloudflare Worker) con:
  - Router HTTP (Hono).
  - Endpoints REST para `lists` y `tasks` (CRUD + listado desde marca de agua para sync incremental).
  - Autenticación Google OAuth; emite JWT firmado HS256 con claims `sub` y `email`.
  - Capa `StorageProvider` (interfaz en TypeScript) con primera implementación `D1Provider`. Migraciones SQL idempotentes para D1.
  - Middleware auth que inyecta `user` y rechaza 401 cuando el token no es válido.
- Añadir un nuevo paquete `apps/web` (Cloudflare Pages) con:
  - SPA Svelte 5 + Vite. Estado con runes (`$state`, `$derived`).
  - Flujo OAuth Google (redirect → callback → token guardado en `localStorage`).
  - Pantalla de listas y tareas con pull/push manual sobre `?since=<timestamp>`.
  - Tailwind v4 vía `@tailwindcss/vite` para no levantar PostCSS.
- Añadir workspace raíz con `pnpm workspaces` (o npm workspaces si pnpm no está disponible) y un `Makefile` con `dev`, `deploy`, `db:migrate`.
- Añadir `README.md` raíz con instrucciones de setup local y deploy, y `.env.example` con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `CF_ACCOUNT_ID`.

### Alcance del MVP — qué se entrega

- Crear/renombrar/borrar listas.
- CRUD de tareas (título, descripción, due-date opcional, completada).
- Sync incremental por dispositivo (last-modified watermark).
- Login Google.

### Fuera de alcance (próximos cambios)

- Push/Web Push, recordatorios por email, recordatorios por ubicación.
- Compartir listas entre usuarios (colaboración).
- Tags, prioridades, recurrencias, attachments.
- Tasks offline-first con resolución de conflictos.
- Modo oscuro afinado, mobile app nativo (PWA solamente).

## Capabilities

### New Capabilities

- `task-sync`: capacidad raíz que describe el comportamiento contractual del servicio: autenticación, modelo de datos (lista + tarea), reglas de sync incremental, aislamiento por usuario. La interfaz HTTP y la interfaz `StorageProvider` derivan de acá.

### Modified Capabilities

- *(ninguna — proyecto nuevo)*

## Impact

- Códigos y archivos afectados:
  - `apps/api/` (nuevo): `src/index.ts`, `src/routes/`, `src/auth/`, `src/storage/`, `migrations/`, `wrangler.toml`.
  - `apps/web/` (nuevo): `src/main.ts`, `src/lib/`, `src/routes.svelte`, `index.html`.
  - Raíz (nuevo): `package.json` con workspaces, `Makefile`, `README.md`, `.env.example`.
- Dependencias nuevas: `hono`, `wrangler`, `@google-cloud/local-auth`-equivalente o `google-auth-library` (server), `jose` para JWT, `drizzle-orm` (opcional) o SQL crudo, `svelte@5`, `vite`, `@tailwindcss/vite`.
- Sistemas externos: Cloudflare (Workers, D1, Pages, Access opcional), Google OAuth consent screen.
- Configuración: secreto `JWT_SECRET` añadido; necesitará Cloudflare account ID para deploy.
- Riesgos operacionales: ninguno (entorno dev local + opcional deploy Cloudflare).
