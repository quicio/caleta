<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type {
    ApiGoal,
    ApiList,
    ApiRhythm,
    ApiRhythmEntry,
    ApiTask,
    TaskBucket,
  } from "../lib/types";
  import TaskRow from "../lib/ui/TaskRow.svelte";
  import EmptyState from "../lib/ui/EmptyState.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { projectColor, todayLabel, timeLabel } from "../lib/ui/theme";

  let {
    view,
    onViewChange,
  }: { view: string; onViewChange?: (v: string) => void } = $props();

  let lists = $state<ApiList[]>([]);
  let tasks = $state<ApiTask[]>([]);
  let goals = $state<ApiGoal[]>([]);
  let rhythms = $state<ApiRhythm[]>([]);
  let entries = $state<ApiRhythmEntry[]>([]);
  let loading = $state(true);
  let showQuick = $state(false);
  let newTitle = $state("");
  let newDue = $state("");
  let creating = $state(false);
  let showGoals = $state(true);
  let showRhythms = $state(true);

  // Goal inline form
  let newGoalTitle = $state("");
  let addingGoal = $state(false);
  let savingGoal = $state(false);

  // Rhythm inline form
  let newRhythmTitle = $state("");
  let newRhythmTarget = $state(3);
  let newRhythmMin = $state("");
  let addingRhythm = $state(false);
  let savingRhythm = $state(false);

  // Project editor (for goal assignment)
  let editingListId = $state<string | null>(null);

  async function refresh() {
    try {
      loading = true;
      const [l, sync, g, rh] = await Promise.all([
        api.listLists(),
        api.pullSync(null),
        api.listGoals(),
        api.listRhythms(),
      ]);
      lists = l.lists;
      tasks = sync.tasks.filter((x) => !x.deletedAt);
      goals = g.goals;
      rhythms = rh.rhythms;
      const entryLists = await Promise.all(rhythms.map((r) => api.listRhythmEntries(r.id)));
      entries = entryLists.flatMap((r) => r.entries);
    } finally {
      loading = false;
    }
  }

  async function createTask(e: SubmitEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    creating = true;
    try {
      const list = lists[0];
      if (!list) return;
      await api.createTask(list.id, newTitle.trim());
      newTitle = "";
      newDue = "";
      showQuick = false;
      await refresh();
    } finally {
      creating = false;
    }
  }

  async function toggleTask(t: ApiTask) {
    const updated = await api.patchTask(t.id, { completed: !t.completed });
    tasks = tasks.map((x) => (x.id === t.id ? updated : x));
  }

  async function removeTask(t: ApiTask) {
    await api.deleteTask(t.id);
    tasks = tasks.filter((x) => x.id !== t.id);
  }

  async function moveBucket(t: ApiTask, bucket: TaskBucket) {
    const updated = await api.patchTask(t.id, { bucket });
    tasks = tasks.map((x) => (x.id === t.id ? updated : x));
  }

  const listName = (id: string): string => lists.find((l) => l.id === id)?.name ?? "";

  // Secciones por bucket. "Hechos" = completadas (orden desc).
  const sectionNow = $derived(tasks.filter((t) => !t.completed && t.bucket === "now"));
  const sectionNext = $derived(tasks.filter((t) => !t.completed && t.bucket === "next"));
  const sectionSomeday = $derived(tasks.filter((t) => !t.completed && t.bucket === "someday"));
  const sectionDone = $derived(
    tasks.filter((t) => t.completed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  // Goals
  async function addGoal(e: SubmitEvent) {
    e.preventDefault();
    if (!newGoalTitle.trim() || savingGoal) return;
    savingGoal = true;
    try {
      const g = await api.createGoal({ title: newGoalTitle.trim() });
      goals = [...goals, g];
      newGoalTitle = "";
      addingGoal = false;
    } finally {
      savingGoal = false;
    }
  }

  async function removeGoal(g: ApiGoal) {
    await api.deleteGoal(g.id);
    goals = goals.filter((x) => x.id !== g.id);
    lists = lists.map((l) => (l.goalId === g.id ? { ...l, goalId: null } : l));
  }

  async function setGoalStatus(g: ApiGoal, status: ApiGoal["status"]) {
    const updated = await api.patchGoal(g.id, { status });
    goals = goals.map((x) => (x.id === g.id ? updated : x));
  }

  async function setListGoal(listId: string, goalId: string | null) {
    const updated = await api.patchList(listId, { goal_id: goalId });
    lists = lists.map((l) => (l.id === listId ? updated : l));
  }

  // Rhythms
  function todayDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function entriesInLast7Days(rhythmId: string): ApiRhythmEntry[] {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return entries.filter(
      (e) =>
        e.rhythmId === rhythmId &&
        e.kind !== "missed" &&
        now - new Date(e.date + "T12:00:00").getTime() <= sevenDays,
    );
  }

  function entryFor(rhythmId: string, date: string): ApiRhythmEntry | undefined {
    return entries.find((e) => e.rhythmId === rhythmId && e.date === date);
  }

  async function logRhythm(rhythmId: string, kind: "full" | "minimum" | "missed") {
    const date = todayDate();
    const entry = await api.logRhythmEntry(rhythmId, date, kind);
    const others = entries.filter((e) => !(e.rhythmId === rhythmId && e.date === date));
    entries = [...others, entry];
  }

  async function addRhythm(e: SubmitEvent) {
    e.preventDefault();
    if (!newRhythmTitle.trim() || savingRhythm) return;
    savingRhythm = true;
    try {
      const r = await api.createRhythm({
        title: newRhythmTitle.trim(),
        targetPerWeek: newRhythmTarget,
        minimum: newRhythmMin.trim() || null,
      });
      rhythms = [...rhythms, r];
      newRhythmTitle = "";
      newRhythmTarget = 3;
      newRhythmMin = "";
      addingRhythm = false;
    } finally {
      savingRhythm = false;
    }
  }

  async function removeRhythm(r: ApiRhythm) {
    await api.deleteRhythm(r.id);
    rhythms = rhythms.filter((x) => x.id !== r.id);
    entries = entries.filter((e) => e.rhythmId !== r.id);
  }

  function rhythmBar(r: ApiRhythm): string {
    const count = entriesInLast7Days(r.id).length;
    const total = Math.min(7, Math.max(1, r.targetPerWeek));
    const full = "█";
    const empty = "░";
    const filled = Math.min(count, total);
    return full.repeat(filled) + empty.repeat(total - filled) + `  ${Math.min(count, total)} / ${total}`;
  }

  onMount(refresh);
</script>

<main class="relative mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-7 lg:px-12 lg:pb-10 lg:pt-12">
  <header class="relative z-10 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75">Tu caleta</p>
      <h1 class="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">Hoy</h1>
      <p class="mt-2 font-mono text-[11px] tracking-wide text-mist">{todayLabel()}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="font-mono text-[11px] text-mist/75">
        {sectionNow.length + sectionNext.length + sectionSomeday.length} pendiente{(sectionNow.length + sectionNext.length + sectionSomeday.length) === 1 ? "" : "s"}
      </span>
      <button type="button" class="btn-primary" onclick={() => (showQuick = !showQuick)}>
        <Icon name="plus" size={14} strokeWidth={2} />
        Nueva tarea
      </button>
    </div>
  </header>

  {#if showQuick}
    <form onsubmit={createTask} class="panel relative z-10 mt-7 rounded-xl border border-surface-2 bg-surface p-4">
      <input
        class="input"
        placeholder="¿Qué tienes que hacer?"
        bind:value={newTitle}
        disabled={creating}
        autofocus
      />
      <div class="mt-2 flex items-center justify-between gap-2">
        <input
          type="datetime-local"
          class="input w-auto font-mono text-[11px]"
          bind:value={newDue}
          disabled={creating}
        />
        <button type="submit" class="btn-primary" disabled={creating || !newTitle.trim()}>
          Crear
        </button>
      </div>
    </form>
  {/if}

  <!-- Ahora -->
  <section class="panel relative z-10 mt-10 overflow-hidden rounded-xl border border-surface-2/70 bg-surface">
    <header class="flex items-baseline justify-between border-b border-surface-2/40 px-5 py-3">
      <h2 class="text-sm font-medium text-ink-0">Ahora</h2>
      <span class="font-mono text-[10px] text-mist/65">{sectionNow.length} tarea{sectionNow.length === 1 ? "" : "s"}</span>
    </header>
    {#if sectionNow.length === 0}
      <p class="px-5 py-6 text-center font-mono text-xs text-mist/40">Sin nada acá.</p>
    {:else}
      {#each sectionNow as t (t.id)}
        <TaskRow
          title={t.title}
          completed={t.completed}
          dueLabel={timeLabel(t.dueAt)}
          projectColor={projectColor(listName(t.listId))}
          listName={listName(t.listId)}
          onToggle={() => toggleTask(t)}
          onDelete={() => removeTask(t)}
        />
        <div class="flex items-center justify-end gap-1 border-b border-surface-2/30 bg-surface-2/20 px-5 py-1">
          <span class="font-mono text-[10px] text-mist/55">mover →</span>
          <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] text-mist hover:text-lime" onclick={() => moveBucket(t, "next")}>Próximo</button>
          <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] text-mist hover:text-lime" onclick={() => moveBucket(t, "someday")}>Algún día</button>
        </div>
      {/each}
    {/if}
  </section>

  <!-- Próximo -->
  <section class="panel relative z-10 mt-6 overflow-hidden rounded-xl border border-surface-2/60 bg-surface/85">
    <header class="flex items-baseline justify-between border-b border-surface-2/40 px-5 py-3">
      <h2 class="text-sm font-medium text-ink-0/90">Próximo</h2>
      <span class="font-mono text-[10px] text-mist/55">{sectionNext.length}</span>
    </header>
    {#if sectionNext.length === 0}
      <p class="px-5 py-5 text-center font-mono text-xs text-mist/35">Sin nada acá.</p>
    {:else}
      {#each sectionNext as t (t.id)}
        <TaskRow
          title={t.title}
          completed={t.completed}
          dueLabel={timeLabel(t.dueAt)}
          projectColor={projectColor(listName(t.listId))}
          listName={listName(t.listId)}
          onToggle={() => toggleTask(t)}
          onDelete={() => removeTask(t)}
        />
        <div class="flex items-center justify-end gap-1 border-b border-surface-2/30 bg-surface-2/15 px-5 py-1">
          <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] text-mist hover:text-lime" onclick={() => moveBucket(t, "now")}>Ahora</button>
          <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] text-mist hover:text-lime" onclick={() => moveBucket(t, "someday")}>Algún día</button>
        </div>
      {/each}
    {/if}
  </section>

  <!-- Ritmos -->
  <section class="panel relative z-10 mt-6 overflow-hidden rounded-xl border border-surface-2/55 bg-surface/70">
    <header class="flex items-baseline justify-between border-b border-surface-2/40 px-5 py-3">
      <button type="button" class="font-mono text-[10px] uppercase tracking-[0.18em] text-lime/75" onclick={() => (showRhythms = !showRhythms)}>
        Ritmos {showRhythms ? "−" : "+"}
      </button>
      <span class="font-mono text-[10px] text-mist/55">{rhythms.length}</span>
    </header>
    {#if showRhythms}
      <div class="px-5 py-4 space-y-4">
        {#if rhythms.length === 0}
          <p class="font-mono text-xs text-mist/40">Sin ritmos todavía.</p>
        {:else}
          {#each rhythms as r (r.id)}
            {@const today = entryFor(r.id, todayDate())}
            <div class="space-y-1.5">
              <div class="flex items-baseline justify-between gap-2">
                <p class="text-sm text-ink-0">{r.title}</p>
                <button type="button" class="font-mono text-[10px] text-mist/50 hover:text-rose-400" onclick={() => removeRhythm(r)}>quitar</button>
              </div>
              <p class="font-mono text-[11px] text-mist/80">{rhythmBar(r)}</p>
              {#if r.minimum}
                <p class="font-mono text-[10px] text-mist/45">mínimo: {r.minimum}</p>
              {/if}
              <div class="flex items-center gap-1 pt-1">
                <span class="font-mono text-[10px] text-mist/55">hoy →</span>
                <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] {today?.kind === 'full' ? 'bg-lime/20 text-lime' : 'text-mist hover:text-lime'}" onclick={() => logRhythm(r.id, "full")}>FULL</button>
                <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] {today?.kind === 'minimum' ? 'bg-lime/15 text-lime/80' : 'text-mist hover:text-lime'}" onclick={() => logRhythm(r.id, "minimum")}>MINIMUM</button>
                <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] {today?.kind === 'missed' ? 'bg-rose-900/30 text-rose-300' : 'text-mist hover:text-rose-300'}" onclick={() => logRhythm(r.id, "missed")}>MISSED</button>
              </div>
            </div>
          {/each}
        {/if}
        {#if addingRhythm}
          <form onsubmit={addRhythm} class="space-y-1.5 rounded-md border border-surface-2/60 bg-surface-2/30 p-3">
            <input class="input py-1 text-xs" placeholder="Ej: Entrenar" bind:value={newRhythmTitle} autofocus disabled={savingRhythm} />
            <div class="flex items-center gap-2">
              <label class="font-mono text-[10px] text-mist/65">por semana</label>
              <input type="number" min="1" max="14" class="input w-16 py-1 font-mono text-xs" bind:value={newRhythmTarget} disabled={savingRhythm} />
              <input class="input flex-1 py-1 font-mono text-[11px]" placeholder="mínimo (opcional)" bind:value={newRhythmMin} disabled={savingRhythm} />
            </div>
            <div class="flex justify-end gap-1.5">
              <button type="button" class="rounded px-2 py-1 font-mono text-[10px] text-mist hover:text-ink-0" onclick={() => (addingRhythm = false)} disabled={savingRhythm}>cancelar</button>
              <button type="submit" class="rounded border border-lime bg-lime px-2 py-1 font-mono text-[10px] font-medium text-ink hover:bg-lime/90 disabled:opacity-40" disabled={savingRhythm || !newRhythmTitle.trim()}>crear</button>
            </div>
          </form>
        {:else}
          <button type="button" class="font-mono text-[10px] text-mist/55 hover:text-lime" onclick={() => (addingRhythm = true)}>+ nuevo ritmo</button>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Algún día -->
  <section class="panel relative z-10 mt-6 overflow-hidden rounded-xl border border-surface-2/50 bg-surface/55">
    <header class="flex items-baseline justify-between border-b border-surface-2/40 px-5 py-3">
      <h2 class="text-sm font-medium text-ink-0/80">Algún día</h2>
      <span class="font-mono text-[10px] text-mist/45">{sectionSomeday.length}</span>
    </header>
    {#if sectionSomeday.length === 0}
      <p class="px-5 py-5 text-center font-mono text-xs text-mist/30">Sin nada acá.</p>
    {:else}
      {#each sectionSomeday as t (t.id)}
        <TaskRow
          title={t.title}
          completed={t.completed}
          dueLabel={timeLabel(t.dueAt)}
          projectColor={projectColor(listName(t.listId))}
          listName={listName(t.listId)}
          onToggle={() => toggleTask(t)}
          onDelete={() => removeTask(t)}
        />
        <div class="flex items-center justify-end gap-1 border-b border-surface-2/25 bg-surface-2/10 px-5 py-1">
          <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] text-mist hover:text-lime" onclick={() => moveBucket(t, "now")}>Ahora</button>
          <button type="button" class="rounded px-2 py-0.5 font-mono text-[10px] text-mist hover:text-lime" onclick={() => moveBucket(t, "next")}>Próximo</button>
        </div>
      {/each}
    {/if}
  </section>

  <!-- Objetivos -->
  <section class="panel relative z-10 mt-6 overflow-hidden rounded-xl border border-surface-2/45 bg-surface/45">
    <header class="flex items-baseline justify-between border-b border-surface-2/35 px-5 py-3">
      <button type="button" class="font-mono text-[10px] uppercase tracking-[0.18em] text-lime/65" onclick={() => (showGoals = !showGoals)}>
        Objetivos {showGoals ? "−" : "+"}
      </button>
      <span class="font-mono text-[10px] text-mist/45">{goals.length}</span>
    </header>
    {#if showGoals}
      <div class="px-5 py-4 space-y-3">
        {#if goals.length === 0}
          <p class="font-mono text-xs text-mist/35">Sin objetivos todavía.</p>
        {:else}
          {#each goals as g (g.id)}
            <div class="space-y-1.5">
              <div class="flex items-baseline justify-between gap-2">
                <p class="text-sm {g.status === 'done' ? 'text-mist line-through' : g.status === 'abandoned' ? 'text-mist/50 line-through' : 'text-ink-0'}">{g.title}</p>
                <div class="flex items-center gap-1.5">
                  {#if g.status === 'active'}
                    <button type="button" class="rounded font-mono text-[10px] text-mist/60 hover:text-lime" onclick={() => setGoalStatus(g, 'done')}>logrado</button>
                  {:else}
                    <button type="button" class="rounded font-mono text-[10px] text-mist/60 hover:text-lime" onclick={() => setGoalStatus(g, 'active')}>reabrir</button>
                  {/if}
                  <button type="button" class="font-mono text-[10px] text-mist/50 hover:text-rose-400" onclick={() => removeGoal(g)}>quitar</button>
                </div>
              </div>
              {#if g.description}
                <p class="font-mono text-[11px] text-mist/65">{g.description}</p>
              {/if}
              <p class="font-mono text-[10px] text-mist/40">
                {lists.filter((l) => l.goalId === g.id).length} proyecto{lists.filter((l) => l.goalId === g.id).length === 1 ? "" : "s"} asociado{lists.filter((l) => l.goalId === g.id).length === 1 ? "" : "s"}
              </p>
            </div>
          {/each}
        {/if}

        {#if addingGoal}
          <form onsubmit={addGoal} class="space-y-1.5 rounded-md border border-surface-2/60 bg-surface-2/30 p-3">
            <input class="input py-1 text-xs" placeholder="Ej: Terminar Caleta" bind:value={newGoalTitle} autofocus disabled={savingGoal} />
            <div class="flex justify-end gap-1.5">
              <button type="button" class="rounded px-2 py-1 font-mono text-[10px] text-mist hover:text-ink-0" onclick={() => (addingGoal = false)} disabled={savingGoal}>cancelar</button>
              <button type="submit" class="rounded border border-lime bg-lime px-2 py-1 font-mono text-[10px] font-medium text-ink hover:bg-lime/90 disabled:opacity-40" disabled={savingGoal || !newGoalTitle.trim()}>crear</button>
            </div>
          </form>
        {:else}
          <button type="button" class="font-mono text-[10px] text-mist/55 hover:text-lime" onclick={() => (addingGoal = true)}>+ nuevo objetivo</button>
        {/if}

        {#if lists.length > 0}
          <div class="mt-4 space-y-2 border-t border-surface-2/30 pt-3">
            <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/55">Asignar proyectos a objetivos</p>
            {#each lists as l (l.id)}
              <div class="flex items-center gap-2 text-xs">
                <span class="size-1.5 shrink-0 rounded-full" style={`background-color:${projectColor(l.name)}`}></span>
                <span class="min-w-0 flex-1 truncate text-ink-0">{l.name}</span>
                <select
                  class="rounded border border-surface-2/60 bg-surface-2/40 px-2 py-0.5 font-mono text-[10px] text-mist"
                  value={l.goalId ?? ""}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value;
                    setListGoal(l.id, v === "" ? null : v);
                  }}
                >
                  <option value="">— sin objetivo</option>
                  {#each goals.filter((g) => g.status === 'active') as g (g.id)}
                    <option value={g.id}>{g.title}</option>
                  {/each}
                </select>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Hechos -->
  <section class="panel relative z-10 mt-6 overflow-hidden rounded-xl border border-surface-2/40 bg-surface/35">
    <header class="flex items-baseline justify-between border-b border-surface-2/35 px-5 py-3">
      <h2 class="text-sm font-medium text-mist/70">Hechos</h2>
      <span class="font-mono text-[10px] text-mist/40">{sectionDone.length}</span>
    </header>
    {#if sectionDone.length === 0}
      <p class="px-5 py-5 text-center font-mono text-xs text-mist/30">Sin nada acá.</p>
    {:else}
      <div class="opacity-60">
        {#each sectionDone as t (t.id)}
          <TaskRow
            title={t.title}
            completed={t.completed}
            dueLabel={timeLabel(t.dueAt)}
            projectColor={projectColor(listName(t.listId))}
            listName={listName(t.listId)}
            onToggle={() => toggleTask(t)}
            onDelete={() => removeTask(t)}
          />
        {/each}
      </div>
    {/if}
  </section>
</main>