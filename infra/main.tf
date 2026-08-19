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
    migration_file = filemd5("${path.module}/../apps/api/migrations/0001_init.sql")
    d1_id          = cloudflare_d1_database.caleta.id
  }

  provisioner "local-exec" {
    command = "npx wrangler d1 execute ${var.d1_database_name} --remote --file=${path.module}/../apps/api/migrations/0001_init.sql"
    environment = {
      CLOUDFLARE_API_TOKEN  = var.cloudflare_api_token
      CLOUDFLARE_ACCOUNT_ID = var.account_id
    }
  }
}

# --- Worker Web (SPA como static assets) ---
resource "cloudflare_workers_script" "web" {
  account_id  = var.account_id
  script_name = var.web_worker_name

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
