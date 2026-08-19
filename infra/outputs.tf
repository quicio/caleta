output "api_url" {
  description = "URL pública de la API."
  value       = var.api_custom_hostname != "" ? "https://${var.api_custom_hostname}" : "https://${cloudflare_workers_script.api.script_name}.${var.account_subdomain}.workers.dev"
}

output "web_url" {
  description = "URL pública del web."
  value       = var.web_custom_hostname != "" ? "https://${var.web_custom_hostname}" : "https://${cloudflare_workers_script.web.script_name}.${var.account_subdomain}.workers.dev"
}

output "d1_database_id" {
  description = "ID de la base D1."
  value       = cloudflare_d1_database.caleta.id
}
