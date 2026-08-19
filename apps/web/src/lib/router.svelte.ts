// Mini-router con runes de Svelte 5. Sin dependencias.
// Reemplaza a svelte-routing (v2, incompatible con Svelte 5).

export const router = $state({
  pathname: typeof window !== "undefined" ? window.location.pathname : "/",
  params: {} as Record<string, string>,
});

let initialized = false;

export function initRouter(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("popstate", () => {
    router.pathname = window.location.pathname;
  });
}

export function navigate(to: string): void {
  window.history.pushState({}, "", to);
  router.pathname = to;
}

export function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const pp = pattern.split("/").filter(Boolean);
  const p = path.split("/").filter(Boolean);
  if (pp.length !== p.length) return null;
  const m: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) m[pp[i].slice(1)] = decodeURIComponent(p[i]);
    else if (pp[i] !== p[i]) return null;
  }
  return m;
}
