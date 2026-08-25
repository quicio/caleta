-- 0005_personal_model.sql — goals, rhythms y bucket de tareas.
-- Base del modelo personal: Goal → Project (lists) → Task, y Ritmos recurrentes.
-- Idempotente.

CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,           -- UUIDv7 server-side
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | done | abandoned
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id_updated_at ON goals(user_id, updated_at);

ALTER TABLE lists ADD COLUMN goal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_lists_goal_id ON lists(goal_id);

ALTER TABLE tasks ADD COLUMN bucket TEXT NOT NULL DEFAULT 'next'; -- now | next | someday
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_bucket ON tasks(user_id, bucket);

CREATE TABLE IF NOT EXISTS rhythms (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  target_per_week INTEGER NOT NULL DEFAULT 3,
  minimum         TEXT,                    -- ej. "10 minutes", "5 pages"
  unit            TEXT,                    -- ej. "veces", "minutos"
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rhythms_user_id_updated_at ON rhythms(user_id, updated_at);

CREATE TABLE IF NOT EXISTS rhythm_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  rhythm_id  TEXT NOT NULL,
  date       TEXT NOT NULL,                -- YYYY-MM-DD local
  kind       TEXT NOT NULL,                -- full | minimum | missed
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (rhythm_id) REFERENCES rhythms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rhythm_entries_unique
  ON rhythm_entries(user_id, rhythm_id, date);
CREATE INDEX IF NOT EXISTS idx_rhythm_entries_rhythm_date
  ON rhythm_entries(user_id, rhythm_id, date);