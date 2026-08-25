<script lang="ts">
  let {
    onZoomIn,
    onZoomOut,
    onCenter,
    onToggleFocus,
    onFilters,
    focusActive,
  }: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onCenter: () => void;
    onToggleFocus: () => void;
    onFilters: () => void;
    focusActive: boolean;
  } = $props();
</script>

<div class="pointer-events-auto absolute bottom-6 right-6 z-20 flex flex-col gap-1.5">
  <button
    type="button"
    class="group flex size-9 items-center justify-center rounded-md border border-surface-2 bg-surface/85 text-mist backdrop-blur-sm transition-colors hover:border-lime/40 hover:text-lime"
    onclick={onZoomIn}
    aria-label="Acercar"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" /></svg>
  </button>
  <button
    type="button"
    class="group flex size-9 items-center justify-center rounded-md border border-surface-2 bg-surface/85 text-mist backdrop-blur-sm transition-colors hover:border-lime/40 hover:text-lime"
    onclick={onZoomOut}
    aria-label="Alejar"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14" /></svg>
  </button>
  <div class="my-1 h-px bg-surface-2/80"></div>
  <button
    type="button"
    class="group flex size-9 items-center justify-center rounded-md border border-surface-2 bg-surface/85 text-mist backdrop-blur-sm transition-colors hover:border-lime/40 hover:text-lime"
    onclick={onCenter}
    aria-label="Centrar"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
  </button>
  <button
    type="button"
    class="group flex size-9 items-center justify-center rounded-md border bg-surface/85 backdrop-blur-sm transition-colors {focusActive ? 'border-lime text-lime' : 'border-surface-2 text-mist hover:border-lime/40 hover:text-lime'}"
    onclick={onToggleFocus}
    aria-label="Modo foco"
    aria-pressed={focusActive}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l4-4h10l4 4v10l-4 4H7l-4-4V7z" /><circle cx="12" cy="12" r="3" /></svg>
  </button>
  <div class="my-1 h-px bg-surface-2/80"></div>
  <button
    type="button"
    class="group flex size-9 items-center justify-center rounded-md border border-surface-2 bg-surface/85 text-mist backdrop-blur-sm transition-colors hover:border-lime/40 hover:text-lime"
    onclick={onFilters}
    aria-label="Filtros"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16M7 12h10M10 19h4" /></svg>
  </button>
</div>