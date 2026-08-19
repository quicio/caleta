<script lang="ts">
  import type { Component } from "svelte";
  import { router, matchPath } from "../lib/router.svelte";

  let { path = "/", component }: { path?: string; component?: Component<any> } =
    $props();

  const matched = $derived(matchPath(path, router.pathname));
  const Comp = component as unknown as Component<{
    params: Record<string, string>;
  }> | undefined;
</script>

{#if matched !== null && Comp}
  <Comp params={matched} />
{/if}
