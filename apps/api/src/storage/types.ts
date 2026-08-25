// StorageProvider — la única forma en que las rutas acceden a la DB.
// Cualquier nueva implementación (Postgres, IndexedDB, memoria) debe cumplir este contrato.

export interface User {
  id: string;             // Google sub
  email: string;
  name: string | null;
  pictureUrl: string | null;
  googleRefreshToken: string | null;
  createdAt: string;      // ISO 8601
  updatedAt: string;
}

export interface List {
  id: string;
  userId: string;
  name: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  listId: string;
  userId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  completed: boolean;
  deletedAt: string | null;
  dependsOn: string | null;
  priority: "normal" | "high";
  createdAt: string;
  updatedAt: string;
}

/**
 * Opciones para crear entidades desde el cliente (por ejemplo, sync push).
 * El cliente puede proponer ids (UUIDv7) y createdAt; el servidor siempre
 * gobierna updatedAt.
 */
export interface CreateListInput {
  id?: string;
  name: string;
  createdAt?: string;
}
export interface CreateTaskInput {
  id?: string;
  listId: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  completed?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
}

export interface UpdateListPatch {
  name?: string;
  deletedAt?: string | null;
}
export interface UpdateTaskPatch {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  completed?: boolean;
  deletedAt?: string | null;
  dependsOn?: string | null;
  priority?: "normal" | "high";
  listId?: string;
}

export interface SyncSnapshot {
  lists: List[];
  tasks: Task[];
  watermark: string; // mayor updatedAt observado
}

export interface StorageProvider {
  // --- users ---
  upsertUser(input: {
    id: string;
    email: string;
    name: string | null;
    pictureUrl: string | null;
    googleRefreshToken?: string | null;
  }): Promise<User>;
  saveGoogleRefreshToken(userId: string, refreshToken: string | null): Promise<void>;

  // --- lists ---
  createList(userId: string, input: CreateListInput): Promise<List>;
  getList(userId: string, listId: string): Promise<List | null>;
  listLists(userId: string, since?: string): Promise<List[]>;
  updateList(userId: string, listId: string, patch: UpdateListPatch): Promise<List | null>;
  /**
   * Soft delete: setea deletedAt = now() en la lista y en cascada en sus tareas.
   * Devuelve true si la entidad existía y pertenecía al usuario.
   */
  deleteList(userId: string, listId: string): Promise<boolean>;

  // --- tasks ---
  createTask(userId: string, input: CreateTaskInput): Promise<Task>;
  getTask(userId: string, taskId: string): Promise<Task | null>;
  listTasksInList(userId: string, listId: string, since?: string): Promise<Task[]>;
  updateTask(userId: string, taskId: string, patch: UpdateTaskPatch): Promise<Task | null>;
  deleteTask(userId: string, taskId: string): Promise<boolean>;

  // --- sync ---
  /**
   * Devuelve lists y tasks del usuario con updated_at > since.
   * Si since es undefined, devuelve todo lo no-borrado.
   * Devuelve watermark = max(updated_at) observado, o now() si no hay rows.
   */
  getSyncSnapshot(userId: string, since: string | undefined, now: () => string): Promise<SyncSnapshot>;

  /**
   * Aplica upsert en lote de tareas. Valida que cada list_id pertenezca al usuario;
   * las tareas con listId ajeno son ignoradas silenciosamente y el método devuelve
   * un flag ok=false junto con el subconjunto aplicado, para que el caller responda 400.
   */
  pushTasks(
    userId: string,
    tasks: CreateTaskInput[],
    now: () => string,
  ): Promise<{ ok: boolean; applied: Task[]; invalid: { task: CreateTaskInput; reason: string }[] }>;
}
