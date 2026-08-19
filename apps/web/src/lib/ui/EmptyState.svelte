<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    copy,
    action,
  }: { title: string; copy: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-5 py-16 text-center">
  <svg
    width="120"
    height="90"
    viewBox="0 0 120 90"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    class="opacity-90"
  >
    <!-- luna -->
    <circle cx="24" cy="20" r="7" fill="#1A2023" />
    <!-- faro -->
    <rect x="54" y="34" width="10" height="4" rx="1" fill="#A1A1AA" />
    <rect x="50" y="36" width="18" height="3" rx="1" fill="#121719" stroke="#1A2023" />
    <rect x="52" y="38" width="14" height="30" rx="2" fill="#121719" stroke="#1A2023" />
    <!-- luz del faro -->
    <path d="M56 40 L40 60" stroke="#E7FF44" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
    <path d="M62 40 L78 60" stroke="#E7FF44" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
    <!-- base / roca -->
    <path d="M42 68 H76" stroke="#1A2023" stroke-width="1.5" stroke-linecap="round" />
    <!-- agua -->
    <path d="M0 74 C 20 70, 30 78, 50 74 S 80 70, 120 74" stroke="#1A2023" stroke-width="1.5" stroke-linecap="round" />
    <path d="M0 80 C 25 76, 40 84, 65 80 S 95 76, 120 80" stroke="#1A2023" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
    <!-- pajaros -->
    <path d="M30 30 q4 -3 8 0 M90 24 q4 -3 8 0" stroke="#A1A1AA" stroke-width="1" stroke-linecap="round" opacity="0.5" />
  </svg>

  <div class="space-y-1.5">
    <h2 class="text-base font-medium text-ink-0">{title}</h2>
    <p class="text-sm text-mist">{copy}</p>
  </div>

  {#if action}
    {@render action()}
  {/if}
</div>
