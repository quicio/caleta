-- 0004_user_settings.sql — settings genéricos por usuario (JSON).
-- Guarda preferencias de a poco (p.ej. calendarios a mostrar).
-- Idempotente.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id    TEXT PRIMARY KEY,
  settings   TEXT NOT NULL DEFAULT '{}',   -- JSON object
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
