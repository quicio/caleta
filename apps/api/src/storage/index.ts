// Factory de StorageProvider. Por ahora sólo d1; un cambio futuro añade
// Postgres, IndexedDB o memoria sin tocar las rutas.

import { D1Provider } from "./d1.ts";
import type { StorageProvider } from "./types.ts";

export interface ProviderEnv {
  STORAGE_PROVIDER?: string;
  DB?: D1Database;
}

export function getStorageProvider(env: ProviderEnv): StorageProvider {
  const choice = (env.STORAGE_PROVIDER ?? "d1").toLowerCase();
  switch (choice) {
    case "d1":
      if (!env.DB) throw new Error("STORAGE_PROVIDER=d1 requiere el binding D1 (DB)");
      return new D1Provider(env.DB);
    default:
      throw new Error(`STORAGE_PROVIDER desconocido: ${choice}`);
  }
}

export type { StorageProvider } from "./types.ts";
