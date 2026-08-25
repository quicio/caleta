// Tipos espejo del backend (apps/api/src/storage/types.ts).
// Mantenerlos sincronizados a mano por ahora es trivial.

export interface ApiList {
  id: string;
  userId: string;
  name: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTask {
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

export interface SyncPull {
  lists: ApiList[];
  tasks: ApiTask[];
  watermark: string;
}
