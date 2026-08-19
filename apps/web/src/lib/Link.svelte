<script lang="ts">
  import type { Snippet } from "svelte";
  import { navigate } from "../lib/router.svelte.ts";

  let {
    to,
    children,
    ...rest
  }: {
    to: string;
    children: Snippet;
    [key: string]: unknown;
  } = $props();

  function onClick(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  }
</script>

<a href={to} onclick={onClick} {...rest}>
  {@render children()}
</a>
