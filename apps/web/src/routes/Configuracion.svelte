<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import { authLoginUrl } from "../lib/auth";
  import Icon from "../lib/ui/Icon.svelte";

  type GcalCalendar = { id: string; summary: string };

  let loading = $state(true);
  let calendars = $state<GcalCalendar[] | null>(null);
  let selected = $state<string[]>([]);
  let notConnected = $state(false);
  let saving = $state(false);
  let saved = $state(false);

  async function load() {
    loading = true;
    saved = false;
    try {
      const res = await api.getSettings();
      calendars = res.calendars;
      selected = Array.isArray(res.settings?.selectedCalendars)
        ? res.settings!.selectedCalendars!
        : [];
      notConnected = res.calendars === null;
    } finally {
      loading = false;
    }
  }

  function isChecked(id: string): boolean {
    return selected.includes(id);
  }

  async function toggle(id: string) {
    const next = isChecked(id) ? selected.filter((s) => s !== id) : [...selected, id];
    selected = next;
    saving = true;
    saved = false;
    try {
      await api.updateSettings({ selectedCalendars: next });
      saved = true;
    } finally {
      saving = false;
    }
  }

  onMount(load);
</script>

<main class="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-7 lg:px-8 lg:pb-10 lg:pt-10">
  <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75">Preferencias</p>
      <h1 class="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">Configuración</h1>
    </div>
    {#if saving}
      <p class="font-mono text-[11px] text-mist/60">Guardando…</p>
    {:else if saved}
      <p class="font-mono text-[11px] text-lime/80">Guardado ✓</p>
    {/if}
  </header>

  {#if loading}
    <p class="pt-16 text-center font-mono text-xs text-mist/50">Cargando…</p>
  {:else}
    <section class="panel rounded-xl border border-surface-2/70 bg-surface p-6">
      <div class="mb-4 flex items-center gap-2.5">
        <Icon name="calendar" size={16} />
        <h2 class="text-sm font-medium text-ink-0">Calendario de Google</h2>
      </div>

      {#if notConnected}
        <p class="text-sm text-ink-0">Google Calendar no está conectado.</p>
        <p class="mt-2 text-xs text-mist">
          Conectalo para elegir qué calendarios mostrar en la vista Calendario.
        </p>
        <a class="btn-primary mt-5 inline-flex" href={authLoginUrl()}>Conectar Google</a>
      {:else}
        <p class="mb-4 text-xs text-mist">
          Elegí qué calendarios aparecen en la vista Calendario. Sin marcar ninguno, se muestran todos.
        </p>
        {#if calendars && calendars.length === 0}
          <p class="font-mono text-xs text-mist/40">No hay calendarios disponibles.</p>
        {:else}
          <ul class="space-y-1.5">
            {#each calendars ?? [] as cal (cal.id)}
              <li>
                <label class="flex cursor-pointer items-center gap-3 rounded-md border border-surface-2/50 bg-surface-2/30 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked(cal.id)}
                    onclick={(e) => toggle(cal.id)}
                    class="size-4 accent-lime"
                  />
                  <span class="min-w-0 truncate text-sm text-ink-0">{cal.summary}</span>
                </label>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </section>
  {/if}
</main>
