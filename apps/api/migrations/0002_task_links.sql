-- 0002_task_links.sql — campos de dependencia y prioridad para el mapa.
-- Idempotente: usa ADD COLUMN con DEFAULT para no romper filas existentes.

ALTER TABLE tasks ADD COLUMN depends_on TEXT;
ALTER TABLE tasks ADD COLUMN priority     TEXT NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks(depends_on);