## 1. Backend S3-compatible en Terraform

- [ ] 1.1 En `infra/main.tf`, agregar al bloque `terraform {}` un `backend "s3" { ... }` con valores parciales. La doc del bloque dice: "los valores completos se pasan en `terraform init` via `TF_BACKEND_*` o `-backend-config`". Sólo dejar placeholders para que `terraform validate` no rompa.
- [ ] 1.2 Documentar en el bloque que las credenciales son `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` y el endpoint `TF_BACKEND_ENDPOINTS_S3`.

## 2. Makefile

- [ ] 2.1 Actualizar `infra-init`, `infra-plan`, `infra-apply` para exportar `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `TF_BACKEND_BUCKET` / `TF_BACKEND_KEY` / `TF_BACKEND_REGION` / `TF_BACKEND_ENDPOINTS_S3` / `TF_BACKEND_SKIP_CREDENTIALS_VALIDATION` / `TF_BACKEND_SKIP_REGION_VALIDATION`.
- [ ] 2.2 Agregar target `bootstrap-state` que invoca el script `infra/scripts/bootstrap-tfstate.sh`.

## 3. Bootstrap script

- [ ] 3.1 Crear `infra/scripts/bootstrap-tfstate.sh`: verifica wrangler, crea bucket `caleta-tfstate`, imprime instrucciones para el API token, y (si existe state local) corre `terraform init -migrate-state`.

## 4. CI / deploy.yml

- [ ] 4.1 Agregar secrets `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` documentados en `.env.example` y en el RUNBOOK.
- [ ] 4.2 En `.github/workflows/deploy.yml`, exportar `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `TF_BACKEND_*` para los steps de terraform.
- [ ] 4.3 Eliminar el step `Redact secrets in tfstate` y `Commit updated tfstate`.
- [ ] 4.4 Cambiar `permissions: contents: write` → `contents: read` (no necesitamos pushear nada más).

## 5. .gitignore + .env.example

- [ ] 5.1 Actualizar el comentario de `.gitignore` sobre tfstate (ya no se commitea).
- [ ] 5.2 Agregar `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` a `.env.example`.

## 6. RUNBOOK

- [ ] 6.1 Agregar sección "5.1 Bootstrap del state en R2" con los pasos: crear cuenta CF, instalar wrangler, login, correr script, crear API token, agregar a GitHub Secrets, primer apply.

## 7. Validación

- [ ] 7.1 `terraform -chdir=infra fmt -check` y `terraform -chdir=infra validate` (con `-backend=false`) pasan.
- [ ] 7.2 `npm run typecheck --workspace=apps/api` sin errores.
- [ ] 7.3 `npm run test --workspace=apps/api` pasa los 4 tests.
- [ ] 7.4 `npm run build:api` y `npm run build:web` pasan.
- [ ] 7.5 `openspec validate tfstate-r2-backend` sin errores.
- [ ] 7.6 CI verde en el PR.