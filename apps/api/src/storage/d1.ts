// D1Provider — primera implementación del StorageProvider sobre Cloudflare D1.
//
// Estrategia: SQL crudo parametrizado. Una fila cruda mapeada a un objeto tipado
// por las funciones rowToX. Toda cláusula WHERE tiene user_id para forzar
// aislamiento (defensa en profundidad, incluso si la ruta lo chequea).

import type {
  CreateGoalInput,
  CreateListInput,
  CreateRhythmEntryInput,
  CreateRhythmInput,
  CreateTaskInput,
  Goal,
  List,
  Rhythm,
  RhythmEntry,
  StorageProvider,
  SyncSnapshot,
  Task,
  TaskBucket,
  UpdateGoalPatch,
  UpdateListPatch,
  UpdateRhythmPatch,
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
    goalId: (row.goal_id as string) ?? null,
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function rowToTask(row: Record<string, unknown>): Task {
  const bucket = (row.bucket as string) ?? "next";
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
    bucket: bucket === "now" || bucket === "someday" ? bucket : "next",
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function rowToGoal(row: Record<string, unknown>): Goal {
  const status = (row.status as string) ?? "active";
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    status: status === "done" || status === "abandoned" ? status : "active",
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function rowToRhythm(row: Record<string, unknown>): Rhythm {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    targetPerWeek: Number(row.target_per_week ?? 3),
    minimum: (row.minimum as string) ?? null,
    unit: (row.unit as string) ?? null,
    createdAt: isoDate(row.created_at as string),
    updatedAt: isoDate(row.updated_at as string),
  };
}

function rowToRhythmEntry(row: Record<string, unknown>): RhythmEntry {
  const kind = (row.kind as string) ?? "full";
  return {
    id: row.id as string,
    userId: row.user_id as string,
    rhythmId: row.rhythm_id as string,
    date: row.date as string,
    kind: kind === "minimum" || kind === "missed" ? kind : "full",
    createdAt: isoDate(row.created_at as string),
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
    if (patch.goalId !== undefined) {
      sets.push(`goal_id = ?${i++}`);
      values.push(patch.goalId);
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
    const bucket = input.bucket ?? "next";
    await this.db
      .prepare(
        `INSERT INTO tasks
           (id, list_id, user_id, title, description, due_at, completed, deleted_at, depends_on, priority, bucket, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
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
        bucket,
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
    if (patch.bucket !== undefined) {
      sets.push(`bucket = ?${i++}`);
      values.push(patch.bucket);
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
    const goalsStmt = useSince
      ? this.db.prepare(
          `SELECT * FROM goals
           WHERE user_id = ?1 AND updated_at > ?2
           ORDER BY updated_at ASC`,
        )
      : this.db.prepare(
          `SELECT * FROM goals WHERE user_id = ?1 ORDER BY updated_at ASC`,
        );
    const rhythmsStmt = useSince
      ? this.db.prepare(
          `SELECT * FROM rhythms
           WHERE user_id = ?1 AND updated_at > ?2
           ORDER BY updated_at ASC`,
        )
      : this.db.prepare(
          `SELECT * FROM rhythms WHERE user_id = ?1 ORDER BY updated_at ASC`,
        );
    const entriesStmt = useSince
      ? this.db.prepare(
          `SELECT * FROM rhythm_entries
           WHERE user_id = ?1 AND created_at > ?2
           ORDER BY created_at ASC`,
        )
      : this.db.prepare(
          `SELECT * FROM rhythm_entries WHERE user_id = ?1 ORDER BY created_at ASC`,
        );
    const [listsRes, tasksRes, goalsRes, rhythmsRes, entriesRes] = await Promise.all([
      useSince ? listsStmt.bind(userId, since).all() : listsStmt.bind(userId).all(),
      useSince ? tasksStmt.bind(userId, since).all() : tasksStmt.bind(userId).all(),
      useSince ? goalsStmt.bind(userId, since).all() : goalsStmt.bind(userId).all(),
      useSince ? rhythmsStmt.bind(userId, since).all() : rhythmsStmt.bind(userId).all(),
      useSince ? entriesStmt.bind(userId, since).all() : entriesStmt.bind(userId).all(),
    ]);
    const lists = ((listsRes.results ?? []) as unknown as Record<string, unknown>[]).map(rowToList);
    const tasks = ((tasksRes.results ?? []) as unknown as Record<string, unknown>[]).map(rowToTask);
    const goals = ((goalsRes.results ?? []) as unknown as Record<string, unknown>[]).map(rowToGoal);
    const rhythms = ((rhythmsRes.results ?? []) as unknown as Record<string, unknown>[]).map(
      rowToRhythm,
    );
    const rhythmEntries = ((entriesRes.results ?? []) as unknown as Record<string, unknown>[]).map(
      rowToRhythmEntry,
    );
    let max = since ?? "";
    for (const l of lists) if (l.updatedAt > max) max = l.updatedAt;
    for (const t of tasks) if (t.updatedAt > max) max = t.updatedAt;
    for (const g of goals) if (g.updatedAt > max) max = g.updatedAt;
    for (const r of rhythms) if (r.updatedAt > max) max = r.updatedAt;
    for (const e of rhythmEntries) if (e.createdAt > max) max = e.createdAt;
    return {
      lists,
      tasks,
      goals,
      rhythms,
      rhythmEntries,
      watermark: max || now(),
    };
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
      const bucket = t.bucket ?? "next";
      await this.db
        .prepare(
          `INSERT INTO tasks
             (id, list_id, user_id, title, description, due_at, completed, deleted_at, depends_on, priority, bucket, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             due_at = excluded.due_at,
             completed = excluded.completed,
             deleted_at = excluded.deleted_at,
             depends_on = excluded.depends_on,
             priority = excluded.priority,
             bucket = excluded.bucket,
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
          bucket,
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

  // --- goals ---

  async createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
    const now = isoNow();
    const id = input.id ?? generateId();
    const createdAt = input.createdAt ?? now;
    await this.db
      .prepare(
        `INSERT INTO goals (id, user_id, title, description, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        id,
        userId,
        input.title,
        input.description ?? null,
        input.status ?? "active",
        createdAt,
        now,
      )
      .run();
    const row = await this.db
      .prepare(`SELECT * FROM goals WHERE id = ?1 AND user_id = ?2`)
      .bind(id, userId)
      .first();
    return rowToGoal(row!);
  }

  async getGoal(userId: string, goalId: string): Promise<Goal | null> {
    const row = await this.db
      .prepare(`SELECT * FROM goals WHERE id = ?1 AND user_id = ?2`)
      .bind(goalId, userId)
      .first();
    return row ? rowToGoal(row) : null;
  }

  async listGoals(userId: string, since?: string): Promise<Goal[]> {
    const stmt = since
      ? this.db.prepare(
          `SELECT * FROM goals WHERE user_id = ?1 AND updated_at > ?2 ORDER BY updated_at ASC`,
        ).bind(userId, since)
      : this.db.prepare(
          `SELECT * FROM goals WHERE user_id = ?1 ORDER BY updated_at ASC`,
        ).bind(userId);
    const result = await stmt.all();
    return ((result.results ?? []) as unknown as Record<string, unknown>[]).map(rowToGoal);
  }

  async updateGoal(
    userId: string,
    goalId: string,
    patch: UpdateGoalPatch,
  ): Promise<Goal | null> {
    const now = isoNow();
    const sets: string[] = [];
    const values: (string | null)[] = [];
    let i = 1;
    if (patch.title !== undefined) {
      sets.push(`title = ?${i++}`);
      values.push(patch.title);
    }
    if (patch.description !== undefined) {
      sets.push(`description = ?${i++}`);
      values.push(patch.description);
    }
    if (patch.status !== undefined) {
      sets.push(`status = ?${i++}`);
      values.push(patch.status);
    }
    if (sets.length === 0) return this.getGoal(userId, goalId);
    sets.push(`updated_at = ?${i++}`);
    values.push(now);
    values.push(goalId, userId);
    await this.db
      .prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ?${i++} AND user_id = ?${i++}`)
      .bind(...values)
      .run();
    return this.getGoal(userId, goalId);
  }

  async deleteGoal(userId: string, goalId: string): Promise<boolean> {
    // Limpia goal_id de los proyectos asociados; no los elimina.
    await this.db
      .prepare(`UPDATE lists SET goal_id = NULL, updated_at = ?1 WHERE goal_id = ?2 AND user_id = ?3`)
      .bind(isoNow(), goalId, userId)
      .run();
    const result = await this.db
      .prepare(`DELETE FROM goals WHERE id = ?1 AND user_id = ?2`)
      .bind(goalId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  // --- rhythms ---

  async createRhythm(userId: string, input: CreateRhythmInput): Promise<Rhythm> {
    const now = isoNow();
    const id = input.id ?? generateId();
    const createdAt = input.createdAt ?? now;
    await this.db
      .prepare(
        `INSERT INTO rhythms (id, user_id, title, target_per_week, minimum, unit, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        id,
        userId,
        input.title,
        input.targetPerWeek ?? 3,
        input.minimum ?? null,
        input.unit ?? null,
        createdAt,
        now,
      )
      .run();
    const row = await this.db
      .prepare(`SELECT * FROM rhythms WHERE id = ?1 AND user_id = ?2`)
      .bind(id, userId)
      .first();
    return rowToRhythm(row!);
  }

  async getRhythm(userId: string, rhythmId: string): Promise<Rhythm | null> {
    const row = await this.db
      .prepare(`SELECT * FROM rhythms WHERE id = ?1 AND user_id = ?2`)
      .bind(rhythmId, userId)
      .first();
    return row ? rowToRhythm(row) : null;
  }

  async listRhythms(userId: string, since?: string): Promise<Rhythm[]> {
    const stmt = since
      ? this.db.prepare(
          `SELECT * FROM rhythms WHERE user_id = ?1 AND updated_at > ?2 ORDER BY updated_at ASC`,
        ).bind(userId, since)
      : this.db.prepare(
          `SELECT * FROM rhythms WHERE user_id = ?1 ORDER BY updated_at ASC`,
        ).bind(userId);
    const result = await stmt.all();
    return ((result.results ?? []) as unknown as Record<string, unknown>[]).map(rowToRhythm);
  }

  async updateRhythm(
    userId: string,
    rhythmId: string,
    patch: UpdateRhythmPatch,
  ): Promise<Rhythm | null> {
    const now = isoNow();
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    let i = 1;
    if (patch.title !== undefined) {
      sets.push(`title = ?${i++}`);
      values.push(patch.title);
    }
    if (patch.targetPerWeek !== undefined) {
      sets.push(`target_per_week = ?${i++}`);
      values.push(patch.targetPerWeek);
    }
    if (patch.minimum !== undefined) {
      sets.push(`minimum = ?${i++}`);
      values.push(patch.minimum);
    }
    if (patch.unit !== undefined) {
      sets.push(`unit = ?${i++}`);
      values.push(patch.unit);
    }
    if (sets.length === 0) return this.getRhythm(userId, rhythmId);
    sets.push(`updated_at = ?${i++}`);
    values.push(now);
    values.push(rhythmId, userId);
    await this.db
      .prepare(`UPDATE rhythms SET ${sets.join(", ")} WHERE id = ?${i++} AND user_id = ?${i++}`)
      .bind(...values)
      .run();
    return this.getRhythm(userId, rhythmId);
  }

  async deleteRhythm(userId: string, rhythmId: string): Promise<boolean> {
    const result = await this.db
      .prepare(`DELETE FROM rhythms WHERE id = ?1 AND user_id = ?2`)
      .bind(rhythmId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async listRhythmEntries(
    userId: string,
    rhythmId: string,
    since?: string,
  ): Promise<RhythmEntry[]> {
    const stmt = since
      ? this.db
          .prepare(
            `SELECT * FROM rhythm_entries
             WHERE user_id = ?1 AND rhythm_id = ?2 AND created_at > ?3
             ORDER BY date ASC`,
          )
          .bind(userId, rhythmId, since)
      : this.db
          .prepare(
            `SELECT * FROM rhythm_entries WHERE user_id = ?1 AND rhythm_id = ?2 ORDER BY date ASC`,
          )
          .bind(userId, rhythmId);
    const result = await stmt.all();
    return ((result.results ?? []) as unknown as Record<string, unknown>[]).map(rowToRhythmEntry);
  }

  async upsertRhythmEntry(userId: string, input: CreateRhythmEntryInput): Promise<RhythmEntry> {
    const now = isoNow();
    const id = input.id ?? generateId();
    await this.db
      .prepare(
        `INSERT INTO rhythm_entries (id, user_id, rhythm_id, date, kind, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(user_id, rhythm_id, date) DO UPDATE SET
           kind = excluded.kind,
           id = excluded.id,
           created_at = excluded.created_at`,
      )
      .bind(id, userId, input.rhythmId, input.date, input.kind, now)
      .run();
    const row = await this.db
      .prepare(
        `SELECT * FROM rhythm_entries WHERE user_id = ?1 AND rhythm_id = ?2 AND date = ?3`,
      )
      .bind(userId, input.rhythmId, input.date)
      .first();
    return rowToRhythmEntry(row!);
  }

  // --- tasks by bucket ---

  async listTasksByBucket(
    userId: string,
    bucket: TaskBucket,
    since?: string,
  ): Promise<Task[]> {
    const stmt = since
      ? this.db
          .prepare(
            `SELECT * FROM tasks
             WHERE user_id = ?1 AND bucket = ?2 AND deleted_at IS NULL AND completed = 0 AND updated_at > ?3
             ORDER BY updated_at ASC`,
          )
          .bind(userId, bucket, since)
      : this.db
          .prepare(
            `SELECT * FROM tasks
             WHERE user_id = ?1 AND bucket = ?2 AND deleted_at IS NULL AND completed = 0
             ORDER BY updated_at ASC`,
          )
          .bind(userId, bucket);
    const result = await stmt.all();
    return ((result.results ?? []) as unknown as Record<string, unknown>[]).map(rowToTask);
  }
}
