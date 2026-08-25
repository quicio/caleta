<script lang="ts">
  import type { ApiTask } from "../types.ts";

  let {
    task,
    onExit,
  }: {
    task: ApiTask | null;
    onExit: () => void;
  } = $props();
</script>

{#if task}
  <div class="pointer-events-auto absolute left-1/2 top-5 z-20 -translate-x-1/2">
    <div class="flex items-center gap-3 rounded-full border border-lime/40 bg-ink/85 px-4 py-2 shadow-[0_0_30px_rgb(231_255_68/15%)] backdrop-blur-sm">
      <span class="flex size-1.5 rounded-full bg-lime shadow-[0_0_8px_#e7ff44]"></span>
      <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-lime/80">Siguiente paso</span>
      <span class="text-sm font-medium text-ink-0">{task.title}</span>
      <button
        type="button"
        onclick={onExit}
        class="ml-1 rounded-full border border-mist/30 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist transition-colors hover:border-lime/40 hover:text-lime"
      >
        Salir del foco
      </button>
    </div>
  </div>
{/if}