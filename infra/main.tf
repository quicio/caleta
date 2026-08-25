# Infra de caleta — Cloudflare (Workers + D1).
# Se aplica con `terraform -chdir=infra apply` o `make deploy` (que además
# buildea la api y el web). Los valores vienen de variables (TF_VAR_*).

terraform {
  required_version = ">= 1.5"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  # Backend S3-compatible apuntando a un bucket R2 dedicado.
  # Los valores completos se pasan en `terraform init` via env vars
  # (TF_BACKEND_*) o -backend-config. Las credenciales viven en
  # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (R2 emite tokens
  # S3-compatibles bajo esos nombres). Ver infra/scripts/bootstrap-tfstate.sh
  # para el setup inicial y RUNBOOK sección 5.1.
  backend "s3" {
    # placeholders — los valores reales se pasan en init
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# --- D1 ---
resource "cloudflare_d1_database" "caleta" {
  account_id = var.account_id
  name       = var.d1_database_name
  read_replication = {
    mode = "disabled"
  }
}

# --- KV (rate limit) ---
resource "cloudflare_workers_kv_namespace" "ratelimit" {
  account_id = var.account_id
  title      = var.kv_namespace_title
}

# --- Worker API (Hono) ---
resource "cloudflare_workers_script" "api" {
  account_id         = var.account_id
  script_name        = var.api_worker_name
  content            = file("${path.module}/../apps/api/dist/index.js")
  main_module        = "index.js"
  compatibility_date = "2025-08-01"

  bindings = [
    {
      name        = "DB"
      type        = "d1"
      database_id = cloudflare_d1_database.caleta.id
    },
    {
      name         = "RATE_LIMIT"
      type         = "kv_namespace"
      namespace_id = cloudflare_workers_kv_namespace.ratelimit.id
    },
    {
      name = "STORAGE_PROVIDER"
      type = "plain_text"
      text = "d1"
    },
    {
      name = "WEB_URL"
      type = "plain_text"
      text = var.web_url
    },
    {
      name = "GOOGLE_CLIENT_ID"
      type = "secret_text"
      text = var.google_client_id
    },
    {
      name = "GOOGLE_CLIENT_SECRET"
      type = "secret_text"
      text = var.google_client_secret
    },
    {
      name = "JWT_SECRET"
      type = "secret_text"
      text = var.jwt_secret
    },
  ]
}

# --- Migración D1 (idempotente) ---
resource "null_resource" "d1_migrate" {
  triggers = {
    migration_0001 = filemd5("${path.module}/../apps/api/migrations/0001_init.sql")
    migration_0002 = filemd5("${path.module}/../apps/api/migrations/0002_task_links.sql")
    migration_0003 = filemd5("${path.module}/../apps/api/migrations/0003_google_refresh_token.sql")
    d1_id          = cloudflare_d1_database.caleta.id
  }

  provisioner "local-exec" {
    # ponytail: D1 (SQLite) no soporta `ALTER TABLE ADD COLUMN IF NOT EXISTS`,
    # así que las migraciones 0002/0003 no son idempotentes por sí solas.
    # El wrapper chequea `pragma_table_info` antes de aplicar cada una.
    command = <<-EOT
      set -e
      DB=${var.d1_database_name}

      npx wrangler d1 execute $DB --remote --file=${path.module}/../apps/api/migrations/0001_init.sql

      HAS_DEPS=$(npx wrangler d1 execute $DB --remote --json \
        --command "SELECT count(*) AS c FROM pragma_table_info('tasks') WHERE name='depends_on';" \
        | jq -r '.[0].results[0].c')
      if [ "$HAS_DEPS" = "0" ]; then
        echo "Applying 0002_task_links.sql..."
        npx wrangler d1 execute $DB --remote --file=${path.module}/../apps/api/migrations/0002_task_links.sql
      else
        echo "0002_task_links.sql already applied; skipping."
      fi

      HAS_GRT=$(npx wrangler d1 execute $DB --remote --json \
        --command "SELECT count(*) AS c FROM pragma_table_info('users') WHERE name='google_refresh_token';" \
        | jq -r '.[0].results[0].c')
      if [ "$HAS_GRT" = "0" ]; then
        echo "Applying 0003_google_refresh_token.sql..."
        npx wrangler d1 execute $DB --remote --file=${path.module}/../apps/api/migrations/0003_google_refresh_token.sql
      else
        echo "0003_google_refresh_token.sql already applied; skipping."
      fi
    EOT
    environment = {
      CLOUDFLARE_API_TOKEN  = var.cloudflare_api_token
      CLOUDFLARE_ACCOUNT_ID = var.account_id
    }
  }
}

# --- Worker Web (SPA como static assets) ---
resource "cloudflare_workers_script" "web" {
  account_id         = var.account_id
  script_name        = var.web_worker_name
  compatibility_date = "2025-08-01"

  assets = {
    directory = "${path.module}/../apps/web/dist"
    config = {
      not_found_handling = "single-page-application"
      html_handling      = "auto-trailing-slash"
    }
  }
}

# --- Custom domains (opcionales) ---
resource "cloudflare_workers_custom_domain" "api" {
  count = var.api_custom_hostname != "" ? 1 : 0

  account_id = var.account_id
  hostname   = var.api_custom_hostname
  service    = cloudflare_workers_script.api.script_name
  zone_id    = var.zone_id
}

resource "cloudflare_dns_record" "api" {
  count = var.api_custom_hostname != "" ? 1 : 0

  zone_id = var.zone_id
  name    = var.api_custom_hostname
  content = "${var.api_worker_name}.${var.account_subdomain}.workers.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_workers_custom_domain" "web" {
  count = var.web_custom_hostname != "" ? 1 : 0

  account_id = var.account_id
  hostname   = var.web_custom_hostname
  service    = cloudflare_workers_script.web.script_name
  zone_id    = var.zone_id
}

resource "cloudflare_dns_record" "web" {
  count = var.web_custom_hostname != "" ? 1 : 0

  zone_id = var.zone_id
  name    = var.web_custom_hostname
  content = "${var.web_worker_name}.${var.account_subdomain}.workers.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}
