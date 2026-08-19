## 1. SQL injection en `getSyncSnapshot`

- [ ] 1.1 Reescribir `getSyncSnapshot` en `apps/api/src/storage/d1.ts` para que `since` se bindee como parámetro (`?2`), igual que `listLists`/`listTasksInList`. Sin interpolación de strings.
- [ ] 1.2 Crear `apps/api/test/sync-no-injection.test.ts`: mock de `D1Database` que captura `prepare(...).bind(...).all()` que llama `getSyncSnapshot` con `since = "' OR 1=1 --"` y assertea que el string crudo no aparece en la SQL final y que el bind recibe el valor original.

## 2. Validación de `state` de OAuth

- [ ] 2.1 En `apps/api/src/routes/auth.ts` `/auth/google`: generar `state` random (CSPRNG), setear cookie `caleta_oauth_state` con `Path=/auth/`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=600`, y pasar el `state` al redirect de Google.
- [ ] 2.2 En `/auth/google/callback`: leer la cookie, comparar con `state` del query; 400 si falta o no coincide; limpiar la cookie antes de seguir.
- [ ] 2.3 Mover la generación de `state` a `apps/api/src/auth/google.ts` (la sigue generando la lib, sólo cambia el contrato para que devuelva `{ url, state }` y se separe el manejo de cookie de la lib pura).
- [ ] 2.4 En `/auth/google/callback`, exigir `email_verified === true` del perfil de Google; si es `false`, responder 400. `undefined` se tolera (compatibilidad con perfiles viejos).

## 3. Headers de seguridad y errores

- [ ] 3.1 En `apps/api/src/index.ts`, añadir un middleware después del CORS que setea `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.
- [ ] 3.2 Reemplazar `c.json({ error: e.message }, 500)` del `onError` por `c.json({ error: "internal error" }, 500)` (detalle a `console.error`).
- [ ] 3.3 Idem en `apps/api/src/routes/auth.ts` para el catch del callback: usar mensajes genéricos cuando el error es del exchange (no exponer `Google token exchange failed: ...` al cliente).

## 4. Validación de longitud

- [ ] 4.1 En `apps/api/src/routes/lists.ts`: `POST /api/lists` rechaza `name.length > 120`. `PATCH` idem.
- [ ] 4.2 En `apps/api/src/routes/tasks.ts`: `validateCreateInput` rechaza `title.length > 500` y `description.length > 5000`. `PATCH` idem.
- [ ] 4.3 Mensajes de error uniformes: `"title demasiado largo (máx 500)"`.

## 5. CI / deploy

- [ ] 5.1 `.github/workflows/deploy.yml`: cambiar `persist-credentials: true` a `persist-credentials: false`.
- [ ] 5.2 `.github/workflows/deploy.yml`: añadir step `npm run typecheck --workspaces --if-present` después de `npm ci` y antes del build.
- [ ] 5.3 Adaptar el step "Commit updated tfstate" para que el push funcione sin credenciales persistentes (`git push https://x-access-token:${{ github.token }}@github.com/<owner>/<repo>.git`).

## 6. Infra

- [ ] 6.1 `infra/main.tf`: añadir `compatibility_date = "2025-08-01"` al recurso `cloudflare_workers_script.web`.

## 7. Validación

- [ ] 7.1 `node_modules/typescript/bin/tsc --noEmit --project apps/api/tsconfig.json` sin errores.
- [ ] 7.2 `node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.json` sin errores nuevos.
- [ ] 7.3 `node apps/api/test/sync-no-injection.test.mjs` (ejecutar el test ad-hoc y verificar que pasa).
- [ ] 7.4 `npm run build:api` y `npm run build:web` pasan.
- [ ] 7.5 `openspec validate security-hardening` sin errores.