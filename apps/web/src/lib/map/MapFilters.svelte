<script lang="ts">
  import type { ApiList } from "../types.ts";

  export type StatusFilter = "all" | "active" | "completed";
  export type PriorityFilter = "all" | "high" | "normal";

  let {
    open,
    lists,
    status,
    priority,
    listId,
    onChange,
    onClose,
  }: {
    open: boolean;
    lists: ApiList[];
    status: StatusFilter;
    priority: PriorityFilter;
    listId: string | null;
    onChange: (next: { status?: StatusFilter; priority?: PriorityFilter; listId?: string | null }) => void;
    onClose: () => void;
  } = $props();

  function setStatus(s: StatusFilter) {
    onChange({ status: s });
  }
  function setPriority(p: PriorityFilter) {
    onChange({ priority: p });
  }
  function setList(id: string | null) {
    onChange({ listId: id });
  }
</script>

{#if open}
  <div
    class="pointer-events-auto absolute right-6 bottom-20 z-30 w-[300px] rounded-xl border border-surface-2/80 bg-surface/95 p-4 shadow-[0_0_40px_rgb(0_0_0/30%)] backdrop-blur-sm"
    role="dialog"
    aria-label="Filtros del mapa"
  >
    <div class="mb-3 flex items-center justify-between">
      <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75">Filtros</p>
      <button
        type="button"
        onclick={onClose}
        class="rounded-md p-1 text-mist/60 transition-colors hover:bg-surface-2 hover:text-ink-0"
        aria-label="Cerrar filtros"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>

    <section class="mb-4">
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mist/55">Estado</p>
      <div class="flex gap-1.5">
        {#each [{ id: "all", label: "Todas" }, { id: "active", label: "Activas" }, { id: "completed", label: "Hechas" }] as opt (opt.id)}
          <button
            type="button"
            class="flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors {status === opt.id ? 'border-lime bg-moss/40 text-lime' : 'border-surface-2 text-mist hover:text-ink-0'}"
            onclick={() => setStatus(opt.id as StatusFilter)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </section>

    <section class="mb-4">
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mist/55">Prioridad</p>
      <div class="flex gap-1.5">
        {#each [{ id: "all", label: "Todas" }, { id: "high", label: "Alta" }, { id: "normal", label: "Normal" }] as opt (opt.id)}
          <button
            type="button"
            class="flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors {priority === opt.id ? 'border-lime bg-moss/40 text-lime' : 'border-surface-2 text-mist hover:text-ink-0'}"
            onclick={() => setPriority(opt.id as PriorityFilter)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </section>

    <section>
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mist/55">Proyecto</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="rounded-md border px-2 py-1 text-xs transition-colors {listId === null ? 'border-lime bg-moss/40 text-lime' : 'border-surface-2 text-mist hover:text-ink-0'}"
          onclick={() => setList(null)}
        >
          Todos
        </button>
        {#each lists as l (l.id)}
          <button
            type="button"
            class="rounded-md border px-2 py-1 text-xs transition-colors {listId === l.id ? 'border-lime bg-moss/40 text-lime' : 'border-surface-2 text-mist hover:text-ink-0'}"
            onclick={() => setList(l.id)}
          >
            {l.name}
          </button>
        {/each}
      </div>
    </section>
  </div>
{/if}