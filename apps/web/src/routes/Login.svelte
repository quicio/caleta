<script lang="ts">
  import { authLoginUrl } from "../lib/auth";
  import Wordmark from "../lib/ui/Wordmark.svelte";
  import Icon from "../lib/ui/Icon.svelte";
</script>

<div class="relative flex min-h-screen items-center justify-center px-6">
  <div class="w-full max-w-sm space-y-8">
    <header class="space-y-4">
      <Wordmark size="lg" />
      <div>
        <p class="text-sm text-mist">Caleta de cosas por hacer.</p>
        <p class="mt-1 text-xs font-mono text-mist/50">
          Minimalista. Rápida. Hecha para el caos.
        </p>
      </div>
    </header>

    <div class="space-y-4 rounded-lg border border-surface-2/60 bg-surface p-6">
      <a
        class="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border border-surface-2 bg-surface-2 px-3 py-2.5 text-sm font-medium text-ink-0 transition-colors duration-150 hover:border-lime/40 hover:bg-surface-2/80"
        href={authLoginUrl()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.3 1.4-1.1 2.6-2.3 3.4v2.9h3.7c2.2-2 3.6-5 3.6-8.5z"/>
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2H1.1v3C3.2 21.2 7.3 24 12 24z"/>
          <path fill="#FBBC05" d="M4.9 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2v-3H1.1A12 12 0 0 0 0 12c0 2 .5 3.8 1.1 5.2l3.8-3z"/>
          <path fill="#EA4335" d="M12 4.6c1.8 0 3.3.6 4.6 1.8l3.3-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.8 1.1 6.8l3.8 3c1-3 3.8-5.2 7.1-5.2z"/>
        </svg>
        Entrar con Google
      </a>
      <p class="text-center text-[11px] font-mono text-mist/40">
        cloudflare workers · d1 · svelte 5
      </p>
    </div>

    <p class="text-center text-xs text-mist/40">
      <Icon name="list" size={12} class="mr-1 inline" />
      Tus tareas, sincronizadas entre tus dispositivos.
    </p>
  </div>
</div>
