## 1. Bootstrap workspace

- [ ] 1.1 Crear `package.json` raíz con `workspaces: ["apps/*"]`, scripts agregados (`dev`, `build`, `deploy`, `db:migrate`).
- [ ] 1.2 Elegir package manager: `pnpm` si está disponible, si no, caer a `npm workspaces`.
- [ ] 1.3 Crear `Makefile` con targets `dev`, `deploy`, `db:migrate`, `db:migrate-local`, `setup` que sólo deleguen a npm scripts.
- [ ] 1.4 Crear `.env.example` con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `STORAGE_PROVIDER=d1`, `CF_ACCOUNT_ID`, `API_URL`, `WEB_URL`.
- [ ] 1.5 Crear `README.md` raíz: quick start, estructura del repo, deploy, troubleshooting, rotación de `JWT_SECRET`.

## 2. Backend Worker (`apps/api`)

- [ ] 2.1 Crear `apps/api/package.json` con `wrangler`, `hono`, `jose`, `typescript`, `@cloudflare/workers-types`.
- [ ] 2.2 Crear `apps/api/wrangler.toml` con `name = "tasksync-api"`, `main = "src/index.ts"`, `compatibility_date`, binding a D1 (`DB`) y vars.
- [ ] 2.3 Crear `apps/api/tsconfig.json` con modo estricto y target `esnext`.
- [ ] 2.4 Crear `apps/api/migrations/0001_init.sql` con tablas `users`, `lists`, `tasks` con índices en `user_id`, `list_id`, `updated_at`.
- [ ] 2.5 Definir `apps/api/src/storage/types.ts` con la interfaz `StorageProvider` y tipos `User`, `List`, `Task`.
- [ ] 2.6 Implementar `apps/api/src/storage/d1.ts` (`D1Provider`) leyendo todos los métodos del contrato, con cláusulas WHERE que respeten `user_id`.
- [ ] 2.7 Crear `apps/api/src/storage/index.ts` factory `getStorageProvider(env)` que decide según `STORAGE_PROVIDER`.
- [ ] 2.8 Crear `apps/api/src/auth/jwt.ts` con `signToken` y `verifyToken` (jose HS256), chequeo de `JWT_SECRET` al llamar.
- [ ] 2.9 Crear `apps/api/src/auth/google.ts` con `buildAuthRedirectUrl` y `exchangeCodeForToken`/`fetchProfile`.
- [ ] 2.10 Crear `apps/api/src/middleware/auth.ts` (Hono middleware) que lee `Authorization: Bearer`, verifica JWT, setea `c.set('user', { sub, email })`, responde 401 si falla.
- [ ] 2.11 Crear routes `apps/api/src/routes/auth.ts`: `GET /auth/google` (redirect) y `GET /auth/google/callback` (intercambia code, upsert user, emite JWT, redirige a `${WEB_URL}/auth/callback#token=...`).
- [ ] 2.12 Crear routes `apps/api/src/routes/lists.ts`: `POST /api/lists`, `GET /api/lists`, `GET /api/lists/:id`, `PATCH /api/lists/:id`, `DELETE /api/lists/:id` (soft delete).
- [ ] 2.13 Crear routes `apps/api/src/routes/tasks.ts`: `POST /api/lists/:id/tasks`, `GET /api/lists/:id/tasks?since=...`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`.
- [ ] 2.14 Crear routes `apps/api/src/routes/sync.ts`: `GET /api/sync?since=...` (responde body + header `X-Watermark`), `POST /api/sync` (bulk upsert tareas).
- [ ] 2.15 Crear `apps/api/src/index.ts` que monta Hono, monta middleware CORS para `${WEB_URL}`, las routes, y exporta el worker con `default { fetch }`.
- [ ] 2.16 Validar que `pnpm -F api run typecheck` (o `npm run -w apps/api typecheck`) pase sin errores.

## 3. Frontend SPA (`apps/web`)

- [ ] 3.1 Crear `apps/web/package.json` con `svelte@5`, `vite`, `@tailwindcss/vite`, `tailwindcss@4`, `svelte-routing`.
- [ ] 3.2 Inicializar `apps/web/index.html`, `apps/web/src/main.ts`, `apps/web/src/App.svelte`.
- [ ] 3.3 Configurar Tailwind v4 vía `@tailwindcss/vite` con `@import "tailwindcss";` en `app.css`.
- [ ] 3.4 Crear `apps/web/src/lib/api.ts`: helper con `fetchApi` que lee `VITE_API_URL` (default derivado) y agrega `Authorization: Bearer <token>`.
- [ ] 3.5 Crear `apps/web/src/lib/auth.ts`: lee JWT de `localStorage`, expone helpers `getToken`, `setToken`, `clearToken`, `isAuthenticated`.
- [ ] 3.6 Crear `apps/web/src/routes/Login.svelte`: botón "Entrar con Google" que redirige a `${API_URL}/auth/google`.
- [ ] 3.7 Crear `apps/web/src/routes/Callback.svelte` (`/auth/callback`): lee `token` de `location.hash`, lo guarda, redirige a `/`.
- [ ] 3.8 Crear `apps/web/src/routes/Lists.svelte` (`/`): lista las listas del usuario (sync inicial), botones crear/borrar, navega a `/lists/:id`.
- [ ] 3.9 Crear `apps/web/src/routes/List.svelte` (`/lists/:id`): muestra tareas, permite crear/completar/borrar.
- [ ] 3.10 Crear `apps/web/src/routes/Settings.svelte` con botón "Sync ahora" que ejecuta `GET /api/sync?since=<watermark>` y reconcilia state.
- [ ] 3.11 Crear `apps/web/wrangler.toml` con `pages_build_output_dir = "dist"` y assets config.
- [ ] 3.12 Validar `pnpm -F web run build` (o npm equivalent) que pase sin errores.

## 4. Validación local

- [ ] 4.1 Crear `apps/api/.dev.vars.example` y documentar que `wrangler dev` lo lee.
- [ ] 4.2 Documentar paso de migraciones locales: `pnpm db:migrate-local` ejecuta `wrangler d1 execute tasksync --local --file=apps/api/migrations/0001_init.sql`.
- [ ] 4.3 Levantar API local: `pnpm dev -w apps/api` → `wrangler dev` arranca en `http://127.0.0.1:8787`.
- [ ] 4.4 Levantar web local: `pnpm dev -w apps/web` → vite sirve en `5173` y proxea `/api` a la URL de la API.
- [ ] 4.5 Levantar `apps/web/vite.config.ts` con proxy `/api` → `${API_URL}`. El endpoint `/auth/google` se invoca por redirect completo, no por proxy.

## 5. Documentación y deploy

- [ ] 5.1 En `README.md`: instrucciones paso-a-paso para crear el proyecto Cloudflare (D1), crear OAuth credentials en Google Cloud Console, `wrangler deploy`, `wrangler pages deploy`, registrar el subdominio.
- [ ] 5.2 Documentar cómo hacer test manual del MVP: crear lista desde un navegador, abrir otro, sincronizar, ver que aparece.
- [ ] 5.3 Marcar `openspec validate mvp-scaffold` y capturar cualquier issue.
- [ ] 5.4 Cuando el cambio esté aplicado y verificado localmente, archivar el cambio con `openspec archive mvp-scaffold --yes`.
