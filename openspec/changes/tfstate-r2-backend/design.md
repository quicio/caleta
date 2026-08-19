## Context

El MVP está en producción y el audit inicial dejó 9+6 hallazgos críticos/altos, todos cerrados. Quedan tres pendientes menores, y el más molesto es #10: el state de Terraform se commitea al repo con secrets redactados. La redaction JSON-walk que se agregó en `security-hardening` cubre el riesgo inmediato (leak de un secret nuevo sin actualizar el script), pero el state sigue ahí: visible para cualquiera con acceso al repo, y los backups (`*.tfstate.backup`) están en `.gitignore` pero el `crash.log` no del todo.

Restricciones del entorno:

- Cloudflare R2 free tier: 10 GB storage + 1M Class A operations/mes + 10M Class B/mes. El state son ~5 KB. Sobra.
- Terraform soporta el backend S3 nativamente, y R2 expone endpoint S3-compatible.
- Auth: API tokens de R2 con scope al bucket específico. Las credenciales son `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` (estándar, no se llama "AWS" en el endpoint pero el env var name es el que espera Terraform).
- Bootstrap: el bucket se crea con `wrangler r2 bucket create` (sin credenciales de R2, usa la sesión de wrangler). El API token se crea manual en el dashboard y se pega a `.env` / GitHub Secrets.

## Goals / Non-Goals

**Goals:**
- State en R2, fuera del repo.
- Deploy desde CI sigue funcionando.
- Bootstrap de una vez documentado en el RUNBOOK.
- Sin pérdida de datos: el state actual (con redaction) se migra a R2 vía `terraform init -migrate-state`.

**Non-Goals:**
- State locking con DynamoDB (no aplica — `concurrency: deploy-main` ya serializa).
- Versionado automático del state en R2.
- Encriptación adicional (R2 ya encripta en reposo).

## Decisions

### 1. Backend S3-compatible, no `http` ni `local`

**Decisión:** usar `backend "s3"` (de `terraform`), no `backend "http"` ni mantener `local`. El endpoint S3 de R2 es lo que Terraform soporta oficialmente.

**Razón:** `s3` es el backend más maduro de Terraform y el que Cloudflare recomienda. Tiene retries, locking opcional, y maneja credenciales vía env estándar (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

**Alternativa considerada:** `backend "http"` de Terraform Cloud / custom server. Descartada: requiere mantener un servicio HTTP server-side.

### 2. Config del backend via `TF_BACKEND_*`, no `backend-config.hcl`

**Decisión:** los valores del backend (bucket, key, region, endpoint) se pasan como env vars `TF_BACKEND_BUCKET`, `TF_BACKEND_KEY`, `TF_BACKEND_REGION`, `TF_BACKEND_ENDPOINTS_S3`. Las credenciales van como `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (el estándar que espera el backend `s3`).

**Razón:** el endpoint depende del `account_id` que ya está en `.env`. Pasarlo por env evita tener un `backend-config.hcl` gitignored que se regenera en cada `make infra-init`. La sintaxis de `TF_BACKEND_*` existe desde Terraform 0.13.

**Alternativa considerada:** `terraform init -backend-config=...` flags. Funciona, pero el Makefile quedaría con líneas larguísimas; los env vars son más legibles.

### 3. Skip_credentials_validation y skip_region_validation

**Decisión:** poner `skip_credentials_validation = true` y `skip_region_validation = true` en el backend block. R2 no es AWS; el chequeo de credenciales estándar de AWS fallaría.

**Razón:** Terraform valida las credenciales contra el endpoint AWS oficial. R2 tiene un endpoint distinto. Sin estos flags, `terraform init` falla con "InvalidAccessKeyId".

### 4. Sin state locking

**Decisión:** no configurar `use_lockfile = true` ni DynamoDB. Confiar en `concurrency: deploy-main` del workflow de deploy.

**Razón:** el backend S3 en Terraform puede usar un lock file en el mismo bucket (`use_lockfile`). Pero ya serializamos con `concurrency: deploy-main` en GitHub Actions, así que no hay concurrencia que lockear. Para deploys manuales concurrentes entre devs, el lock previene corrupciones pero no es crítico para hobby.

**Alternativa considerada:** `use_lockfile = true` — descartada por simplicidad. Se puede agregar después si alguien se clava el state.

### 5. Bootstrap script separado, no en el Makefile

**Decisión:** `infra/scripts/bootstrap-tfstate.sh` separado. No target de Makefile (el target invocaría el script, pero el script es la fuente de verdad).

**Razón:** el bootstrap es de una vez. Que sea ejecutable directamente (`./infra/scripts/bootstrap-tfstate.sh`) lo hace más fácil de entender y de ejecutar paso a paso.

## Risks / Trade-offs

- **Riesgo:** si se pierden las credenciales de R2, el state también. Mitigación: backup manual ocasional (`wrangler r2 object get caleta-tfstate/caleta.tfstate --file=backup.tfstate`).
- **Riesgo:** el API token de R2 con scope al bucket, si se filtra, da acceso de read+write al state. Mitigación: scope al bucket específico (no account-level); rotar si hay leak.
- **Trade-off:** se pierde la "single source of truth" en git. La IaC sigue en `infra/main.tf`; el state es el "current state" de los recursos. Es la práctica estándar de Terraform — main.tf en git, state fuera.
- **Riesgo:** el primer `terraform init -migrate-state` puede requerir intervención si el state local tiene drift. Mitigación: documentado en el bootstrap script.