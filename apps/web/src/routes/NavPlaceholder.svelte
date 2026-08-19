<script lang="ts">
  import EmptyState from "../lib/ui/EmptyState.svelte";
  import { navigate } from "../lib/router.svelte.ts";

  let { params }: { params: { id: string } } = $props();

  const labelMap: Record<string, string> = {
    calendar: "Calendario",
    activity: "Actividad",
    settings: "Ajustes",
  };

  const title = $derived(labelMap[params.id] ?? "Vista");
</script>

<main class="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-8">
  <h1 class="text-3xl font-bold tracking-tight">{title}</h1>
  <EmptyState
    title={`{title} llegará pronto.`}
    copy="Esta vista forma parte del diseño; la funcionalidad llega en un cambio futuro."
  >
    {#snippet action()}
      <button type="button" class="btn" onclick={() => navigate("/")}>Volver a tareas</button>
    {/snippet}
  </EmptyState>
</main>
