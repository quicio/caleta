# Design

## Modelo de datos

Migración `0005_personal_model.sql` (idempotente, `CREATE ... IF NOT EXISTS` / `ALTER ... ADD COLUMN` con DEFAULT).

### `goals`

```sql
CREATE TABLE goals (
  id          TEXT PRIMARY KEY,          -- UUIDv7 server-side
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | done | abandoned
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_goals_user_id_updated_at ON goals(user_id, updated_at);
```

Un objetivo es un destino. No tiene jerarquía propia. Los proyectos se le asocian por FK opcional.

### `lists` (proyectos)

La tabla existente gana una columna opcional:

```sql
ALTER TABLE lists ADD COLUMN goal_id TEXT;
CREATE INDEX idx_lists_goal_id ON lists(goal_id);
```

El concepto user-facing es **proyecto**. La API y el front exponen `project` (renombrado en respuestas y UI), pero internamente la tabla se llama `lists` para preservar el sync existente. No se renombra en esta change.

### `tasks`

```sql
ALTER TABLE tasks ADD COLUMN bucket TEXT NOT NULL DEFAULT 'next';  -- now | next | someday
CREATE INDEX idx_tasks_user_id_bucket ON tasks(user_id, bucket);
```

`bucket` controla en qué sección de Home aparece la tarea. Default `next` preserva el comportamiento actual (todo lo no completado aparece en la lista general). El campo `completed` sigue gobernando "Hechos".

### `rhythms`

```sql
CREATE TABLE rhythms (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  target_per_week INTEGER NOT NULL DEFAULT 3,
  minimum         TEXT,    -- ej. "10 minutes", "5 pages" (string libre, el front lo renderiza)
  unit            TEXT,    -- ej. "veces", "minutos" (opcional)
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_rhythms_user_id_updated_at ON rhythms(user_id, updated_at);
```

Decisión: recurrencia **simple** (`target_per_week` + entries explícitas) en lugar de RRULE. Suficiente para el primer slice y evita una librería externa. La recurrencia se computa contando `rhythm_entries` en los últimos 7 días.

### `rhythm_entries`

```sql
CREATE TABLE rhythm_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  rhythm_id  TEXT NOT NULL,
  date       TEXT NOT NULL,   -- YYYY-MM-DD en la zona local del usuario
  kind       TEXT NOT NULL,   -- full | minimum | missed
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (rhythm_id) REFERENCES rhythms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_rhythm_entries_unique ON rhythm_entries(user_id, rhythm_id, date);
CREATE INDEX idx_rhythm_entries_rhythm_date ON rhythm_entries(user_id, rhythm_id, date);
```

Una entry por `(user, rhythm, date)`. `kind` distingue FULL / MINIMUM. `missed` se registra explícitamente para que el sistema no "resetee" al usuario si no marca: la ausencia no se castiga, pero si el usuario quiere reflejar un día perdido puede hacerlo.

## Decisiones de storage

- Se agrega a `StorageProvider`:
  - `getGoal`, `listGoals`, `createGoal`, `updateGoal`, `deleteGoal`.
  - `getRhythm`, `listRhythms`, `createRhythm`, `updateRhythm`, `deleteRhythm`.
  - `listRhythmEntries(rhythmId, since?)`, `upsertRhythmEntry(input)`.
- `listTasksInList` se mantiene; para Home se agrega `listTasksByBucket(userId, bucket)`.
- El sync snapshot (`getSyncSnapshot`) se extiende para devolver también `goals`, `rhythms`, `rhythm_entries` con el mismo criterio de `since`. El cliente ignora campos que no conoce.

## Decisiones de API

- `PATCH /api/tasks/:id` acepta `bucket` ∈ `now | next | someday`. Validación server-side.
- `PATCH /api/lists/:id` acepta `goal_id` (string o null). Validación server-side: el `goal_id` debe pertenecer al usuario.
- Rate limit: las nuevas rutas usan el `ipScope` rate limiter existente con un `route` distinto por endpoint.
- Sin endpoints nuevos para "assign task to goal" directo: el camino es `task → project → goal`. Mantiene el grafo limpio (ver doc §6).

## Decisiones de UI

- Home (ruta `/`) se reorganiza en cuatro secciones en orden estricto: **Ahora**, **Próximo**, **Algún día**, **Hechos**. Cada sección es collapsible.
- El control de bucket por tarea es un menú mínimo (3 opciones) inline, sin modal.
- Ritmos aparece como una sub-sección sobria en Home (debajo de Próximo, antes de Algún día) con barra de progreso monoespaciada tipo `███████░  6 / 7`. El control FULL/MINIMUM/MISSED es un toggle de tres estados por día.
- Goals aparece como una sub-sección "Objetivos" con lista breve y un botón "Nuevo objetivo". No es una ruta nueva.
- Asignar proyecto a goal: dentro del editor de proyecto (panel existente o expandible), un selector discreto.
- Se preserva la nav actual: **Lista · Calendario · Mapa · Configuración**. No se agregan entradas al nav.

## Compatibilidad

- Columnas nuevas con DEFAULT no rompen clientes que no las conocen.
- Sync incluye las entidades nuevas; clientes viejos las ignoran. Clientes nuevos las piden aunque el server aún no las envíe (defensivo: `payload ?? []`).
- Si la migración 0005 no se aplicó todavía, las APIs devuelven errores de "no such column"; el deploy debe aplicar la migración **antes** de promover el código.