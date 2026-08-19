## Why

El audit inicial dejó como riesgo el hecho de que `infra/terraform.tfstate` se commitea al repo. La solución previa (`security-hardening`) reemplazó la redaction frágil (`str.replace`) por un parser JSON, pero el state sigue viviendo en git:

- Cualquier cambio en el secret set sin actualizar la lógica de redaction se filtra (defensa en profundidad, no solución).
- El state contiene la estructura completa de infra (resource IDs, computed attributes, content del worker) que cualquiera con acceso al repo puede leer.
- Los `secret_text` bindings se reemplazan con `*_REDACTED` pero los strings reales existen en algún `terraform.tfstate.backup` o `crash.log` que el `.gitignore` no cubre bien.

Solución: backend S3-compatible apuntando a un bucket R2 (`caleta-tfstate`). El state deja de estar en el árbol de código. El repo queda limpio. El CI/Makefile pasan las credenciales de R2 como `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (estándar de Terraform S3 backend) y la config del backend se pasa via `TF_BACKEND_*`.

Costo: bootstrap manual de una vez (crear bucket + API token). El bucket vive en la misma cuenta Cloudflare, gratis en free tier (R2 = 10 GB storage + 1M ops/mes, el state son ~5 KB).

## What Changes

- **`infra/main.tf`**: el bloque `terraform {}` pasa a tener un `backend "s3" { ... }` con valores parciales (bucket, key, region, endpoint). Los secretos van por env.
- **`infra/scripts/bootstrap-tfstate.sh`** (nuevo): script de una sola vez que:
  1. Verifica que `wrangler` está autenticado.
  2. Crea el bucket `caleta-tfstate` con `wrangler r2 bucket create`.
  3. Imprime las instrucciones para crear el API token en el dashboard.
  4. (Opcional) corre `terraform init -migrate-state` si detecta un state local.
- **`Makefile`**: `infra-init`, `infra-plan`, `infra-apply` exportan `TF_BACKEND_*` y `AWS_*` desde `.env`. Se agrega target `bootstrap-state`.
- **`.github/workflows/deploy.yml`**: 
  - Exporta `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` desde `secrets.R2_*`.
  - Exporta `TF_BACKEND_*` para el endpoint.
  - Elimina los steps `Redact secrets in tfstate` y `Commit updated tfstate`.
  - Cambia `permissions: contents: write` → `contents: read`.
- **`.github/workflows/ci.yml`**: el `terraform init -backend=false` queda igual (no toca backend).
- **`.gitignore`**: actualiza el comentario sobre tfstate.
- **`RUNBOOK.md`**: nueva sección "5.1 Bootstrap del state" con los pasos para el setup inicial.
- **`.env.example`**: agrega `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.

### Fuera de alcance

- Encriptación del state en reposo (R2 ya encripta en disco).
- Versionado del state (R2 no lo nativamente; lo que se hace es hacer backups con cron, fuera de alcance).
- State locking con DynamoDB (R2 no es DynamoDB; single-apply por `concurrency: deploy-main` ya basta para hobby).

## Capabilities

### New Capabilities

- `tfstate-storage`: define dónde vive el state de Terraform y cómo acceden CI y dev. Implementa la separación "código en git, state en storage separado".

## Impact

- Código afectado: 1 bloque nuevo en `main.tf`, 1 script nuevo, 3 archivos actualizados (Makefile, workflows, .gitignore), 2 docs actualizados (RUNBOOK, .env.example).
- Sin cambios en runtime, sin cambios de schema ni de API.
- Sistemas externos: nuevo bucket R2 `caleta-tfstate`, nuevo API token con scope R2.
- Riesgos operacionales: si las credenciales de R2 se pierden, el state también (mitigación: backup manual ocasional vía `wrangler r2 object get caleta-tfstate/caleta.tfstate`).