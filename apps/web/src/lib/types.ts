// Tipos espejo del backend (apps/api/src/storage/types.ts).
// Mantenerlos sincronizados a mano por ahora es trivial.

export interface ApiList {
  id: string;
  userId: string;
  name: string;
  deletedAt: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskBucket = "now" | "next" | "someday";

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
  bucket: TaskBucket;
  createdAt: string;
  updatedAt: string;
}

export interface ApiGoal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: "active" | "done" | "abandoned";
  createdAt: string;
  updatedAt: string;
}

export interface ApiRhythm {
  id: string;
  userId: string;
  title: string;
  targetPerWeek: number;
  minimum: string | null;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RhythmKind = "full" | "minimum" | "missed";

export interface ApiRhythmEntry {
  id: string;
  userId: string;
  rhythmId: string;
  date: string; // YYYY-MM-DD
  kind: RhythmKind;
  createdAt: string;
}

export interface SyncPull {
  lists: ApiList[];
  tasks: ApiTask[];
  goals?: ApiGoal[];
  rhythms?: ApiRhythm[];
  rhythmEntries?: ApiRhythmEntry[];
  watermark: string;
}
