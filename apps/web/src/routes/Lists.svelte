<script lang="ts">
  import { onMount } from "svelte";
  import Link from "../lib/Link.svelte";
  import { navigate } from "../lib/router.svelte";
  import { api } from "../lib/api";
  import type { ApiList } from "../lib/types";

  let lists = $state<ApiList[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let newName = $state("");

  async function refresh() {
    try {
      loading = true;
      const res = await api.listLists();
      lists = res.lists;
    } finally {
      loading = false;
    }
  }

  async function syncNow() {
    try {
      const res = await api.pullSync(null);
      // Por simplicidad, recargamos — el sync se aplica como borrado y reemplazo.
      void res;
      await refresh();
    } catch {
      // Silencio — el usuario verá el error en consola.
    }
  }

  async function createList(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    creating = true;
    try {
      await api.createList(newName.trim());
      newName = "";
      await refresh();
    } finally {
      creating = false;
    }
  }

  async function removeList(id: string) {
    if (!confirm("¿Borrar lista? (las tareas también)")) return;
    await api.deleteList(id);
    await refresh();
  }

  onMount(refresh);
</script>

<main class="max-w-2xl mx-auto px-4 py-8 space-y-6">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">Mis listas</h1>
    <button class="btn" onclick={syncNow} disabled={loading}>
      {loading ? "Sincronizando..." : "Sync ahora"}
    </button>
  </header>

  <form onsubmit={createList} class="flex gap-2">
    <input
      class="input"
      placeholder="Nueva lista (ej: Hogar)"
      bind:value={newName}
      disabled={creating}
    />
    <button class="btn-primary" type="submit" disabled={creating || !newName.trim()}>
      Crear
    </button>
  </form>

  {#if loading && lists.length === 0}
    <p class="text-slate-500">Cargando…</p>
  {:else if lists.length === 0}
    <div class="border border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-500">
      Aún no tenés listas. Creá una para empezar.
    </div>
  {:else}
    <ul class="space-y-2">
      {#each lists as list (list.id)}
        <li class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 flex items-center justify-between">
          <Link to={`/lists/${list.id}`} class="font-medium hover:underline">
            {list.name}
          </Link>
          <button class="btn-danger" onclick={() => removeList(list.id)}>
            Borrar
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <footer class="text-xs text-slate-400 text-center pt-8">
    <button
      class="underline"
      onclick={() => {
        import("../lib/auth").then((m) => m.clearToken());
        navigate("/");
      }}
    >
      Cerrar sesión
    </button>
  </footer>
</main>
