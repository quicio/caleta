# caleta

Lista de pendientes **casera**, multi-dispositivo, corriendo sobre el free tier de Cloudflare (Workers + D1). Construida como hobby, con abstracción de storage para no quedarnos atados a Cloudflare mañana.

## Características

- Login Google (no guardamos passwords).
- Varias listas por usuario.
- CRUD de tareas (título, descripción, fecha de vencimiento opcional, completar).
- Sync incremental por dispositivo (`?since=<iso8601>` + header `X-Watermark`).
- Soft delete — los cambios se propagan entre dispositivos sin perder historia.
- API y UI separadas; el storage vive detrás de una interfaz `StorageProvider`.

## Stack

| Capa | Tecnología |
| --- | --- |
| API | Cloudflare Workers + Hono |
| DB | Cloudflare D1 (SQLite en edge) |
| Auth | Google OIDC → JWT HS256 |
| Frontend | Svelte 5 + Vite + Tailwind v4 |
| Deploy | Terraform (`infra/`) + wrangler (dev/migraciones) |

## Estructura del repo

```
.
├── apps/
│   ├── api/        # Worker (Hono) - endpoints REST
│   └── web/        # SPA Svelte 5 (static assets en un Worker)
├── infra/          # Terraform (D1, Workers, custom domains)
├── openspec/       # Specs y cambios (OpenSpec)
└── Makefile
```

## Quick start

### 1. Prerrequisitos

- Node >= 20
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5 (u OpenTofu)
- Cloudflare account (gratis)
- Google Cloud project — OAuth credentials (Web application client)

Configura los redirect URIs autorizados:
- Dev: `http://127.0.0.1:8787/auth/google/callback`
- Prod: `https://caleta-api.<tu-subdominio>.workers.dev/auth/google/callback` (o tu dominio custom)

### 2. Setup

```bash
make setup         # crea .env desde .env.example e instala deps
```

Editá `.env` con:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET` (cualquier string largo random; podés usar `openssl rand -hex 32`)
- `CF_API_TOKEN` — token de Cloudflare con permisos Workers Scripts:Edit, D1:Edit, Zone:Edit
- `CF_ACCOUNT_ID` — de tu dashboard (Workers → Overview)
- `ACCOUNT_SUBDOMAIN` — subdominio único de tu cuenta (ej: `hugo` si tu workers.dev es `hugo.workers.dev`)

El deploy es "un solo comando": `.env` es la única fuente de verdad, `make deploy` buildea y aplica Terraform.

### 3. Migración local + dev

```bash
make db-migrate-local
# en otra terminal:
make dev-api
# en otra terminal:
make dev-web
```

Abrí `http://localhost:5173`.

### 4. Sync entre dispositivos

Login con Google en dos navegadores diferentes. Creas una tarea en uno, click en "Sync ahora" en el otro — debería aparecer.

## Deploy

Toda la infra vive en `infra/` (Terraform): D1, Worker de la API (con secrets) y Worker del web con static assets. No hace falta tocar el dashboard.

```bash
make infra-init     # una vez, descarga los providers
make deploy         # build api + web, crea/actualiza todo y corre las migraciones
```

`make deploy` equivale a:

```bash
make build          # compila apps/api y apps/web
terraform -chdir=infra apply -auto-approve
```

Terraform crea:
- `cloudflare_d1_database` (nombre `caleta`).
- `cloudflare_workers_script` `caleta-api` con binding D1, vars `STORAGE_PROVIDER`/`WEB_URL` y secrets de Google/JWT.
- `null_resource` que corre `wrangler d1 execute ... --remote` con las migraciones.
- `cloudflare_workers_script` `caleta-web` con los **static assets** de `apps/web/dist` (SPA con `not_found_handling = single-page-application`).

Las URLs finales se muestran con `terraform -chdir=infra output` (o `make deploy` las imprime al final).

### Dominio custom (opcional)

Por defecto se usan `caleta-api.<sub>.workers.dev` y `caleta-web.<sub>.workers.dev`. Para usar un dominio propio, exportá variables extra al aplicar:

```bash
export TF_VAR_api_custom_hostname="api.tudominio.com"
export TF_VAR_web_custom_hostname="app.tudominio.com"
export TF_VAR_zone_id="<zone_id de tu zona en Cloudflare>"
```

Terraform crea los custom domains y los registros CNAME. En Google OAuth, el redirect URI de prod debe apuntar al hostname custom de la API.

## Rotación de `JWT_SECRET`

Si rotás `JWT_SECRET`, **todas las sesiones se invalidan** (los usuarios deben volver a loguearse). Procedimiento:

1. Generar nuevo valor: `openssl rand -hex 32`
2. Actualizar `JWT_SECRET` en el `.env` (y rotar en Google si correspondiera).
3. `make deploy` — Terraform actualiza el secret en el Worker.
4. Los usuarios que tenían JWTs viejos serán rechazados por el middleware (`auth.ts`) con 401, y serán redirigidos al login.

## Troubleshooting

> Para operación, backup/restore, rotación de secretos e incidentes, ver **[RUNBOOK.md](RUNBOOK.md)**.

| Síntoma | Causa probable |
| --- | --- |
| `Missing JWT_SECRET` al levantar | Definí `JWT_SECRET` en `.env` o vía `wrangler secret put JWT_SECRET` |
| `401` apenas entras a la app | El JWT expiró (30 días) o el secret en `apps/api/.dev.vars` cambió |
| Sync no trae cambios recientes | El parámetro `since` del query tiene un timestamp inválido; usá ISO 8601 |
| `wrangler d1 execute` falla | La database no está asociada al Worker en `wrangler.toml` |
| `terraform` no encuentra los providers | Corré `make infra-init` |
| `Invalid account ID` en apply | Revisá `CF_ACCOUNT_ID` en `.env` |
| `El web sirve pero la API no` | El `VITE_API_URL` embebido en el build no matchea la URL final del Worker |

## Convenciones

- SQL: `snake_case`, columnas con timestamps ISO 8601 UTC.
- JS/TS: `camelCase` para funciones y props, `PascalCase` para tipos.
- Archivos: kebab-case en rutas URL; snake_case para `.sql`; kebab-case para `.ts`/`.svelte`.

## Licencia

Privado, hobby sin licencia pública explícita.
