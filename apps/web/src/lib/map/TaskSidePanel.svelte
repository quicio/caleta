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
    onSave,
    focusActive,
  }: {
    task: ApiTask | null;
    list: ApiList | null;
    allTasks: ApiTask[];
    onClose: () => void;
    onComplete: (t: ApiTask) => void;
    onFocus: (t: ApiTask) => void;
    onSave: (t: ApiTask, patch: {
      title?: string;
      description?: string | null;
      dueAt?: string | null;
      priority?: "normal" | "high";
    }) => Promise<void>;
    focusActive: boolean;
  } = $props();

  let editing = $state(false);
  let saving = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editDue = $state("");
  let editPriority = $state<"normal" | "high">("normal");

  $effect(() => {
    if (task && !editing) {
      editTitle = task.title;
      editDescription = task.description ?? "";
      editDue = task.dueAt ? toLocal(task.dueAt) : "";
      editPriority = task.priority;
    }
  });

  function toLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocal(v: string): string | null {
    if (!v) return null;
    return new Date(v).toISOString();
  }

  function startEdit() {
    if (!task) return;
    editTitle = task.title;
    editDescription = task.description ?? "";
    editDue = task.dueAt ? toLocal(task.dueAt) : "";
    editPriority = task.priority;
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  async function saveEdit() {
    if (!task) return;
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    saving = true;
    try {
      const patch: Parameters<typeof onSave>[1] = {};
      if (trimmed !== task.title) patch.title = trimmed;
      const desc = editDescription.trim() || null;
      if ((desc ?? null) !== (task.description ?? null)) patch.description = desc;
      const dueIso = fromLocal(editDue);
      if ((dueIso ?? null) !== (task.dueAt ?? null)) patch.dueAt = dueIso;
      if (editPriority !== task.priority) patch.priority = editPriority;
      if (Object.keys(patch).length === 0) {
        editing = false;
        return;
      }
      await onSave(task, patch);
      editing = false;
    } finally {
      saving = false;
    }
  }

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
          {editing ? "Editando" : list?.name ?? "Sin proyecto"}
        </p>
        {#if editing}
          <input
            class="input text-xl font-semibold"
            bind:value={editTitle}
            disabled={saving}
            placeholder="Título"
            aria-label="Título de la tarea"
          />
        {:else}
          <h2 class="text-xl font-semibold leading-tight text-ink-0">{task.title}</h2>
        {/if}
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
      {#if editing}
        <section>
          <label class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist/55" for="edit-desc">
            Descripción
          </label>
          <textarea
            id="edit-desc"
            class="input min-h-24 resize-y text-sm leading-relaxed"
            bind:value={editDescription}
            disabled={saving}
            placeholder="Notas, contexto, links…"
          ></textarea>
        </section>

        <section>
          <label class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist/55" for="edit-due">
            Vence
          </label>
          <input
            id="edit-due"
            type="datetime-local"
            class="input font-mono text-[11px]"
            bind:value={editDue}
            disabled={saving}
          />
          {#if editDue}
            <button
              type="button"
              class="mt-1 font-mono text-[10px] text-mist/60 hover:text-rose-400"
              onclick={() => (editDue = "")}
              disabled={saving}
            >
              quitar fecha
            </button>
          {/if}
        </section>

        <section>
          <p class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/55">Prioridad</p>
          <div class="flex gap-1.5">
            {#each [{ id: "normal", label: "Normal" }, { id: "high", label: "Alta" }] as opt (opt.id)}
              <button
                type="button"
                class="flex-1 rounded-md border px-3 py-2 text-sm transition-colors {editPriority === opt.id ? 'border-lime bg-moss/40 text-lime' : 'border-surface-2 text-mist hover:text-ink-0'}"
                onclick={() => (editPriority = opt.id as "normal" | "high")}
                disabled={saving}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </section>
      {:else}
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
      {/if}
    </div>

    <footer class="flex items-center gap-2 border-t border-surface-2/60 px-5 py-4">
      {#if editing}
        <button
          type="button"
          class="btn flex-1"
          onclick={cancelEdit}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex-1"
          onclick={saveEdit}
          disabled={saving || !editTitle.trim()}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      {:else}
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
          onclick={startEdit}
        >
          Editar
        </button>
      {/if}
    </footer>
  </aside>
{/if}