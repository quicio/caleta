<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type { ApiList, ApiTask } from "../lib/types";
  import TaskRow from "../lib/ui/TaskRow.svelte";
  import EmptyState from "../lib/ui/EmptyState.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { projectColor, todayLabel, timeLabel, isToday } from "../lib/ui/theme";

  let {
    view,
  }: { view: string } = $props();

  let lists = $state<ApiList[]>([]);
  let tasks = $state<ApiTask[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let newTitle = $state("");
  let newDue = $state("");
  let showQuick = $state(false);

  async function refresh() {
    try {
      loading = true;
      const [l, t] = await Promise.all([api.listLists(), api.pullSync(null)]);
      lists = l.lists;
      tasks = t.tasks.filter((x) => !x.deletedAt);
    } finally {
      loading = false;
    }
  }

  async function createTask(e: SubmitEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    creating = true;
    try {
      const list = lists[0];
      if (!list) return;
      await api.createTask(list.id, newTitle.trim());
      newTitle = "";
      newDue = "";
      showQuick = false;
      await refresh();
    } finally {
      creating = false;
    }
  }

  async function toggleTask(t: ApiTask) {
    const updated = await api.patchTask(t.id, { completed: !t.completed });
    tasks = tasks.map((x) => (x.id === t.id ? updated : x));
  }

  async function removeTask(t: ApiTask) {
    await api.deleteTask(t.id);
    tasks = tasks.filter((x) => x.id !== t.id);
  }

  const listName = (id: string): string =>
    lists.find((l) => l.id === id)?.name ?? "";

  const filtered = $derived.by(() => {
    switch (view) {
      case "upcoming":
        return tasks.filter(
          (t) => !t.completed && t.dueAt && !isToday(t.dueAt) && new Date(t.dueAt) > new Date(),
        );
      case "someday":
        return tasks.filter((t) => !t.completed && !t.dueAt);
      case "done":
        return tasks.filter((t) => t.completed);
      case "today":
      default:
        return tasks.filter((t) => !t.completed);
    }
  });

  const titleMap: Record<string, string> = {
    today: "Hoy",
    upcoming: "Próximos",
    someday: "Algún día",
    done: "Hechos",
  };

  onMount(refresh);
</script>

<main class="relative mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-7 lg:px-12 lg:pb-10 lg:pt-12">
  <header class="relative z-10 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75">Tu caleta</p>
      <h1 class="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">{titleMap[view] ?? "Hoy"}</h1>
      <p class="mt-2 font-mono text-[11px] tracking-wide text-mist">
        {todayLabel()}
      </p>
    </div>
    <div class="flex items-center gap-3">
      <span class="font-mono text-[11px] text-mist/75">
        {filtered.length} tarea{filtered.length === 1 ? "" : "s"}
      </span>
      <button type="button" class="btn-primary" onclick={() => (showQuick = !showQuick)}>
        <Icon name="plus" size={14} strokeWidth={2} />
        Nueva tarea
      </button>
    </div>
  </header>

  {#if showQuick}
    <form onsubmit={createTask} class="panel relative z-10 mt-7 rounded-xl border border-surface-2 bg-surface p-4">
      <input
        class="input"
        placeholder="¿Qué tienes que hacer?"
        bind:value={newTitle}
        disabled={creating}
        autofocus
      />
      <div class="mt-2 flex items-center justify-between gap-2">
        <input
          type="datetime-local"
          class="input w-auto font-mono text-[11px]"
          bind:value={newDue}
          disabled={creating}
        />
        <button type="submit" class="btn-primary" disabled={creating || !newTitle.trim()}>
          Crear
        </button>
      </div>
    </form>
  {/if}

  {#if loading && filtered.length === 0}
    <p class="pt-16 text-center font-mono text-xs text-mist/50">Cargando…</p>
  {:else if filtered.length === 0}
    <EmptyState
      title="Aún no hay tareas por aquí."
      copy={view === "done"
        ? "Todavía no completaste ninguna."
        : "Tómate un respiro o crea tu primera tarea."}
    >
      {#snippet action()}
        {#if view !== "done"}
          <button type="button" class="btn-primary" onclick={() => (showQuick = true)}>
            <Icon name="plus" size={14} strokeWidth={2} />
            Crear tarea
          </button>
        {/if}
      {/snippet}
    </EmptyState>
  {:else}
    <section class="panel relative z-10 mt-8 overflow-hidden rounded-xl border border-surface-2/70 bg-surface">
      {#each filtered as t (t.id)}
        <TaskRow
          title={t.title}
          completed={t.completed}
          dueLabel={timeLabel(t.dueAt)}
          projectColor={projectColor(listName(t.listId))}
          listName={listName(t.listId)}
          onToggle={() => toggleTask(t)}
          onDelete={() => removeTask(t)}
        />
      {/each}
    </section>
    <aside class="relative z-10 mt-7 min-h-36 overflow-hidden rounded-xl border border-surface-2/60 bg-surface/45 px-5 py-5 sm:px-7">
      <img src="/images/lighthouse-task-panel.png" alt="Faro iluminando la noche" class="art-fade absolute inset-y-0 right-0 h-full w-[56%] object-cover object-right opacity-50" />
      <div class="relative max-w-xs">
        <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-lime/80">Un momento a la vez</p>
        <p class="mt-3 font-mono text-xs leading-5 text-mist">No se trata de tener tiempo, sino de decidir en qué usarlo.</p>
        <p class="mt-2 font-mono text-[10px] text-mist/55">— Caleta</p>
      </div>
    </aside>
  {/if}
</main>
