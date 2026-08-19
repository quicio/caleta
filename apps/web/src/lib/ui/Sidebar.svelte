<script lang="ts">
  import Wordmark from "./Wordmark.svelte";
  import Icon from "./Icon.svelte";

  let {
    active,
    projects = [],
    userName = "",
    onSelect,
    onProject,
    onNew,
    onLogout,
  }: {
    active: string;
    projects: { id: string; name: string; color: string }[];
    userName?: string;
    onSelect: (view: string) => void;
    onProject: (id: string) => void;
    onNew: () => void;
    onLogout: () => void;
  } = $props();

  const views = [
    { id: "today", label: "Hoy" },
    { id: "upcoming", label: "Próximos" },
    { id: "someday", label: "Algún día" },
    { id: "done", label: "Hechos" },
  ];

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
</script>

<aside
  class="hidden w-56 shrink-0 flex-col border-r border-surface-2/60 bg-surface lg:flex"
>
  <div class="px-5 pb-4 pt-6">
    <button type="button" onclick={() => onSelect("today")} class="cursor-pointer">
      <Wordmark />
    </button>
  </div>

  <nav class="flex-1 space-y-0.5 px-3">
    {#each views as v (v.id)}
      <button
        type="button"
        onclick={() => onSelect(v.id)}
        class="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 {active ===
        v.id
          ? 'bg-surface-2 text-ink-0'
          : 'text-mist hover:bg-surface-2/50 hover:text-ink-0'}"
      >
        {#if active === v.id}
          <span class="size-1.5 rounded-full bg-lime" />
        {:else}
          <span class="size-1.5 rounded-full bg-transparent" />
        {/if}
        {v.label}
      </button>
    {/each}
  </nav>

  <div class="mx-3 my-2 border-t border-surface-2/60" />

  <div class="flex-1 space-y-0.5 px-3">
    <p class="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-widest text-mist/40">
      Proyectos
    </p>
    {#if projects.length === 0}
      <p class="px-2.5 py-1 text-xs text-mist/40">Sin proyectos todavía.</p>
    {:else}
      {#each projects as p (p.id)}
        <button
          type="button"
          onclick={() => onProject(p.id)}
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-mist transition-colors duration-150 hover:bg-surface-2/50 hover:text-ink-0"
        >
          <span class="size-1.5 shrink-0 rounded-full" style={`background-color:${p.color}`} />
          <span class="truncate">{p.name}</span>
        </button>
      {/each}
    {/if}
  </div>

  <div class="border-t border-surface-2/60 px-3 py-3">
    <button
      type="button"
      onclick={onNew}
      class="mb-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-lime bg-lime px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-lime/90"
    >
      <Icon name="plus" size={14} strokeWidth={2} />
      Nueva tarea
    </button>
    <div class="flex items-center gap-2.5">
      <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-moss text-[11px] font-medium text-lime">
        {initials || "?"}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs text-ink-0">{userName}</p>
      </div>
      <button
        type="button"
        onclick={onLogout}
        class="rounded-md p-1.5 text-mist/60 transition-colors duration-150 hover:bg-surface-2 hover:text-ink-0"
        aria-label="Cerrar sesión"
      >
        <Icon name="logout" size={15} />
      </button>
    </div>
  </div>
</aside>
