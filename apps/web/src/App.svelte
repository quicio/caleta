<script lang="ts">
  import { onMount } from "svelte";
  import Router from "./lib/Router.svelte";
  import Route from "./lib/Route.svelte";
  import Login from "./routes/Login.svelte";
  import Callback from "./routes/Callback.svelte";
  import Home from "./routes/Home.svelte";
  import TaskList from "./routes/TaskList.svelte";
  import NavPlaceholder from "./routes/NavPlaceholder.svelte";
  import Sidebar from "./lib/ui/Sidebar.svelte";
  import BottomNav from "./lib/ui/BottomNav.svelte";
  import Tabs from "./lib/ui/Tabs.svelte";
  import { isAuthenticated, getCurrentUser, clearSession } from "./lib/auth";
  import { api } from "./lib/api";
  import { navigate, router } from "./lib/router.svelte.ts";
  import { projectColor } from "./lib/ui/theme";
  import type { ApiList } from "./lib/types";

  let authed = $state(false);
  let authLoading = $state(true);
  let view = $state("today");
  let mobileNav = $state("tasks");
  let lists = $state<ApiList[]>([]);
  let userEmail = $state("");

  async function refreshAuth() {
    const user = await getCurrentUser();
    authed = user !== null;
    userEmail = user?.email ?? "";
  }

  function selectView(v: string) {
    view = v;
    if (router.pathname !== "/") navigate("/");
  }

  function selectProject(id: string) {
    navigate(`/lists/${id}`);
  }

  function selectMobileNav(v: string) {
    mobileNav = v;
    if (v === "tasks") {
      if (router.pathname !== "/") navigate("/");
    } else {
      navigate(`/nav/${v}`);
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
        selectView("today");
        navigate("/");
      }}
      onLogout={async () => {
        await clearSession();
        authed = false;
        userEmail = "";
        navigate("/");
      }}
    />

    <div class="relative z-10 flex min-w-0 flex-1 flex-col">
      <Tabs active={view} onSelect={selectView} />
      <Router>
        <Route path="/" component={Home} view={view} onViewChange={selectView} />
        <Route path="/lists/:id" component={TaskList} />
        <Route path="/nav/:id" component={NavPlaceholder} />
      </Router>
    </div>

    <BottomNav active={mobileNav} onSelect={selectMobileNav} />
  </div>
{/if}