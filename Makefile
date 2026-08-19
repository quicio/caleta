# Tasksync — Makefile de hobby
# Cada target delega a scripts de npm, wrangler o terraform. Pensado para ser leído en un minuto.

.PHONY: help install setup dev dev-api dev-web build build-api build-web db-migrate-local infra-init infra-plan infra-apply deploy typecheck bootstrap-state

help:
	@echo "Targets:"
	@echo "  make setup            install deps + crear .env si no existe"
	@echo "  make dev-api          levantar solo la api (wrangler dev)"
	@echo "  make dev-web          levantar solo el frontend (vite)"
	@echo "  make build            compilar api + web"
	@echo "  make db-migrate-local    crear/actualizar tablas en D1 local"
	@echo "  make infra-init       terraform init (lee .env)"
	@echo "  make infra-plan       plan de infra (lee .env)"
	@echo "  make infra-apply      apply de infra (lee .env)"
	@echo "  make bootstrap-state  setup de una vez: crea bucket R2 + instrucciones"
	@echo "  make deploy           build + terraform apply, todo en un comando"
	@echo "  make typecheck        typecheck en ambos paquetes"

install:
	npm install

setup: install
	@if [ ! -f .env ]; then cp .env.example .env && echo "[setup] .env creado (editalo con tus secretos)"; else echo "[setup] .env ya existe, OK"; fi

dev-api:
	npm run dev:api

dev-web:
	npm run dev:web

build-api:
	npm run build:api

# VITE_API_URL se embebe en el build. En prod usa el workers.dev derivado
# de ACCOUNT_SUBDOMAIN salvo que esté seteado en .env.
build-web:
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	VITE_API_URL="$${VITE_API_URL:-https://caleta-api.$${ACCOUNT_SUBDOMAIN}.workers.dev}" npm run build:web

build: build-api build-web

db-migrate-local:
	npm run db:migrate:local

# Helper: exporta todo lo necesario para terraform, incluyendo el backend
# S3-compatible contra R2. Los valores sensibles vienen de .env; el resto
# se deriva de ACCOUNT_SUBDOMAIN / CF_ACCOUNT_ID.
define tf-env
	export TF_VAR_cloudflare_api_token="$${CF_API_TOKEN}" \
	       TF_VAR_account_id="$${CF_ACCOUNT_ID}" \
	       TF_VAR_account_subdomain="$${ACCOUNT_SUBDOMAIN}" \
	       TF_VAR_google_client_id="$${GOOGLE_CLIENT_ID}" \
	       TF_VAR_google_client_secret="$${GOOGLE_CLIENT_SECRET}" \
	       TF_VAR_jwt_secret="$${JWT_SECRET}" \
	       TF_VAR_web_url="$${WEB_URL:-https://caleta-web.$${ACCOUNT_SUBDOMAIN}.workers.dev}" \
	       AWS_ACCESS_KEY_ID="$${R2_ACCESS_KEY_ID}" \
	       AWS_SECRET_ACCESS_KEY="$${R2_SECRET_ACCESS_KEY}" \
	       TF_BACKEND_BUCKET="caleta-tfstate" \
	       TF_BACKEND_KEY="caleta.tfstate" \
	       TF_BACKEND_REGION="auto" \
	       TF_BACKEND_ENDPOINTS_S3="https://$${CF_ACCOUNT_ID}.r2.cloudflarestorage.com" \
	       TF_BACKEND_SKIP_CREDENTIALS_VALIDATION="true" \
	       TF_BACKEND_SKIP_REGION_VALIDATION="true" \
	       TF_BACKEND_SKIP_REQUESTING_ACCOUNT_ID="true"
endef

# Las variables de deploy viven en .env (única fuente de verdad) y se pasan
# a terraform vía TF_VAR_*.
infra-init:
	@if [ ! -f .env ]; then (echo "[error] .env no existe — corré 'make setup' primero." && exit 1); fi
	@if [ -z "$$R2_ACCESS_KEY_ID" ] || [ -z "$$R2_SECRET_ACCESS_KEY" ]; then \
	  echo "[error] R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY no están en .env. Corré 'make bootstrap-state' primero."; \
	  exit 1; \
	fi
	@set -a; . ./.env; set +a; \
	$(call tf-env) && \
	terraform -chdir=infra init

infra-plan: build
	@test -f .env || (echo "[error] .env no existe — corré 'make setup' primero." && exit 1)
	@set -a; . ./.env; set +a; \
	$(call tf-env) && \
	terraform -chdir=infra plan

infra-apply: build
	@test -f .env || (echo "[error] .env no existe — corré 'make setup' primero." && exit 1)
	@set -a; . ./.env; set +a; \
	$(call tf-env) && \
	terraform -chdir=infra apply -auto-approve

# Setup de una vez: crea el bucket R2 para el state y migra si hay state local.
bootstrap-state:
	@./infra/scripts/bootstrap-tfstate.sh

deploy: infra-apply

typecheck:
	npm run typecheck