<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    active,
    onSelect,
  }: {
    active: string;
    onSelect: (view: string) => void;
  } = $props();

  const tabs = [
    { id: "lista", label: "Lista", icon: "list" },
    { id: "calendario", label: "Calendario", icon: "calendar" },
    { id: "mapa", label: "Mapa", icon: "flag" },
    { id: "configuracion", label: "Config", icon: "settings" },
  ];
</script>

<nav
  class="fixed inset-x-0 bottom-0 z-40 flex border-t border-surface-2/60 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
>
  {#each tabs as t (t.id)}
    <button
      type="button"
      onclick={() => onSelect(t.id)}
      class="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 transition-colors duration-150 {active ===
      t.id
        ? 'text-lime'
        : 'text-mist hover:text-ink-0'}"
    >
      <Icon name={t.icon} size={19} strokeWidth={active === t.id ? 2 : 1.5} />
      <span class="font-mono text-[9px] uppercase tracking-wide">{t.label}</span>
    </button>
  {/each}
</nav>