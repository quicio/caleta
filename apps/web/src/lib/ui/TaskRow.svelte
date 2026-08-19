<script lang="ts">
  import Checkbox from "./Checkbox.svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    completed = false,
    dueLabel = "",
    projectColor = "",
    important = false,
    listName = "",
    onToggle,
    onDelete,
  }: {
    title: string;
    completed?: boolean;
    dueLabel?: string;
    projectColor?: string;
    important?: boolean;
    listName?: string;
    onToggle?: () => void;
    onDelete?: () => void;
  } = $props();

  let hovering = $state(false);
</script>

<div
  class="group flex items-center gap-3 border-b border-surface-2/60 px-3 py-3 transition-colors duration-150 hover:bg-surface/70"
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <Checkbox
    checked={completed}
    disabled={!onToggle}
    onclick={onToggle}
  />

  <div class="flex min-w-0 flex-1 items-center gap-2.5">
    {#if projectColor}
      <span class="size-2 shrink-0 rounded-full" style={`background-color:${projectColor}`} />
    {/if}
    <span
      class="truncate text-sm transition-colors duration-150 {completed
        ? 'text-mist line-through decoration-mist/40'
        : 'text-ink-0'}"
    >
      {title}
    </span>
    {#if listName}
      <span class="hidden shrink-0 text-[11px] text-mist/60 sm:inline">{listName}</span>
    {/if}
    {#if important}
      <Icon name="star" size={12} class="shrink-0 text-lime" strokeWidth={2} />
    {/if}
  </div>

  {#if dueLabel}
    <span class="font-mono text-[11px] text-mist/70 tabular-nums">{dueLabel}</span>
  {/if}

  <div
    class="flex items-center gap-0.5 transition-opacity duration-150 {hovering
      ? 'opacity-100'
      : 'opacity-0'}"
  >
    {#if onDelete}
      <button
        type="button"
        class="rounded p-1 text-mist/50 hover:bg-surface-2 hover:text-rose-400"
        onclick={onDelete}
        aria-label="Borrar tarea"
      >
        <Icon name="close" size={14} />
      </button>
    {/if}
  </div>
</div>
