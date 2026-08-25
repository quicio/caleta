// D1Provider — primera implementación del StorageProvider sobre Cloudflare D1.
//
// Estrategia: SQL crudo parametrizado. Una fila cruda mapeada a un objeto tipado
// por las funciones rowToX. Toda cláusula WHERE tiene user_id para forzar
// aislamiento (defensa en profundidad, incluso si la ruta lo chequea).

import type {
  CreateListInput,
  CreateTaskInput,
  List,
  StorageProvider,
  SyncSnapshot,
  Task,
  UpdateListPatch,
  UpdateTaskPatch,
  User,
  UserSettings,
} from "./types.ts";

type D1Exec = D1PreparedStatement;

function isoNow(): string {
  return new Date().toISOString();
}

function isoDate(s: string): string {
  // D1 devuelve strings ISO; aseguramos formato comparable.
  return new Date(s).toISOString();
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) ?? null,
    pictureUrl: (row.picture_url as string) ?? null,
    googleRefreshToken: (row.google_refresh_token as string) ?? null,
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function rowToList(row: Record<string, unknown>): List {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    deletedAt: (row.deleted_at as string) ?? null,
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    listId: row.list_id as string,
    userId: row.user_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    dueAt: (row.due_at as string) ?? null,
    completed: Boolean(row.completed),
    deletedAt: (row.deleted_at as string) ?? null,
    dependsOn: (row.depends_on as string) ?? null,
    priority: ((row.priority as string) ?? "normal") === "high" ? "high" : "normal",
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function generateId(): string {
  // UUIDv7-ish sin dependencias: timestamp de 48 bits + 80 bits random.
  // Suficiente para uniqueness en este MVP.
  const t = Date.now().toString(16).padStart(12, "0");
  const rand = [...crypto.getRandomValues(new Uint8Array(10))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hex = `${t}${rand}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export class D1Provider implements StorageProvider {
  constructor(private db: D1Database) {}

  async upsertUser(input: {
    id: string;
    email: string;
    name: string | null;
    pictureUrl: string | null;
    googleRefreshToken?: string | null;
  }): Promise<User> {
    const now = isoNow();
    if (input.googleRefreshToken !== undefined && input.googleRefreshToken !== null) {
      await this.db
        .prepare(
          `INSERT INTO users (id, email, name, picture_url, google_refresh_token, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(id) DO UPDATE SET
             email = excluded.email,
             name = excluded.name,
             picture_url = excluded.picture_url,
             google_refresh_token = excluded.google_refresh_token,
             updated_at = excluded.updated_at`,
        )
        .bind(input.id, input.email, input.name, input.pictureUrl, input.googleRefreshToken, now)
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO users (id, email, name, picture_url, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(id) DO UPDATE SET
             email = excluded.email,
             name = excluded.name,
             picture_url = excluded.picture_url,
             updated_at = excluded.updated_at`,
        )
        .bind(input.id, input.email, input.name, input.pictureUrl, now)
        .run();
    }
    const row = await this.db.prepare(`SELECT * FROM users WHERE id = ?1`).bind(input.id).first();
    return rowToUser(row!);
  }

  async saveGoogleRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    const now = isoNow();
    await this.db
      .prepare(`UPDATE users SET google_refresh_token = ?1, updated_at = ?2 WHERE id = ?3`)
      .bind(refreshToken, now, userId)
      .run();
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const row = await this.db
      .prepare(`SELECT settings FROM user_settings WHERE user_id = ?1`)
      .bind(userId)
      .first();
    if (!row) return {};
    try {
      return JSON.parse(row.settings as string) as UserSettings;
    } catch {
      return {};
    }
  }

  async updateSettings(userId: string, patch: UserSettings): Promise<UserSettings> {
    const now = isoNow();
    const current = await this.getSettings(userId);
    const merged = { ...current, ...patch };
    await this.db
      .prepare(
        `INSERT INTO user_settings (user_id, settings, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id) DO UPDATE SET
           settings = excluded.settings,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, JSON.stringify(merged), now)
      .run();
    return merged;
  }

  async createList(userId: string, input: CreateListInput): Promise<List> {
    const now = isoNow();
    const id = input.id ?? generateId();
    const createdAt = input.createdAt ?? now;
    await this.db
      .prepare(
        `INSERT INTO lists (id, user_id, name, deleted_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, NULL, ?4, ?5)`,
      )
      .bind(id, userId, input.name, createdAt, now)
      .run();
    const row = await this.db
      .prepare(`SELECT * FROM lists WHERE id = ?1 AND user_id = ?2`)
      .bind(id, userId)
      .first();
    return rowToList(row!);
  }

  async getList(userId: string, listId: string): Promise<List | null> {
    const row = await this.db
      .prepare(`SELECT * FROM lists WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`)
      .bind(listId, userId)
      .first();
    return row ? rowToList(row) : null;
  }

  async listLists(userId: string, since?: string): Promise<List[]> {
    let stmt: D1Exec;
    if (since) {
      stmt = this.db
        .prepare(
          `SELECT * FROM lists
           WHERE user_id = ?1 AND deleted_at IS NULL AND updated_at > ?2
           ORDER BY updated_at ASC`,
        )
        .bind(userId, since);
    } else {
      stmt = this.db
        .prepare(
          `SELECT * FROM lists
           WHERE user_id = ?1 AND deleted_at IS NULL
           ORDER BY updated_at ASC`,
        )
        .bind(userId);
    }
    const result = await stmt.all();
    return ((result.results ?? []) as unknown as Record<string, unknown>[]).map(rowToList);
  }

  async updateList(
    userId: string,
    listId: string,
    patch: UpdateListPatch,
  ): Promise<List | null> {
    const now = isoNow();
    // Construye SQL con sólo los campos provistos.
    const sets: string[] = [];
    const values: (string | null)[] = [];
    let i = 1;
    if (patch.name !== undefined) {
      sets.push(`name = ?${i++}`);
      values.push(patch.name);
    }
    if (patch.deletedAt !== undefined) {
      sets.push(`deleted_at = ?${i++}`);
      values.push(patch.deletedAt);
    }
    if (sets.length === 0) return this.getList(userId, listId);
    sets.push(`updated_at = ?${i++}`);
    values.push(now);
    values.push(listId, userId);
    await this.db
      .prepare(`UPDATE lists SET ${sets.join(", ")} WHERE id = ?${i++} AND user_id = ?${i++}`)
      .bind(...values)
      .run();
    return this.getList(userId, listId);
  }

  async deleteList(userId: string, listId: string): Promise<boolean> {
    const now = isoNow();
    // En una transacción: soft-delete la lista y sus tareas activas.
    const result = await this.db
      .prepare(
        `UPDATE lists SET deleted_at = ?1, updated_at = ?1
         WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL`,
      )
      .bind(now, listId, userId)
      .run();
    const changed = (result.meta?.changes ?? 0) > 0;
    if (changed) {
      await this.db
        .prepare(
          `UPDATE tasks SET deleted_at = ?1, updated_at = ?1
           WHERE list_id = ?2 AND user_id = ?3 AND deleted_at IS NULL`,
        )
        .bind(now, listId, userId)
        .run();
    }
    return changed;
  }

  async createTask(userId: string, input: CreateTaskInput): Promise<Task> {
    const now = isoNow();
    const id = input.id ?? generateId();
    const createdAt = input.createdAt ?? now;
    await this.db
      .prepare(
        `INSERT INTO tasks
           (id, list_id, user_id, title, description, due_at, completed, deleted_at, depends_on, priority, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      )
      .bind(
        id,
        input.listId,
        userId,
        input.title,
        input.description ?? null,
        input.dueAt ?? null,
        input.completed ? 1 : 0,
        input.deletedAt ?? null,
        (input as { dependsOn?: string | null }).dependsOn ?? null,
        ((input as { priority?: string }).priority ?? "normal") === "high" ? "high" : "normal",
        createdAt,
        now,
      )
      .run();
    const row = await this.db
      .prepare(`SELECT * FROM tasks WHERE id = ?1 AND user_id = ?2`)
      .bind(id, userId)
      .first();
    return rowToTask(row!);
  }

  async getTask(userId: string, taskId: string): Promise<Task | null> {
    const row = await this.db
      .prepare(`SELECT * FROM tasks WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`)
      .bind(taskId, userId)
      .first();
    return row ? rowToTask(row) : null;
  }

  async listTasksInList(
    userId: string,
    listId: string,
    since?: string,
  ): Promise<Task[]> {
    let stmt: D1Exec;
    if (since) {
      stmt = this.db
        .prepare(
          `SELECT * FROM tasks
           WHERE user_id = ?1 AND list_id = ?2 AND deleted_at IS NULL AND updated_at > ?3
           ORDER BY updated_at ASC`,
        )
        .bind(userId, listId, since);
    } else {
      stmt = this.db
        .prepare(
          `SELECT * FROM tasks
           WHERE user_id = ?1 AND list_id = ?2 AND deleted_at IS NULL
           ORDER BY updated_at ASC`,
        )
        .bind(userId, listId);
    }
    const result = await stmt.all();
    return ((result.results ?? []) as unknown as Record<string, unknown>[]).map(rowToTask);
  }

  async updateTask(
    userId: string,
    taskId: string,
    patch: UpdateTaskPatch,
  ): Promise<Task | null> {
    const now = isoNow();
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    let i = 1;
    if (patch.title !== undefined) {
      sets.push(`title = ?${i++}`);
      values.push(patch.title);
    }
    if (patch.description !== undefined) {
      sets.push(`description = ?${i++}`);
      values.push(patch.description);
    }
    if (patch.dueAt !== undefined) {
      sets.push(`due_at = ?${i++}`);
      values.push(patch.dueAt);
    }
    if (patch.completed !== undefined) {
      sets.push(`completed = ?${i++}`);
      values.push(patch.completed ? 1 : 0);
    }
    if (patch.deletedAt !== undefined) {
      sets.push(`deleted_at = ?${i++}`);
      values.push(patch.deletedAt);
    }
    if (patch.dependsOn !== undefined) {
      sets.push(`depends_on = ?${i++}`);
      values.push(patch.dependsOn);
    }
    if (patch.priority !== undefined) {
      sets.push(`priority = ?${i++}`);
      values.push(patch.priority === "high" ? "high" : "normal");
    }
    if (patch.listId !== undefined) {
      sets.push(`list_id = ?${i++}`);
      values.push(patch.listId);
    }
    if (sets.length === 0) return this.getTask(userId, taskId);
    sets.push(`updated_at = ?${i++}`);
    values.push(now);
    values.push(taskId, userId);
    await this.db
      .prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?${i++} AND user_id = ?${i++}`)
      .bind(...values)
      .run();
    return this.getTask(userId, taskId);
  }

  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    const now = isoNow();
    const result = await this.db
      .prepare(
        `UPDATE tasks SET deleted_at = ?1, updated_at = ?1
         WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL`,
      )
      .bind(now, taskId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async getSyncSnapshot(
    userId: string,
    since: string | undefined,
    now: () => string,
  ): Promise<SyncSnapshot> {
    const useSince = typeof since === "string" && since.length > 0;
    const listsStmt = useSince
      ? this.db.prepare(
          `SELECT * FROM lists
           WHERE user_id = ?1 AND deleted_at IS NULL AND updated_at > ?2
           ORDER BY updated_at ASC`,
        )
      : this.db.prepare(
          `SELECT * FROM lists
           WHERE user_id = ?1 AND deleted_at IS NULL
           ORDER BY updated_at ASC`,
        );
    const tasksStmt = useSince
      ? this.db.prepare(
          `SELECT * FROM tasks
           WHERE user_id = ?1 AND deleted_at IS NULL AND updated_at > ?2
           ORDER BY updated_at ASC`,
        )
      : this.db.prepare(
          `SELECT * FROM tasks
           WHERE user_id = ?1 AND deleted_at IS NULL
           ORDER BY updated_at ASC`,
        );
    const [listsRes, tasksRes] = await Promise.all([
      useSince ? listsStmt.bind(userId, since).all() : listsStmt.bind(userId).all(),
      useSince ? tasksStmt.bind(userId, since).all() : tasksStmt.bind(userId).all(),
    ]);
    const lists = ((listsRes.results ?? []) as unknown as Record<string, unknown>[]).map(rowToList);
    const tasks = ((tasksRes.results ?? []) as unknown as Record<string, unknown>[]).map(rowToTask);
    let max = since ?? "";
    for (const l of lists) if (l.updatedAt > max) max = l.updatedAt;
    for (const t of tasks) if (t.updatedAt > max) max = t.updatedAt;
    return { lists, tasks, watermark: max || now() };
  }

  async pushTasks(
    userId: string,
    tasks: CreateTaskInput[],
    nowFn: () => string,
  ): Promise<{
    ok: boolean;
    applied: Task[];
    invalid: { task: CreateTaskInput; reason: string }[];
  }> {
    const applied: Task[] = [];
    const invalid: { task: CreateTaskInput; reason: string }[] = [];
    // Chequear ownership de cada list_id.
    const listIds = Array.from(new Set(tasks.map((t) => t.listId)));
    const owned = new Set<string>();
    for (const lid of listIds) {
      const own = await this.db
        .prepare(`SELECT 1 FROM lists WHERE id = ?1 AND user_id = ?2`)
        .bind(lid, userId)
        .first();
      if (own) owned.add(lid);
    }
    for (const t of tasks) {
      if (!owned.has(t.listId)) {
        invalid.push({ task: t, reason: `list_id ${t.listId} no pertenece al usuario` });
        continue;
      }
      if (!t.title || t.title.trim().length === 0) {
        invalid.push({ task: t, reason: "title vacío" });
        continue;
      }
      const now = nowFn();
      const id = t.id ?? generateId();
      const createdAt = t.createdAt ?? now;
      await this.db
        .prepare(
          `INSERT INTO tasks
             (id, list_id, user_id, title, description, due_at, completed, deleted_at, depends_on, priority, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             due_at = excluded.due_at,
             completed = excluded.completed,
             deleted_at = excluded.deleted_at,
             depends_on = excluded.depends_on,
             priority = excluded.priority,
             updated_at = excluded.updated_at`,
        )
        .bind(
          id,
          t.listId,
          userId,
          t.title,
          t.description ?? null,
          t.dueAt ?? null,
          t.completed ? 1 : 0,
          t.deletedAt ?? null,
          (t as { dependsOn?: string | null }).dependsOn ?? null,
          ((t as { priority?: string }).priority ?? "normal") === "high" ? "high" : "normal",
          createdAt,
          now,
        )
        .run();
      const row = await this.db
        .prepare(`SELECT * FROM tasks WHERE id = ?1 AND user_id = ?2`)
        .bind(id, userId)
        .first();
      applied.push(rowToTask(row!));
    }
    return { ok: invalid.length === 0, applied, invalid };
  }
}
