<script lang="ts">
  let {
    active,
    onSelect,
  }: {
    active: string;
    onSelect: (view: string) => void;
  } = $props();

  const tabs = [
    { id: "lista", label: "Lista" },
    { id: "calendario", label: "Calendario" },
    { id: "mapa", label: "Mapa" },
  ];
</script>

<div class="flex items-center gap-1 overflow-x-auto border-b border-surface-2/60 px-4 lg:hidden">
  {#each tabs as t (t.id)}
    <button
      type="button"
      onclick={() => onSelect(t.id)}
      class="cursor-pointer whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 {active ===
      t.id
        ? 'border-lime text-ink-0'
        : 'border-transparent text-mist hover:text-ink-0'}"
    >
      {t.label}
    </button>
  {/each}
</div>
