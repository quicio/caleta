## Purpose

Define dónde vive el state de Terraform y cómo acceden los distintos actores (CI, dev local) sin filtrarlo al repositorio de código. La implementación MUST separar el código declarativo (`infra/main.tf`, commiteado) del state (en un bucket R2 dedicado, no commiteado).

## ADDED Requirements

### Requirement: Terraform state lives in Cloudflare R2

El state de Terraform MUST almacenarse en el bucket R2 `caleta-tfstate` bajo la cuenta del proyecto. El archivo en el repo se llama `infra/terraform.tfstate` y NO se commitea.

#### Scenario: terraform init
- **WHEN** se corre `terraform -chdir=infra init` con `TF_BACKEND_BUCKET=caleta-tfstate` y `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` configurados
- **THEN** Terraform configura el backend S3 apuntando a R2 y no falla con errores de credenciales o región.

#### Scenario: repo does not contain state
- **WHEN** se hace `git status` después de un `terraform apply`
- **THEN** `infra/terraform.tfstate` aparece en `git status` como untracked (no commiteado).

#### Scenario: local migration
- **WHEN** se corre el script `bootstrap-tfstate.sh` y existe un state local previo
- **THEN** el script corre `terraform init -migrate-state` y mueve el state a R2 sin pérdida de datos.

### Requirement: Backend config uses R2 endpoint with S3 compatibility

El bloque `backend "s3"` en `infra/main.tf` MUST estar declarado con `skip_credentials_validation = true` y `skip_region_validation = true` para que Terraform no rechace las credenciales de R2 (no son AWS reales).

#### Scenario: R2 endpoint
- **WHEN** se inicializa el backend
- **THEN** el endpoint es `https://<account_id>.r2.cloudflarestorage.com` pasado via `TF_BACKEND_ENDPOINTS_S3`.

### Requirement: CI passes R2 credentials without persisting them

El workflow de deploy MUST pasar las credenciales de R2 al comando terraform via env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `TF_BACKEND_*`). El repo NO debe contener las credenciales; vienen de GitHub Secrets.

#### Scenario: deploy job
- **WHEN** el job `deploy` corre en GitHub Actions
- **THEN** los steps de terraform reciben los env vars correctos desde `secrets.R2_*`.

#### Scenario: permissions
- **WHEN** se ejecuta el workflow
- **THEN** `permissions.contents` es `read` (no `write`) — ya no hay push de tfstate.

### Requirement: One-time bootstrap is documented and scripted

El archivo `infra/scripts/bootstrap-tfstate.sh` MUST existir y ser ejecutable. Crea el bucket, imprime las instrucciones para crear el API token, y opcionalmente migra el state.

#### Scenario: fresh setup
- **WHEN** el dev corre `./infra/scripts/bootstrap-tfstate.sh` por primera vez
- **THEN** el bucket `caleta-tfstate` existe y el script imprime las instrucciones del API token.

#### Scenario: subsequent runs
- **WHEN** el dev corre el script de nuevo
- **THEN** el script detecta que el bucket ya existe y solo imprime las instrucciones de credenciales.

## MODIFIED Requirements

### Requirement: No more tfstate commit

Modifica `api-security/CI Requirements: Deploy workflow does not persist credentials`. El workflow de deploy MUST NO commitear `infra/terraform.tfstate` después de un apply.

#### Scenario: deploy after apply
- **WHEN** `terraform apply` termina exitosamente
- **THEN** el workflow no ejecuta `git add` ni `git commit` sobre el state. No hay push adicional.

#### Scenario: no `Redact secrets in tfstate` step
- **WHEN** se mira el workflow de deploy
- **THEN** no existe step de redaction. No hay Python redaction script en el repo.