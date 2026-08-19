<script lang="ts">
  import { onMount } from "svelte";
  import { initRouter } from "../lib/router.svelte.ts";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  onMount(initRouter);
</script>

{@render children()}
