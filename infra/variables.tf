variable "cloudflare_api_token" {
  description = "API token de Cloudflare (Workers Scripts:Edit, D1:Edit, Pages:Edit, Zone:Edit)."
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "ID de tu cuenta Cloudflare."
  type        = string
}

variable "account_subdomain" {
  description = "Subdominio único de tu cuenta (ej: 'hugo'). Con él se derivan *.workers.dev y *.pages.dev."
  type        = string
}

variable "google_client_id" {
  description = "Google OAuth Web client ID."
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Web client secret."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secreto para firmar JWTs (openssl rand -hex 32)."
  type        = string
  sensitive   = true
}

variable "web_url" {
  description = "URL pública del frontend (CORS + redirect OAuth)."
  type        = string
}

variable "d1_database_name" {
  type    = string
  default = "caleta"
}

variable "api_worker_name" {
  type    = string
  default = "caleta-api"
}

variable "web_worker_name" {
  type    = string
  default = "caleta-web"
}

variable "api_custom_hostname" {
  description = "Hostname custom para la API (vacío = usar *.workers.dev)."
  type        = string
  default     = ""
}

variable "web_custom_hostname" {
  description = "Hostname custom para el web (vacío = usar *.workers.dev)."
  type        = string
  default     = ""
}

variable "zone_id" {
  description = "Zona Cloudflare, requerida si usás hostnames custom."
  type        = string
  default     = ""
}
