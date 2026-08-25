# Runbook — caleta

Operación día a día del servicio. Infra: Cloudflare Workers + D1, deploy vía Terraform (`infra/`).

## 1. Mapa del sistema

| Componente | Nombre | URL (con `<SUB>` = `ACCOUNT_SUBDOMAIN`) |
| --- | --- | --- |
| API (Worker Hono) | `caleta-api` | `https://caleta-api.<SUB>.workers.dev` |
| Web (SPA, static assets) | `caleta-web` | `https://caleta-web.<SUB>.workers.dev` |
| Base de datos | D1 `caleta` | — (solo vía API/wrangler) |

Flujo OAuth: `GET /auth/google` → Google → `GET /auth/google/callback` → redirect a `WEB_URL#token=...`.
JWT: HS256, issuer `caleta`, audience `caleta-web`, TTL **30 días**.

### Endpoints útiles

```
GET /healthz        → {"ok":true}
GET /               → {"name":"caleta","status":"ok"}
GET /auth/google    → redirige al consent de Google
GET /api/lists              GET/POST /api/lists/:id/tasks
PATCH/DELETE /api/tasks/:id GET /api/sync?since=<ISO8601>
```

## 2. Accesos y secretos

| Secreto | Dónde vive | Dueño |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `.env` → Worker (secret) | Google Cloud Console |
| `JWT_SECRET` | `.env` → Worker (secret) | vos |
| `CF_API_TOKEN` | `.env` (solo local) | Cloudflare (tu cuenta) |
| `CF_ACCOUNT_ID` / `ACCOUNT_SUBDOMAIN` | `.env` (solo local) | Cloudflare |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | `.env` (solo local) | Cloudflare R2 API token |
| `VITE_API_URL` | embebido en el build del web | derivado en `make build-web` |
| `WEB_URL` | `.env` → Worker (plain) | derivado en `make infra-apply` |

El **único** archivo de configuración es `.env` (gitignored). Terraform lo lee vía `TF_VAR_*`. Los secrets de Google/JWT quedan en Cloudflare como `secret_text_binding`, no en el repo.

### Consolas

- Cloudflare Dashboard → Workers & Pages → `caleta-api` / `caleta-web`
- Cloudflare Dashboard → D1 → `caleta`
- Google Cloud Console → APIs & Services → Credentials (cliente OAuth del web)

## 3. Deploy

### Primera vez (bootstrap)

```bash
make setup              # crea .env + instala deps
# editar .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET,
#   CF_API_TOKEN, CF_ACCOUNT_ID, ACCOUNT_SUBDOMAIN
make bootstrap-state    # crea bucket R2 + instrucciones para el API token
# editar .env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
make infra-init         # terraform init (con backend R2, migra state local)
# agregar a GitHub Secrets: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
make deploy
```

`make deploy` = build api + build web + `terraform apply -auto-approve`. Crea D1, worker API (bindings+secrets), corre migraciones (`wrangler d1 execute --remote`), y el worker web con los assets.

**Después del primer deploy**, agregá en Google Console el redirect URI de prod:
`https://caleta-api.<SUB>.workers.dev/auth/google/callback`

### Deploy normal

```bash
make deploy
```

Igual que el bootstrap pero sin crear nada nuevo (idempotente).

### Solo plan (sin aplicar)

```bash
make infra-plan
```

### Rollback

El código deployado es el build local. Para volver atrás:

```bash
git checkout <commit-anterior>   # o guardá el dist viejo
make deploy                      # re-build y re-apply
```

No hay forma de "desplegar versión previa" desde Cloudflare sin tener el build local — si no hay git, guardá `apps/api/dist` y `apps/web/dist` antes de deployar.

## 4. Día a día

### Health check

```bash
curl -s https://caleta-api.<SUB>.workers.dev/healthz
# {"ok":true}
```

### Logs de la API

```bash
npx wrangler tail caleta-api --remote    # stream en vivo
```

o en el dashboard: Workers & Pages → `caleta-api` → Logs → Real-time logs.

### Ver datos en D1

```bash
npx wrangler d1 execute caleta --remote --command "SELECT id,email,created_at FROM users LIMIT 10;"
npx wrangler d1 execute caleta --remote --command "SELECT count(*) AS tasks FROM tasks;"
```

## 5. Backup y restore de D1

```bash
# Exportar (esquema + datos)
npx wrangler d1 export caleta --remote --output=backup-$(date +%F).sql

# Solo datos / solo esquema
npx wrangler d1 export caleta --remote --no-schema --output=backup-data.sql

# Restaurar
npx wrangler d1 execute caleta --remote --file=backup-$(date +%F).sql

# Volver a un punto en el tiempo (restore interactivo)
npx wrangler d1 time-travel caleta --remote
# o con timestamp: wrangler d1 time-travel caleta --remote --timestamp <unix>
```

> Los comandos `wrangler d1 ... --remote` requieren `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el entorno.

## 5.1. State de Terraform en R2

El state vive en el bucket R2 `caleta-tfstate` bajo tu cuenta Cloudflare, **no** en el repo. El bucket es gratis en el free tier (10 GB / 1M ops/mes). El setup es de una vez.

### Setup inicial

1. `make setup` (si no lo hiciste) + editar `.env` con `CF_ACCOUNT_ID` y `ACCOUNT_SUBDOMAIN`.
2. `make bootstrap-state`:
   - Crea el bucket `caleta-tfstate` con `wrangler r2 bucket create`.
   - Imprime las instrucciones para crear el API token en el dashboard.
3. Crear el API token en <https://dash.cloudflare.com/?to=/:account/r2/api-tokens>:
   - Permisos: **Object Read & Write**.
   - Scope: **Specify bucket(s)** → `caleta-tfstate`.
   - TTL recomendado: 1 año.
4. Pegar `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` en `.env`.
5. Agregar las mismas dos vars como GitHub Secrets (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
6. `make infra-init` — Terraform detecta el state local (si existe) y pregunta si migra a R2. Decir `yes`.
7. `make deploy`.

### Backup del state

El state en R2 es la source of truth. Backup manual ocasional:

```bash
npx wrangler r2 object get caleta-tfstate/caleta.tfstate --file=backup-$(date +%F).tfstate
```

### Pérdida de credenciales R2

Si perdés el API token: crear uno nuevo en el dashboard, actualizar `.env` y los GitHub Secrets. El state en el bucket no se pierde (sólo cambia quién puede leerlo). Si perdés también el bucket, el state se pierde — el `infra/main.tf` queda como única fuente y hay que correr `terraform import` para cada recurso.

## 6. Rotación de secretos

### `JWT_SECRET` (invalida TODAS las sesiones)

1. `openssl rand -hex 32`
2. Pegar en `.env` (`JWT_SECRET`).
3. `make deploy` — Terraform actualiza el secret en el Worker.
4. Los usuarios con JWT viejo reciben 401 y van al login (el SPA limpia el token y redirige).

### Google OAuth (client secret)

1. Google Console → Credentials → generar nuevo secret.
2. Actualizar `GOOGLE_CLIENT_SECRET` en `.env`.
3. `make deploy`. Las sesiones (JWT) **no** se invalidan; solo el login futuro usa el secret nuevo.

### `CF_API_TOKEN`

1. Cloudflare → My Profile → API Tokens → rotar.
2. Actualizar `CF_API_TOKEN` en `.env`. Solo se usa localmente para deploy; no afecta al runtime.

### `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`

1. Cloudflare → R2 → Manage R2 API Tokens → rotar.
2. Actualizar ambas en `.env` y en GitHub Secrets. El state en el bucket no se ve afectado.

## 7. Observabilidad

Todos los logs son JSON en stdout/stderr — wrangler tail y Cloudflare Workers Logs los capturan sin config extra.

### Formato

Cada línea es un objeto JSON con shape estable:

```json
{ "ts": "2026-08-25T18:00:00.000Z", "level": "info", "msg": "http",
  "request_id": "a1b2c3...", "method": "GET", "route": "/api/lists",
  "status": 200, "duration_ms": 12, "user_id": "google-sub" }
```

Niveles: `debug` (off por default) · `info` · `warn` · `error`. Para subir detalle:

```bash
wrangler secret put CALETA_LOG_LEVEL   # valor: "debug"
```

### request_id

Cada request genera un `request_id` (16 chars hex) que se devuelve en el header `x-request-id`. Lo agrega el middleware `logger()` y se loguea en cada access log + log de error/warn — útil para cruzar logs con feedback de usuarios.

### Eventos con log estructurado

- `http` (info/warn/error): access log de cada request — uno por request.
- `auth_failed` (warn): sesión inválida en rutas protegidas.
- `rate_limit_exceeded` (warn): KV scope + route + limit.
- `oauth_callback_failed` (error): fallo en el callback de Google.
- `calendar_fetch_failed` (error): fallo al hablar con Google Calendar API.
- `unhandled` (error): cualquier 500 no esperado.

### Cómo consumir

```bash
# Local
npx wrangler tail --format=json   # JSON estructurado
npx wrangler tail --format=pretty # legible para humanos

# Filtrar por nivel / mensaje
npx wrangler tail | grep '"level":"error"'
npx wrangler tail | grep '"request_id":"a1b2c3"'
```

En producción, los logs aparecen en **Workers & Pages → caleta-api → Logs** en el dashboard de Cloudflare.

## 8. Incidentes comunes

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| Login muere con error de OAuth | Redirect URI no autorizado en Google Console | Agregar `https://caleta-api.<SUB>.workers.dev/auth/google/callback` |
| `401` apenas entrás | JWT expirado (30 días) o `JWT_SECRET` rotó | Volver a loguear; si persiste, revisar que `JWT_SECRET` en `.env` no cambió |
| La web anda pero la API no | `VITE_API_URL` embebido en el build no matchea la URL real | Re-build con `VITE_API_URL` correcto (`make build-web` usa el derivado) |
| CORS (`Access-Control-Allow-Origin` faltante) | `WEB_URL` del Worker ≠ origin de la web | Corregir `WEB_URL` en `.env` y `make deploy` |
| `Missing JWT_SECRET` al levantar | Secret no seteado en el Worker | Verificar binding en `terraform` / `wrangler.toml` |
| Sync no trae cambios | `since` con timestamp inválido | Usar ISO 8601 UTC |
| Worker en error 500 en todos los endpoints | Bug en el deploy | `wrangler tail` para ver el stack; rollback con git + `make deploy` |
| D1 da `SQLITE_BUSY`/quota | Límite free tier alcanzado | Ver sección 9 |

## 9. Cambios de schema (migraciones)

Las migraciones viven en `apps/api/migrations/`. El apply corre la que esté cableada en `infra/main.tf` (hoy: `0001_init.sql`) vía el `null_resource.d1_migrate`.

Para agregar una:

1. Crear `apps/api/migrations/0002_*.sql` (idempotente, estilo `CREATE ... IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
2. Cablearla en `infra/main.tf` (append al comando del `null_resource.d1_migrate`) y en `apps/api/package.json`/root `package.json` si querés ejecutarla manual.
3. `make deploy`.

Rollback de schema: manual — D1 no tiene rollback automático de `ALTER`. Probá en local antes: `make db-migrate-local` (usa `wrangler d1 execute --local`).

## 10. Free tier y límites

| Recurso | Límite gratis | Monitor |
| --- | --- | --- |
| Workers | 100k requests/día | Dashboard → Workers → Analytics |
| D1 | 5M reads/día, 100k writes/día, 10 GB | Dashboard → D1 → `caleta` |
| Static assets | sin cargo (incluido en Workers) | — |

Con uso personal (1 usuario, sync manual) no se acerca al límite. Si llegás, los síntomas son 500 en escrituras/lecturas y errores de D1.

## 11. Recuperación ante desastre (recrear desde cero)

1. `make setup` y llenar `.env` (si perdiste el archivo, las claves de Google/JWT son las únicas que no se regeneran solas — restáuralas del gestor de secretos o rota: sección 6).
2. `make infra-init && make deploy` — recrea D1, workers y migraciones.
3. Restaurar datos si hay backup: `npx wrangler d1 execute caleta --remote --file=backup-*.sql`.
4. Verificar: `curl https://caleta-api.<SUB>.workers.dev/healthz`.
