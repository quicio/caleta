#!/usr/bin/env bash
# Bootstrap del state de Terraform en R2 — correr UNA vez.
# Crea el bucket, imprime instrucciones para el API token, y migra el state
# local si existe.

set -euo pipefail

BUCKET="${TF_STATE_BUCKET:-caleta-tfstate}"
KEY="${TF_STATE_KEY:-caleta.tfstate}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

echo "==> caleta — bootstrap del state de Terraform en R2"
echo

# 1. Verificar wrangler
if ! command -v wrangler >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: ni 'wrangler' ni 'npx' están en PATH. Instalá Node 20+ primero."
  exit 1
fi

WRANGLER="wrangler"
command -v wrangler >/dev/null 2>&1 || WRANGLER="npx wrangler"

# 2. Verificar login
echo "1) Verificando sesión de wrangler..."
if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "   No estás logueado. Corré: $WRANGLER login"
  exit 1
fi
ACCOUNT_ID="$($WRANGLER whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -n1 || true)"
if [ -z "$ACCOUNT_ID" ]; then
  echo "   No pude detectar el account_id. Asegurate de que CF_ACCOUNT_ID esté en .env"
  exit 1
fi
echo "   account_id: $ACCOUNT_ID"

# 3. Crear bucket (idempotente)
echo
echo "2) Creando bucket R2 '$BUCKET' (si no existe)..."
if $WRANGLER r2 bucket list 2>/dev/null | grep -q "$BUCKET"; then
  echo "   ya existe, OK"
else
  $WRANGLER r2 bucket create "$BUCKET"
fi

# 4. Instrucciones para el API token
echo
echo "3) Crear API token de R2 con scope al bucket '$BUCKET':"
echo "   - Abrí https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
echo "   - 'Create API token' → Object Read & Write"
echo "   - 'Specify bucket(s)' → seleccioná sólo '$BUCKET'"
echo "   - 'TTL': lo que prefieras (recomendado: 1 año)"
echo "   - Copiá Access Key ID y Secret Access Key"
echo
echo "4) Pegá las credenciales en tu .env (root del repo):"
echo "   R2_ACCESS_KEY_ID=<access_key_id>"
echo "   R2_SECRET_ACCESS_KEY=<secret_access_key>"
echo
echo "5) Para CI, agregá los mismos como GitHub Secrets (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)"
echo "   y también CF_ACCOUNT_ID si todavía no está."

# 5. Migrar state local si existe
LOCAL_STATE="$ROOT/infra/terraform.tfstate"
if [ -f "$LOCAL_STATE" ]; then
  echo
  echo "6) Detecté un state local en $LOCAL_STATE."
  echo "   Si querés migrarlo a R2, asegurate de tener .env con R2_ACCESS_KEY_ID"
  echo "   y R2_SECRET_ACCESS_KEY, y corré:"
  echo "     make infra-init"
  echo "   Terraform te preguntará si querés migrar; respondé 'yes'."
  echo
  read -r -p "¿Migrar ahora? [y/N] " ans
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    if [ ! -f "$ROOT/.env" ]; then
      echo "ERROR: .env no existe. Pegá las credenciales R2 primero."
      exit 1
    fi
    cd "$ROOT"
    set -a; . ./.env; set +a
    export TF_VAR_cloudflare_api_token="$CF_API_TOKEN" \
           TF_VAR_account_id="$CF_ACCOUNT_ID" \
           TF_VAR_account_subdomain="$ACCOUNT_SUBDOMAIN" \
           TF_VAR_google_client_id="$GOOGLE_CLIENT_ID" \
           TF_VAR_google_client_secret="$GOOGLE_CLIENT_SECRET" \
           TF_VAR_jwt_secret="$JWT_SECRET" \
           TF_VAR_web_url="${WEB_URL:-https://caleta-web.${ACCOUNT_SUBDOMAIN}.workers.dev}" \
           AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
           AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
           TF_BACKEND_BUCKET="$BUCKET" \
           TF_BACKEND_KEY="$KEY" \
           TF_BACKEND_REGION="auto" \
           TF_BACKEND_ENDPOINTS_S3="https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com" \
           TF_BACKEND_SKIP_CREDENTIALS_VALIDATION="true" \
           TF_BACKEND_SKIP_REGION_VALIDATION="true" \
           TF_BACKEND_SKIP_REQUESTING_ACCOUNT_ID="true"
    terraform -chdir=infra init -migrate-state
    echo
    echo "OK: state migrado a R2."
    echo "   Borrá $LOCAL_STATE y .terraform/ de tu copia local si querés."
  fi
fi

echo
echo "Listo. Próximo paso: 'make deploy' (o push a main para que CI deploye)."