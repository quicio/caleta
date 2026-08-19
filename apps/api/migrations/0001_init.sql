-- 0001_init.sql — esquema inicial de tasksync
-- Idempotente (CREATE IF NOT EXISTS) para que re-ejecuciones no rompan.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,           -- = Google sub
  email       TEXT NOT NULL,
  name        TEXT,
  picture_url TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,           -- UUIDv7 generado server-side
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  deleted_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_id_updated_at ON lists(user_id, updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,           -- UUIDv7 (client-supplied on upsert)
  list_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,              -- denormalizado para sync por usuario
  title       TEXT NOT NULL,
  description TEXT,
  due_at      TEXT,                       -- ISO 8601
  completed   INTEGER NOT NULL DEFAULT 0, -- 0/1
  deleted_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_updated_at ON tasks(user_id, updated_at);
