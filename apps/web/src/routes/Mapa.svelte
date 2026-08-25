<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type { ApiList, ApiTask } from "../lib/types";
  import { deriveMap, nodeById } from "../lib/map/layout";
  import type { MapViewport } from "../lib/map/types";
  import MapCanvas from "../lib/map/MapCanvas.svelte";
  import MapControls from "../lib/map/MapControls.svelte";
  import MapFilters from "../lib/map/MapFilters.svelte";
  import type { StatusFilter, PriorityFilter } from "../lib/map/MapFilters.svelte";
  import TaskSidePanel from "../lib/map/TaskSidePanel.svelte";
  import FocusBar from "../lib/map/FocusBar.svelte";

  const OVERRIDES_KEY = "caleta:mapa:overrides:v1";

  let lists = $state<ApiList[]>([]);
  let tasks = $state<ApiTask[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let newTitle = $state("");
  let viewport = $state<MapViewport>({ x: 0, y: 0, zoom: 1 });
  let overrides = $state<Record<string, { x: number; y: number }>>({});
  let selectedTaskId = $state<string | null>(null);
  let focusMode = $state(false);
  let focusedTaskId = $state<string | null>(null);
  let showQuick = $state(false);
  let filtersOpen = $state(false);
  let filterStatus = $state<StatusFilter>("all");
  let filterPriority = $state<PriorityFilter>("all");
  let filterListId = $state<string | null>(null);

  function loadOverrides(): Record<string, { x: number; y: number }> {
    try {
      const raw = localStorage.getItem(OVERRIDES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, { x: number; y: number }>;
      }
    } catch {
      // ignore
    }
    return {};
  }

  function saveOverrides(next: Record<string, { x: number; y: number }>) {
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
    } catch {
      // ignore (quota / private mode)
    }
  }

  async function refresh() {
    try {
      loading = true;
      const [l, t] = await Promise.all([api.listLists(), api.pullSync(null)]);
      lists = l.lists;
      const allTasks = t.tasks.filter((x) => !x.deletedAt);
      const knownIds = new Set(allTasks.map((x) => x.id));
      const staleIds = Object.keys(overrides).filter((id) => !knownIds.has(id));
      if (staleIds.length > 0) {
        const next = { ...overrides };
        for (const id of staleIds) delete next[id];
        overrides = next;
        saveOverrides(next);
      }
      tasks = allTasks;
    } finally {
      loading = false;
    }
  }

  const filteredTasks = $derived.by(() => {
    return tasks.filter((t) => {
      if (filterStatus === "active" && t.completed) return false;
      if (filterStatus === "completed" && !t.completed) return false;
      if (filterPriority === "high" && t.priority !== "high") return false;
      if (filterPriority === "normal" && t.priority !== "normal") return false;
      if (filterListId && t.listId !== filterListId) return false;
      return true;
    });
  });

  const map = $derived(deriveMap(lists, filteredTasks, overrides));
  const selectedTask = $derived(
    selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null,
  );
  const selectedList = $derived(
    selectedTask ? lists.find((l) => l.id === selectedTask.listId) ?? null : null,
  );
  const focusTask = $derived(
    focusedTaskId ? tasks.find((t) => t.id === focusedTaskId) ?? null : null,
  );
  const activeFilterCount = $derived(
    (filterStatus !== "all" ? 1 : 0) +
      (filterPriority !== "all" ? 1 : 0) +
      (filterListId !== null ? 1 : 0),
  );

  function setViewportCenter(taskId: string) {
    const n = nodeById(map, taskId);
    if (!n) return;
    viewport = { x: -n.x, y: -n.y, zoom: Math.max(viewport.zoom, 1.1) };
  }

  function selectTask(taskId: string) {
    selectedTaskId = taskId;
    setViewportCenter(taskId);
  }

  function onNodePositionChange(taskId: string, pos: { x: number; y: number }) {
    overrides = { ...overrides, [taskId]: pos };
    saveOverrides(overrides);
  }

  async function onNodeConnect(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = tasks.find((t) => t.id === fromId);
    if (!from) return;
    if (from.dependsOn === toId) return;
    try {
      const updated = await api.setTaskDependency(fromId, toId);
      tasks = tasks.map((t) => (t.id === fromId ? updated : t));
    } catch {
      // noop
    }
  }

  function onProjectClick(listId: string) {
    const t = tasks.find((t) => t.listId === listId && !t.completed);
    if (t) selectTask(t.id);
    else filterListId = listId;
  }

  function onComplete(t: ApiTask) {
    void api.patchTask(t.id, { completed: !t.completed }).then((updated) => {
      tasks = tasks.map((x) => (x.id === t.id ? updated : x));
    });
  }

  function onFocus(t: ApiTask) {
    if (focusMode && focusedTaskId === t.id) {
      focusMode = false;
      focusedTaskId = null;
    } else {
      focusedTaskId = t.id;
      focusMode = true;
      setViewportCenter(t.id);
    }
  }

  async function onSave(
    t: ApiTask,
    patch: {
      title?: string;
      description?: string | null;
      dueAt?: string | null;
      priority?: "normal" | "high";
    },
  ) {
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.dueAt !== undefined) body.due_at = patch.dueAt;
    if (patch.priority !== undefined) body.priority = patch.priority;
    try {
      const updated = await api.patchTask(t.id, body);
      tasks = tasks.map((x) => (x.id === t.id ? updated : x));
    } catch {
      // noop
    }
  }

  function closePanel() {
    selectedTaskId = null;
  }

  function zoomIn() {
    viewport = { ...viewport, zoom: Math.min(2.5, viewport.zoom * 1.2) };
  }
  function zoomOut() {
    viewport = { ...viewport, zoom: Math.max(0.4, viewport.zoom / 1.2) };
  }
  function center() {
    viewport = { x: 0, y: 0, zoom: 1 };
  }
  function toggleFocus() {
    if (!focusedTaskId && selectedTaskId) {
      focusedTaskId = selectedTaskId;
      focusMode = true;
      setViewportCenter(selectedTaskId);
      return;
    }
    focusMode = !focusMode;
    if (!focusMode) focusedTaskId = null;
  }
  function exitFocus() {
    focusMode = false;
    focusedTaskId = null;
  }
  function openFilters() {
    filtersOpen = !filtersOpen;
  }
  function closeFilters() {
    filtersOpen = false;
  }
  function clearFilters() {
    filterStatus = "all";
    filterPriority = "all";
    filterListId = null;
  }

  async function createTask(e: SubmitEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    creating = true;
    try {
      const list = selectedList ?? lists[0];
      if (!list) return;
      await api.createTask(list.id, newTitle.trim());
      newTitle = "";
      showQuick = false;
      await refresh();
    } finally {
      creating = false;
    }
  }

  function onMapBackgroundClick() {
    if (selectedTaskId) closePanel();
    if (filtersOpen) closeFilters();
  }

  onMount(() => {
    overrides = loadOverrides();
    void refresh();
  });
</script>

<main class="relative flex min-h-0 flex-1 flex-col">
  <header class="relative z-10 flex flex-wrap items-center gap-3 border-b border-surface-2/60 bg-surface/40 px-4 py-3 backdrop-blur-sm lg:px-6">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <input
        class="input max-w-xs font-mono text-xs"
        placeholder="buscar en el mapa"
        aria-label="Buscar"
      />
      <button
        type="button"
        class="btn relative {activeFilterCount > 0 ? 'border-lime/40 text-lime' : ''}"
        onclick={openFilters}
        aria-pressed={filtersOpen}
      >
        filtros
        {#if activeFilterCount > 0}
          <span class="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-lime font-mono text-[9px] font-bold text-ink">{activeFilterCount}</span>
        {/if}
      </button>
      {#if activeFilterCount > 0}
        <button type="button" class="font-mono text-[10px] text-mist/70 hover:text-ink-0" onclick={clearFilters}>
          limpiar
        </button>
      {/if}
    </div>
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-surface-2 text-mist transition-colors hover:border-lime/40 hover:text-lime"
        onclick={zoomOut}
        aria-label="Alejar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14" /></svg>
      </button>
      <span class="px-1 font-mono text-[10px] text-mist/70">{Math.round(viewport.zoom * 100)}%</span>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-surface-2 text-mist transition-colors hover:border-lime/40 hover:text-lime"
        onclick={zoomIn}
        aria-label="Acercar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" class="btn-primary ml-2" onclick={() => (showQuick = !showQuick)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
        Nueva tarea
      </button>
    </div>
  </header>

  {#if showQuick}
    <form onsubmit={createTask} class="relative z-10 mx-4 mt-3 lg:mx-6">
      <div class="panel rounded-xl border border-surface-2 bg-surface p-3">
        <input
          class="input"
          placeholder="¿Qué tarea nueva?"
          bind:value={newTitle}
          disabled={creating}
          autofocus
        />
        <div class="mt-2 flex justify-end">
          <button type="submit" class="btn-primary" disabled={creating || !newTitle.trim()}>
            Crear
          </button>
        </div>
      </div>
    </form>
  {/if}

  <div class="relative min-h-0 flex-1 overflow-hidden">
    {#if loading && tasks.length === 0}
      <div class="flex h-full items-center justify-center">
        <p class="font-mono text-xs text-mist/50">Cargando…</p>
      </div>
    {:else if tasks.length === 0}
      <div class="flex h-full items-center justify-center px-6 text-center">
        <div>
          <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lime/70">Carta en blanco</p>
          <p class="text-sm text-mist">Aún no hay tareas. Creá la primera para trazar tu rumbo.</p>
        </div>
      </div>
    {:else if filteredTasks.length === 0}
      <div class="flex h-full items-center justify-center px-6 text-center">
        <div>
          <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/60">Sin resultados</p>
          <p class="mb-3 text-sm text-mist">Ninguna tarea matchea los filtros activos.</p>
          <button type="button" class="btn" onclick={clearFilters}>limpiar filtros</button>
        </div>
      </div>
    {:else}
      <MapCanvas
        bind:viewport
        bind:selectedTaskId
        bind:focusMode
        bind:focusedTaskId
        map={map}
        lists={lists}
        tasks={filteredTasks}
        onNodePositionChange={onNodePositionChange}
        onNodeConnect={onNodeConnect}
        onProjectClick={onProjectClick}
      />

      <MapControls
        focusActive={focusMode}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onCenter={center}
        onToggleFocus={toggleFocus}
        onFilters={openFilters}
      />

      <MapFilters
        open={filtersOpen}
        lists={lists}
        status={filterStatus}
        priority={filterPriority}
        listId={filterListId}
        onChange={(next) => {
          if (next.status !== undefined) filterStatus = next.status;
          if (next.priority !== undefined) filterPriority = next.priority;
          if (next.listId !== undefined) filterListId = next.listId;
        }}
        onClose={closeFilters}
      />

      <FocusBar task={focusMode ? focusTask : null} onExit={exitFocus} />

      <TaskSidePanel
        task={selectedTask}
        list={selectedList}
        allTasks={tasks}
        focusActive={focusMode && focusedTaskId === selectedTaskId}
        onClose={closePanel}
        onComplete={onComplete}
        onFocus={onFocus}
        onSave={onSave}
      />

      <button
        type="button"
        class="absolute inset-0 z-10 cursor-default"
        style:background="transparent"
        style:pointer-events={selectedTaskId || filtersOpen ? "auto" : "none"}
        onclick={onMapBackgroundClick}
        aria-label="Cerrar"
      ></button>
    {/if}
  </div>
</main>