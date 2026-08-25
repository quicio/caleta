-- 0003_google_refresh_token.sql — persistir refresh_token de Google.
-- Idempotente. NULL por defecto para usuarios sin scope de Calendar.

ALTER TABLE users ADD COLUMN google_refresh_token TEXT;