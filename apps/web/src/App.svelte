<script lang="ts">
  import { onMount } from "svelte";
  import Router from "./lib/Router.svelte";
  import Route from "./lib/Route.svelte";
  import Login from "./routes/Login.svelte";
  import Callback from "./routes/Callback.svelte";
  import Home from "./routes/Home.svelte";
  import TaskList from "./routes/TaskList.svelte";
  import Mapa from "./routes/Mapa.svelte";
  import Calendario from "./routes/Calendario.svelte";
  import Configuracion from "./routes/Configuracion.svelte";
  import NavPlaceholder from "./routes/NavPlaceholder.svelte";
  import Sidebar from "./lib/ui/Sidebar.svelte";
  import BottomNav from "./lib/ui/BottomNav.svelte";
  import { isAuthenticated, getCurrentUser, clearSession } from "./lib/auth";
  import { api } from "./lib/api";
  import { navigate, router } from "./lib/router.svelte.ts";
  import { projectColor } from "./lib/ui/theme";
  import type { ApiList } from "./lib/types";

  let authed = $state(false);
  let authLoading = $state(true);
  let view = $state("lista");
  let lists = $state<ApiList[]>([]);
  let userEmail = $state("");

  async function refreshAuth() {
    const user = await getCurrentUser();
    authed = user !== null;
    userEmail = user?.email ?? "";
  }

  function selectView(v: string) {
    view = v;
    if (v === "mapa") {
      if (router.pathname !== "/mapa") navigate("/mapa");
    } else if (v === "calendario") {
      if (router.pathname !== "/calendario") navigate("/calendario");
    } else if (v === "configuracion") {
      if (router.pathname !== "/configuracion") navigate("/configuracion");
    } else {
      if (router.pathname !== "/") navigate("/");
    }
  }

  function selectProject(id: string) {
    view = "lista";
    navigate(`/lists/${id}`);
  }

  async function createProject(name: string) {
    try {
      const created = await api.createList(name);
      lists = [...lists, created];
    } catch {
      // feedback ausente — input se queda para retry
    }
  }

  function refreshLists() {
    void api.listLists().then((r) => (lists = r.lists));
  }

  const projectItems = $derived(
    lists.map((l) => ({ id: l.id, name: l.name, color: projectColor(l.name) })),
  );

  onMount(async () => {
    await refreshAuth();
    authLoading = false;
    if (authed) refreshLists();
    window.addEventListener("popstate", () => {
      void refreshAuth();
    });
    return () => window.removeEventListener("popstate", () => void refreshAuth());
  });
</script>

{#if authLoading}
  <main class="flex min-h-screen items-center justify-center px-6">
    <p class="font-mono text-xs text-mist/60">Cargando…</p>
  </main>
{:else if !authed}
  <Router>
    <Route path="/auth/callback" component={Callback} />
    <Route path="/" component={Login} />
  </Router>
{:else}
  <div class="relative flex min-h-screen overflow-hidden">
    <Sidebar
      active={view}
      projects={projectItems}
      userName={userEmail}
      onSelect={selectView}
      onProject={selectProject}
      onNew={() => {
        selectView("lista");
        navigate("/");
      }}
      onCreateProject={createProject}
      onLogout={async () => {
        await clearSession();
        authed = false;
        userEmail = "";
        navigate("/");
      }}
    />

    <div class="relative z-10 flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
      <Router>
        <Route path="/" component={Home} view={view} onViewChange={selectView} />
        <Route path="/mapa" component={Mapa} />
        <Route path="/calendario" component={Calendario} />
        <Route path="/configuracion" component={Configuracion} />
        <Route path="/lists/:id" component={TaskList} />
        <Route path="/nav/:id" component={NavPlaceholder} />
      </Router>
    </div>

    <BottomNav active={view} onSelect={selectView} />
  </div>
{/if}