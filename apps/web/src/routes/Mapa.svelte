<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type { ApiList, ApiTask } from "../lib/types";
  import { deriveMap, nodeById } from "../lib/map/layout";
  import type { MapViewport } from "../lib/map/types";
  import MapCanvas from "../lib/map/MapCanvas.svelte";
  import MapControls from "../lib/map/MapControls.svelte";
  import TaskSidePanel from "../lib/map/TaskSidePanel.svelte";
  import FocusBar from "../lib/map/FocusBar.svelte";

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

  const map = $derived(deriveMap(lists, tasks, overrides));
  const selectedTask = $derived(
    selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null,
  );
  const selectedList = $derived(
    selectedTask ? lists.find((l) => l.id === selectedTask.listId) ?? null : null,
  );
  const focusTask = $derived(
    focusedTaskId ? tasks.find((t) => t.id === focusedTaskId) ?? null : null,
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
      // noop — feedback visual ausente en esta iteración
    }
  }

  function onProjectClick(listId: string) {
    selectTask(tasks.find((t) => t.listId === listId && !t.completed)?.id ?? "");
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

  function onEdit(t: ApiTask) {
    // placeholder — edición inline pendiente
    selectedTaskId = t.id;
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
    // placeholder — sheet de filtros pendiente
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
  }

  onMount(refresh);
</script>

<main class="relative flex min-h-0 flex-1 flex-col">
  <header class="relative z-10 flex flex-wrap items-center gap-3 border-b border-surface-2/60 bg-surface/40 px-4 py-3 backdrop-blur-sm lg:px-6">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <input
        class="input max-w-xs font-mono text-xs"
        placeholder="buscar en el mapa"
        aria-label="Buscar"
      />
      <button type="button" class="btn" onclick={openFilters}>
        filtros
      </button>
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
    {:else}
      <MapCanvas
        bind:viewport
        bind:selectedTaskId
        bind:focusMode
        bind:focusedTaskId
        map={map}
        lists={lists}
        tasks={tasks}
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

      <FocusBar task={focusMode ? focusTask : null} onExit={exitFocus} />

      <TaskSidePanel
        task={selectedTask}
        list={selectedList}
        allTasks={tasks}
        focusActive={focusMode && focusedTaskId === selectedTaskId}
        onClose={closePanel}
        onComplete={onComplete}
        onFocus={onFocus}
        onEdit={onEdit}
      />

      <button
        type="button"
        class="absolute inset-0 z-10 cursor-default"
        style:background="transparent"
        style:pointer-events={selectedTaskId ? "auto" : "none"}
        onclick={onMapBackgroundClick}
        aria-label="Cerrar panel"
      ></button>
    {/if}
  </div>
</main>