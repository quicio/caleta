<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    copy,
    action,
  }: { title: string; copy: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-5 py-10 text-center sm:py-14">
  <img src="/images/lighthouse-empty-state.png" alt="Ilustración nocturna de un faro" class="h-36 w-full object-contain sm:h-44" />

  <div class="space-y-1.5">
    <h2 class="text-base font-medium text-ink-0">{title}</h2>
    <p class="text-sm text-mist">{copy}</p>
  </div>

  {#if action}
    {@render action()}
  {/if}
</div>
