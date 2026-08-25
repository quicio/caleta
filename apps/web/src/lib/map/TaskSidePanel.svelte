<script lang="ts">
  import type { ApiList, ApiTask } from "../types.ts";
  import { dueLabel, projectColor } from "../ui/theme.ts";

  let {
    task,
    list,
    allTasks,
    onClose,
    onComplete,
    onFocus,
    onEdit,
    focusActive,
  }: {
    task: ApiTask | null;
    list: ApiList | null;
    allTasks: ApiTask[];
    onClose: () => void;
    onComplete: (t: ApiTask) => void;
    onFocus: (t: ApiTask) => void;
    onEdit: (t: ApiTask) => void;
    focusActive: boolean;
  } = $props();

  const dependsOnTask = $derived(
    task?.dependsOn ? allTasks.find((t) => t.id === task.dependsOn) ?? null : null,
  );
  const dependents = $derived(
    task ? allTasks.filter((t) => !t.deletedAt && t.dependsOn === task.id) : [],
  );
</script>

{#if task}
  <aside
    class="pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-[360px] flex-col border-l border-surface-2/80 bg-surface/95 shadow-[0_0_60px_rgb(0_0_0/30%)] backdrop-blur-sm"
    role="dialog"
    aria-label="Detalle de tarea"
  >
    <header class="flex items-start justify-between gap-3 border-b border-surface-2/60 px-5 pb-3 pt-5">
      <div class="min-w-0 flex-1">
        <p class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75">
          {list?.name ?? "Sin proyecto"}
        </p>
        <h2 class="text-xl font-semibold leading-tight text-ink-0">{task.title}</h2>
      </div>
      <button
        type="button"
        onclick={onClose}
        class="rounded-md p-1.5 text-mist/60 transition-colors hover:bg-surface-2 hover:text-ink-0"
        aria-label="Cerrar panel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </header>

    <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
      <div class="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span
          class="inline-flex items-center gap-1.5 rounded-md border border-surface-2 bg-surface-2/50 px-2 py-1 text-mist"
        >
          <span class="size-1.5 rounded-full" style:background-color={list ? projectColor(list.name) : "var(--color-mist)"} />
          {list?.name ?? "—"}
        </span>
        <span class="rounded-md border border-surface-2 bg-surface-2/50 px-2 py-1 {task.priority === 'high' ? 'border-lime/40 text-lime' : 'text-mist'}">
          {task.priority === "high" ? "Alta prioridad" : "Prioridad normal"}
        </span>
        {#if task.dueAt}
          <span class="rounded-md border border-surface-2 bg-surface-2/50 px-2 py-1 text-mist">
            {dueLabel(task.dueAt)}
          </span>
        {/if}
      </div>

      {#if task.description}
        <section>
          <p class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/55">
            Descripción
          </p>
          <p class="text-sm leading-relaxed text-ink-0/90">{task.description}</p>
        </section>
      {/if}

      <section>
        <p class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/55">
          Dependencias
        </p>
        {#if dependsOnTask}
          <div class="rounded-md border border-surface-2/60 bg-surface-2/30 px-3 py-2 text-sm text-mist">
            ← depende de
            <span class="ml-1 text-ink-0">{dependsOnTask.title}</span>
          </div>
        {/if}
        {#if dependents.length > 0}
          <div class="mt-2 space-y-1.5">
            {#each dependents as d (d.id)}
              <div class="rounded-md border border-surface-2/60 bg-surface-2/30 px-3 py-2 text-sm text-mist">
                → bloquea
                <span class="ml-1 text-ink-0">{d.title}</span>
              </div>
            {/each}
          </div>
        {/if}
        {#if !dependsOnTask && dependents.length === 0}
          <p class="text-xs text-mist/40">Sin dependencias. Shift+drag desde el nodo para crear una.</p>
        {/if}
      </section>

      <section>
        <p class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/55">
          Actividad
        </p>
        <ul class="space-y-1 font-mono text-[11px] text-mist/65">
          <li>· creada {new Date(task.createdAt).toLocaleString("es-AR")}</li>
          <li>· actualizada {new Date(task.updatedAt).toLocaleString("es-AR")}</li>
        </ul>
      </section>
    </div>

    <footer class="flex items-center gap-2 border-t border-surface-2/60 px-5 py-4">
      <button
        type="button"
        class="btn flex-1 {task.completed ? 'border-lime/40 text-lime' : ''}"
        onclick={() => onComplete(task)}
      >
        {task.completed ? "Completada" : "Completar"}
      </button>
      <button
        type="button"
        class="btn flex-1 {focusActive && task ? 'border-lime/40 text-lime' : ''}"
        onclick={() => onFocus(task)}
      >
        {focusActive ? "Quitar foco" : "Enfocar"}
      </button>
      <button
        type="button"
        class="btn"
        onclick={() => onEdit(task)}
        aria-label="Editar tarea"
      >
        Editar
      </button>
    </footer>
  </aside>
{/if}