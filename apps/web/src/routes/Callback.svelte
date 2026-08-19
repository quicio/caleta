<script lang="ts">
  import { onMount } from "svelte";
  import { setToken } from "../lib/auth";

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
      // Limpiamos el hash y navegamos a la raíz
      history.replaceState(null, "", "/");
      window.location.href = "/";
    } catch (e) {
      error = "Token inválido";
    }
  });
</script>

<main class="min-h-screen flex items-center justify-center">
  <div class="text-center space-y-4">
    <p class="text-slate-500">Procesando sesión...</p>
    {#if error}
      <p class="text-rose-600 text-sm">{error}</p>
      <a class="btn" href="/">volver</a>
    {/if}
  </div>
</main>
