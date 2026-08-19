<script lang="ts">
  import { onMount } from "svelte";
  import { setToken } from "../lib/auth";
  import Wordmark from "../lib/ui/Wordmark.svelte";

  let error = $state<string | null>(null);

  onMount(() => {
    const hash = window.location.hash ?? "";
    const m = hash.match(/token=([^&]+)/);
    if (!m) {
      error = "No se recibió token en el callback.";
      return;
    }
    try {
      const token = decodeURIComponent(m[1]);
      setToken(token);
      history.replaceState(null, "", "/");
      window.location.href = "/";
    } catch {
      error = "Token inválido";
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
