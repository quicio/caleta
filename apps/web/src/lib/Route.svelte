<script lang="ts">
  import type { Component } from "svelte";
  import { router, matchPath } from "../lib/router.svelte.ts";

  let {
    path = "/",
    component,
    ...rest
  }: {
    path?: string;
    component?: Component<any>;
    [key: string]: unknown;
  } = $props();

  const matched = $derived(matchPath(path, router.pathname));
  const Comp = component as unknown as Component<{
    params: Record<string, string>;
    [key: string]: unknown;
  }> | undefined;
</script>

{#if matched !== null && Comp}
  <Comp params={matched} {...rest} />
{/if}
