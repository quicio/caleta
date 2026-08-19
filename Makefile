# Tasksync — Makefile de hobby
# Cada target delega a scripts de npm, wrangler o terraform. Pensado para ser leído en un minuto.

.PHONY: help install setup dev dev-api dev-web build build-api build-web db-migrate-local infra-init infra-plan infra-apply deploy typecheck

help:
	@echo "Targets:"
	@echo "  make setup          install deps + crear .env si no existe"
	@echo "  make dev-api        levantar solo la api (wrangler dev)"
	@echo "  make dev-web        levantar solo el frontend (vite)"
	@echo "  make build          compilar api + web"
	@echo "  make db-migrate-local   crear/actualizar tablas en D1 local"
	@echo "  make infra-init     terraform init (una vez)"
	@echo "  make infra-plan     plan de infra (lee .env)"
	@echo "  make infra-apply    apply de infra (lee .env)"
	@echo "  make deploy         build + terraform apply, todo en un comando"
	@echo "  make typecheck      typecheck en ambos paquetes"

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

# Las variables de deploy viven en .env (única fuente de verdad) y se pasan
# a terraform vía TF_VAR_*.
infra-init:
	terraform -chdir=infra init

infra-plan: build
	@test -f .env || (echo "[error] .env no existe — corré 'make setup' primero." && exit 1)
	@set -a; . ./.env; set +a; \
	export TF_VAR_cloudflare_api_token="$${CF_API_TOKEN}" \
	       TF_VAR_account_id="$${CF_ACCOUNT_ID}" \
	       TF_VAR_account_subdomain="$${ACCOUNT_SUBDOMAIN}" \
	       TF_VAR_google_client_id="$${GOOGLE_CLIENT_ID}" \
	       TF_VAR_google_client_secret="$${GOOGLE_CLIENT_SECRET}" \
	       TF_VAR_jwt_secret="$${JWT_SECRET}" \
	       TF_VAR_web_url="$${WEB_URL:-https://caleta-web.$${ACCOUNT_SUBDOMAIN}.workers.dev}" && \
	terraform -chdir=infra plan

infra-apply: build
	@test -f .env || (echo "[error] .env no existe — corré 'make setup' primero." && exit 1)
	@set -a; . ./.env; set +a; \
	export TF_VAR_cloudflare_api_token="$${CF_API_TOKEN}" \
	       TF_VAR_account_id="$${CF_ACCOUNT_ID}" \
	       TF_VAR_account_subdomain="$${ACCOUNT_SUBDOMAIN}" \
	       TF_VAR_google_client_id="$${GOOGLE_CLIENT_ID}" \
	       TF_VAR_google_client_secret="$${GOOGLE_CLIENT_SECRET}" \
	       TF_VAR_jwt_secret="$${JWT_SECRET}" \
	       TF_VAR_web_url="$${WEB_URL:-https://caleta-web.$${ACCOUNT_SUBDOMAIN}.workers.dev}" && \
	terraform -chdir=infra apply -auto-approve

deploy: infra-apply

typecheck:
	npm run typecheck
