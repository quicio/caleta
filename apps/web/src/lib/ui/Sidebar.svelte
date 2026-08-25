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
    { id: "lista", label: "Lista" },
    { id: "calendario", label: "Calendario" },
    { id: "mapa", label: "Mapa" },
  ];

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
</script>

<aside
  class="panel hidden w-[270px] shrink-0 flex-col border-r border-surface-2/60 lg:flex"
>
  <div class="px-6 pb-7 pt-8">
    <button type="button" onclick={() => onSelect("lista")} class="cursor-pointer">
      <Wordmark />
    </button>
  </div>

  <nav class="space-y-1 px-4">
    {#each views as v (v.id)}
      <button
        type="button"
        onclick={() => onSelect(v.id)}
        class="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 {active ===
        v.id
          ? 'bg-moss/45 text-lime shadow-[inset_0_1px_rgb(255_255_255/3%)]'
          : 'text-mist hover:bg-surface-2/50 hover:text-ink-0'}"
      >
        <span class="flex items-center gap-2.5">
          {#if active === v.id}<span class="size-1.5 rounded-full bg-lime shadow-[0_0_8px_#e7ff44]" />{:else}<span class="size-1.5 rounded-full bg-transparent" />{/if}
          {v.label}
        </span>
      </button>
    {/each}
  </nav>

  <div class="mx-5 my-5 border-t border-surface-2/60" />

  <div class="flex-1 space-y-1 px-4">
    <p class="px-3 pb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-mist/50">
      Proyectos
    </p>
    {#if projects.length === 0}
      <p class="px-2.5 py-1 text-xs text-mist/40">Sin proyectos todavía.</p>
    {:else}
      {#each projects as p (p.id)}
        <button
          type="button"
          onclick={() => onProject(p.id)}
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-mist transition-colors duration-150 hover:bg-surface-2/50 hover:text-ink-0"
        >
          <span class="size-1.5 shrink-0 rounded-full" style={`background-color:${p.color}`} />
          <span class="truncate">{p.name}</span>
        </button>
      {/each}
    {/if}
  </div>

  <div class="border-t border-surface-2/60 px-4 py-5">
    <button
      type="button"
      onclick={onNew}
      class="mb-5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-lime bg-lime px-3 py-2.5 text-sm font-medium text-ink shadow-[0_0_24px_rgb(231_255_68/12%)] transition-colors duration-150 hover:bg-lime/90"
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
