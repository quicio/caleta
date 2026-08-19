<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import { getCurrentUser, invalidateAuthCache } from "../lib/auth";
  import Wordmark from "../lib/ui/Wordmark.svelte";

  let error = $state<string | null>(null);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      error = "No se recibió code en el callback.";
      return;
    }
    try {
      await api.exchange(code);
      invalidateAuthCache();
      await getCurrentUser(); // prefill
      history.replaceState(null, "", "/");
      window.location.href = "/";
    } catch (e) {
      error = e instanceof Error ? e.message : "Exchange failed";
    }
  });
</script>

<main class="flex min-h-screen items-center justify-center px-6">
  <div class="w-full max-w-sm space-y-6 text-center">
    <Wordmark />
    {#if error}
      <p class="text-sm text-rose-400">{error}</p>
      <a class="btn" href="/">volver</a>
    {:else}
      <p class="font-mono text-xs text-mist/60">Procesando sesión…</p>
    {/if}
  </div>
</main>