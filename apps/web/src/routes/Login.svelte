<script lang="ts">
  import { authLoginUrl } from "../lib/api";
</script>

<main class="min-h-screen flex items-center justify-center px-6">
  <div class="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-md p-8 space-y-6">
    <header>
      <h1 class="text-2xl font-bold">caleta</h1>
      <p class="text-slate-500 text-sm mt-1">
        Listas y tareas sincronizadas entre tus dispositivos.
      </p>
    </header>
    <a class="btn-primary w-full" href={authLoginUrl()}>
      Entrar con Google
    </a>
    <p class="text-xs text-slate-400 text-center">
      Hecho con Cloudflare Workers + D1 + Svelte 5. <br>
      <a class="underline" href="https://github.com/" target="_blank" rel="noopener">ver repo</a> · proyecto hobby
    </p>
  </div>
</main>
