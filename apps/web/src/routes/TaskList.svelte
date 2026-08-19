<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type { ApiList, ApiTask } from "../lib/types";
  import TaskRow from "../lib/ui/TaskRow.svelte";
  import EmptyState from "../lib/ui/EmptyState.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { projectColor, timeLabel } from "../lib/ui/theme";
  import { navigate } from "../lib/router.svelte.ts";

  let { params }: { params: { id: string } } = $props();

  let list = $state<ApiList | null>(null);
  let tasks = $state<ApiTask[]>([]);
  let newTitle = $state("");
  let newDue = $state("");
  let loading = $state(false);
  let saving = $state(false);
  let showQuick = $state(false);

  const listId = $derived(params.id);

  async function load() {
    if (!listId) return;
    loading = true;
    try {
      const listsRes = await api.listLists();
      list = listsRes.lists.find((l) => l.id === listId) ?? null;
      const tasksRes = await api.listTasks(listId);
      tasks = tasksRes.tasks.filter((x) => !x.deletedAt);
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
      newDue = "";
      showQuick = false;
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

  const projectName = $derived(list?.name ?? "");
  const projectColorValue = $derived(projectColor(projectName));

  onMount(load);

  $effect(() => {
    if (listId) void load();
  });
</script>

<main class="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-7 lg:px-12 lg:pb-10 lg:pt-12">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <button
        type="button"
        class="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-sm text-mist transition-colors duration-150 hover:text-ink-0"
        onclick={() => navigate("/")}
      >
        <Icon name="arrow" size={14} />
        Volver
      </button>
      <div class="flex items-center gap-2.5">
        <span class="size-2.5 rounded-full" style={`background-color:${projectColorValue}`} />
        <h1 class="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">{projectName}</h1>
      </div>
      <p class="mt-1 font-mono text-[11px] uppercase tracking-wider text-mist">
        {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
      </p>
    </div>
    <button type="button" class="btn-primary" onclick={() => (showQuick = !showQuick)}>
      <Icon name="plus" size={14} strokeWidth={2} />
      Nueva tarea
    </button>
  </header>

  {#if showQuick}
    <form onsubmit={addTask} class="panel mt-7 rounded-xl border border-surface-2 bg-surface p-4">
      <input
        class="input"
        placeholder="¿Qué tienes que hacer?"
        bind:value={newTitle}
        disabled={saving}
        autofocus
      />
      <div class="mt-2 flex items-center justify-between gap-2">
        <input
          type="datetime-local"
          class="input w-auto font-mono text-[11px]"
          bind:value={newDue}
          disabled={saving}
        />
        <button type="submit" class="btn-primary" disabled={saving || !newTitle.trim()}>
          Crear
        </button>
      </div>
    </form>
  {/if}

  {#if loading && tasks.length === 0}
    <p class="pt-16 text-center font-mono text-xs text-mist/50">Cargando…</p>
  {:else if tasks.length === 0}
    <EmptyState
      title="Aún no hay tareas por aquí."
      copy="Tómate un respiro o crea tu primera tarea."
    >
      {#snippet action()}
        <button type="button" class="btn-primary" onclick={() => (showQuick = true)}>
          <Icon name="plus" size={14} strokeWidth={2} />
          Crear tarea
        </button>
      {/snippet}
    </EmptyState>
  {:else}
    <section class="panel mt-8 overflow-hidden rounded-xl border border-surface-2/70 bg-surface">
      {#each tasks as t (t.id)}
        <TaskRow
          title={t.title}
          completed={t.completed}
          dueLabel={timeLabel(t.dueAt)}
          projectColor={projectColorValue}
          onToggle={() => toggleComplete(t)}
          onDelete={() => removeTask(t)}
        />
      {/each}
    </section>
  {/if}
</main>
