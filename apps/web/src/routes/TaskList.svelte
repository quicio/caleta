<script lang="ts">
  import { onMount } from "svelte";
  import { navigate } from "../lib/router.svelte";
  import { api } from "../lib/api";
  import type { ApiList, ApiTask } from "../lib/types";

  let { params } = $props<{ params: { id: string } }>();

  let list = $state<ApiList | null>(null);
  let tasks = $state<ApiTask[]>([]);
  let newTitle = $state("");
  let loading = $state(false);
  let saving = $state(false);

  const listId = $derived(params.id);

  async function load() {
    if (!listId) return;
    loading = true;
    try {
      const listsRes = await api.listLists();
      list = listsRes.lists.find((l) => l.id === listId) ?? null;
      const tasksRes = await api.listTasks(listId);
      tasks = tasksRes.tasks;
    } finally {
      loading = false;
    }
  }

  async function addTask(e: SubmitEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !listId) return;
    saving = true;
    try {
      await api.createTask(listId, newTitle.trim());
      newTitle = "";
      await load();
    } finally {
      saving = false;
    }
  }

  async function toggleComplete(t: ApiTask) {
    const updated = await api.patchTask(t.id, { completed: !t.completed });
    tasks = tasks.map((x) => (x.id === t.id ? updated : x));
  }

  async function removeTask(t: ApiTask) {
    await api.deleteTask(t.id);
    tasks = tasks.filter((x) => x.id !== t.id);
  }

  onMount(load);

  $effect(() => {
    if (listId) void load();
  });
</script>

<main class="max-w-2xl mx-auto px-4 py-8 space-y-6">
  <header>
    <button class="text-sm text-slate-500 underline" onclick={() => navigate("/")}>
      ← Volver
    </button>
    <h1 class="text-xl font-semibold mt-2">
      {list?.name ?? "—"}
    </h1>
  </header>

  {#if loading}
    <p class="text-slate-500">Cargando…</p>
  {:else}
    <form onsubmit={addTask} class="flex gap-2">
      <input
        class="input"
        placeholder="Nueva tarea..."
        bind:value={newTitle}
        disabled={saving}
      />
      <button class="btn-primary" type="submit" disabled={saving || !newTitle.trim()}>
        Añadir
      </button>
    </form>

    {#if tasks.length === 0}
      <div class="border border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-500">
        Sin tareas todavía.
      </div>
    {:else}
      <ul class="space-y-2">
        {#each tasks as t (t.id)}
          <li class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 flex items-center gap-3">
            <input
              type="checkbox"
              class="size-5 accent-violet-600"
              checked={t.completed}
              onchange={() => toggleComplete(t)}
            />
            <span class="flex-1 {t.completed ? 'line-through text-slate-400' : ''}">
              {t.title}
            </span>
            <button class="btn-danger" onclick={() => removeTask(t)}>
              x
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <p class="text-xs text-slate-400 text-center pt-8">
    Cambios guardados automaticamente.
  </p>
</main>
