<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError } from "../lib/api";
  import { authLoginUrl } from "../lib/auth";

  type CalEvent = {
    id: string;
    summary: string;
    start: { iso: string; timeZone?: string };
    end: { iso: string; timeZone?: string };
    allDay: boolean;
    location: string | null;
    htmlLink: string | null;
    hangoutLink: string | null;
  };

  let events = $state<CalEvent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let rangeStart = $state(startOfDay(new Date()));
  const RANGE_DAYS = 7;

  function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  const rangeEnd = $derived(addDays(rangeStart, RANGE_DAYS));

  const rangeLabel = $derived.by(() => {
    const sameMonth = rangeStart.getMonth() === addDays(rangeStart, RANGE_DAYS - 1).getMonth();
    const sameYear = rangeStart.getFullYear() === new Date().getFullYear();
    const fmtShort = (d: Date) =>
      d
        .toLocaleDateString("es-AR", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })
        .replace(/^\w/, (c) => c.toUpperCase());
    if (sameMonth) {
      const last = addDays(rangeStart, RANGE_DAYS - 1);
      return `${rangeStart.getDate()}–${last.getDate()} ${fmtShort(rangeStart).split(" ")[1]}`;
    }
    return `${fmtShort(rangeStart)} — ${fmtShort(addDays(rangeStart, RANGE_DAYS - 1))}`;
  });

  const today = startOfDay(new Date());

  const days = $derived.by(() => {
    const out: { date: Date; events: CalEvent[] }[] = [];
    for (let i = 0; i < RANGE_DAYS; i++) {
      const d = addDays(rangeStart, i);
      const dayStart = startOfDay(d);
      const dayEnd = addDays(dayStart, 1);
      const dayEvents = events
        .filter((e) => {
          const s = new Date(e.start.iso);
          return s >= dayStart && s < dayEnd;
        })
        .sort((a, b) => a.start.iso.localeCompare(b.start.iso));
      out.push({ date: d, events: dayEvents });
    }
    return out;
  });

  async function refresh() {
    try {
      loading = true;
      error = null;
      const from = rangeStart.toISOString();
      const to = rangeEnd.toISOString();
      const res = await api.listCalendarEvents(from, to);
      events = res.events;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const body = (e.body as { error?: string } | null)?.error;
        error =
          body === "calendar_scope_missing"
            ? "scope_missing"
            : body === "calendar_api_not_configured"
              ? "api_not_configured"
              : "not_connected";
      } else if (e instanceof ApiError && e.status === 401) {
        error = "reauth_required";
      } else {
        error = "fetch_failed";
      }
    } finally {
      loading = false;
    }
  }

  function prev() {
    rangeStart = addDays(rangeStart, -RANGE_DAYS);
    void refresh();
  }
  function next() {
    rangeStart = addDays(rangeStart, RANGE_DAYS);
    void refresh();
  }
  function gotoToday() {
    rangeStart = startOfDay(new Date());
    void refresh();
  }

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDayHeader(d: Date): string {
    const isToday = d.getTime() === today.getTime();
    const label = d
      .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
      .replace(/^\w/, (c) => c.toUpperCase());
    return isToday ? `Hoy · ${label}` : label;
  }

  onMount(refresh);
</script>

<main class="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-7 lg:px-8 lg:pb-10 lg:pt-10">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75">Google Calendar</p>
      <h1 class="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">{rangeLabel}</h1>
      <p class="mt-2 font-mono text-[11px] tracking-wide text-mist">Calendario primario · solo lectura</p>
    </div>
    <div class="flex items-center gap-2">
      <button type="button" class="btn" onclick={prev} aria-label="Semana anterior">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button type="button" class="btn" onclick={gotoToday}>hoy</button>
      <button type="button" class="btn" onclick={next} aria-label="Semana siguiente">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>
  </header>

  {#if error === "not_connected"}
    <section class="panel mt-8 rounded-xl border border-surface-2/70 bg-surface p-6 text-center">
      <p class="text-sm text-ink-0">Google Calendar no está conectado.</p>
      <p class="mt-2 text-xs text-mist">
        Tu sesión actual no incluye el permiso de lectura del calendario. Reconectá para habilitar esta vista.
      </p>
      <a
        class="btn-primary mt-5 inline-flex"
        href={authLoginUrl()}
      >
        Reconectar Google
      </a>
    </section>
  {:else if error === "scope_missing"}
    <section class="panel mt-8 rounded-xl border border-rose-900/50 bg-surface p-6 text-center">
      <p class="text-sm text-ink-0">Tu sesión anterior no incluye permiso de lectura del calendario.</p>
      <p class="mt-2 text-xs text-mist">Volvé a conectar para otorgar el nuevo permiso.</p>
      <a class="btn-primary mt-5 inline-flex" href={authLoginUrl()}>Reconectar Google</a>
    </section>
  {:else if error === "api_not_configured"}
    <section class="panel mt-8 rounded-xl border border-rose-900/50 bg-surface p-6 text-center">
      <p class="text-sm text-ink-0">La Google Calendar API no está habilitada.</p>
      <p class="mt-2 text-xs text-mist">
        El proyecto de Google Cloud de este OAuth client no tiene activa la Calendar API.
        Activala en la consola y volvé a intentar (no alcanza con reconectar).
      </p>
      <button type="button" class="btn mt-5" onclick={refresh}>Reintentar</button>
    </section>
  {:else if error === "reauth_required"}
    <section class="panel mt-8 rounded-xl border border-rose-900/50 bg-surface p-6 text-center">
      <p class="text-sm text-ink-0">Google revocó el acceso.</p>
      <p class="mt-2 text-xs text-mist">Volvé a autorizar para seguir leyendo tu calendario.</p>
      <a class="btn-primary mt-5 inline-flex" href={authLoginUrl()}>Reconectar Google</a>
    </section>
  {:else if error === "fetch_failed"}
    <section class="panel mt-8 rounded-xl border border-surface-2/70 bg-surface p-6 text-center">
      <p class="text-sm text-ink-0">No pudimos leer tu calendario.</p>
      <p class="mt-2 text-xs text-mist">Probá de nuevo en un momento.</p>
      <button type="button" class="btn mt-5" onclick={refresh}>Reintentar</button>
    </section>
  {:else if loading && events.length === 0}
    <p class="pt-16 text-center font-mono text-xs text-mist/50">Cargando eventos…</p>
  {:else}
    <div class="mt-7 space-y-6">
      {#each days as day (day.date.toISOString())}
        <section class="panel rounded-xl border border-surface-2/60 bg-surface/70 p-5">
          <header class="mb-3 flex items-baseline justify-between">
            <h2 class="text-sm font-medium text-ink-0">{fmtDayHeader(day.date)}</h2>
            <span class="font-mono text-[10px] text-mist/55">
              {day.events.length} evento{day.events.length === 1 ? "" : "s"}
            </span>
          </header>
          {#if day.events.length === 0}
            <p class="font-mono text-xs text-mist/40">Sin eventos.</p>
          {:else}
            <ul class="space-y-1.5">
              {#each day.events as ev (ev.id)}
                <li class="flex items-start gap-3 rounded-md border border-surface-2/50 bg-surface-2/30 px-3 py-2.5">
                  <span class="w-14 shrink-0 font-mono text-[11px] text-mist/85 tabular-nums">
                    {#if ev.allDay}
                      todo el día
                    {:else}
                      {fmtTime(ev.start.iso)}
                    {/if}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm text-ink-0">{ev.summary}</p>
                    {#if ev.location}
                      <p class="mt-0.5 truncate font-mono text-[11px] text-mist/65">
                        {ev.location}
                      </p>
                    {/if}
                  </div>
                  {#if ev.htmlLink}
                    <a
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="rounded p-1 text-mist/55 transition-colors hover:bg-surface-2 hover:text-lime"
                      aria-label="Abrir en Google Calendar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7M21 3l-9 9M10 21H3v-7M3 21l9-9" /></svg>
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</main>