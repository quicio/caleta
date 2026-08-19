<script lang="ts">
  import Router from "./lib/Router.svelte";
  import Route from "./lib/Route.svelte";
  import Login from "./routes/Login.svelte";
  import Callback from "./routes/Callback.svelte";
  import Lists from "./routes/Lists.svelte";
  import TaskList from "./routes/TaskList.svelte";
  import { isAuthenticated } from "./lib/auth";

  let authed = $state(isAuthenticated());

  function onAuthChange() {
    authed = isAuthenticated();
  }

  if (typeof window !== "undefined") {
    // Re-evaluamos auth cuando cambia la URL (callback pone el token).
    window.addEventListener("popstate", onAuthChange);
  }
</script>

<Router>
  {#if authed}
    <Route path="/" component={Lists} />
    <Route path="/lists/:id" component={TaskList} />
  {:else}
    <Route path="/auth/callback" component={Callback} />
    <Route path="/" component={Login} />
  {/if}
</Router>
