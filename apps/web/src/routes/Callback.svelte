<script lang="ts">
  import { onMount } from "svelte";
  import { setTokens } from "../lib/auth";
  import Wordmark from "../lib/ui/Wordmark.svelte";

  let error = $state<string | null>(null);

  onMount(() => {
    const hash = window.location.hash ?? "";
    // Soporta dos formatos:
    //   Nuevo: #access=<jwt>&refresh=<jwt>&exp=<unix>
    //   Legacy: #token=<jwt>   (sólo access, sin refresh — se aceptará hasta expirar)
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const access = params.get("access") ?? params.get("token");
    const refresh = params.get("refresh") ?? null;
    const expStr = params.get("exp");
    if (!access) {
      error = "No se recibieron tokens en el callback.";
      return;
    }
    try {
      const exp = expStr ? parseInt(expStr, 10) : Math.floor(Date.now() / 1000) + 3600;
      setTokens({ access, refresh: refresh ?? undefined, exp });
      history.replaceState(null, "", "/");
      window.location.href = "/";
    } catch {
      error = "Tokens inválidos";
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