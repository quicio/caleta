# Tasks — feature-mapa-view

## 1. Restructurar el switcher top-level

- [x] 1.1 Cambiar `Sidebar.views` y `Tabs.tabs` de `[Hoy, Próximos, Algún día, Hechos]` a `[Lista, Calendario, Mapa]`.
- [x] 1.2 Mover los filtros temporales (Hoy / Próximos / Algún día / Hechos) dentro de la vista Lista como un sub-switcher.
- [x] 1.3 Crear `apps/web/src/lib/ui/TopBar.svelte` (switcher + search + filters + zoom + Nueva tarea) usado por Mapa.
- [x] 1.4 En `App.svelte`: agregar rutas `/mapa` (Mapa) y `/calendario` (placeholder).

## 2. Módulo `apps/web/src/lib/map/`

- [x] 2.1 `types.ts`: `MapNode`, `MapTerritory`, `MapRoute`, `MapViewport`, `FocusState`.
- [x] 2.2 `layout.ts`: helpers para proyectar (listId, taskId) → (x, y) dentro del viewport, dado un seed determinístico por id.
- [x] 2.3 `MapCanvas.svelte`: SVG root con fondo de carta náutica (grid + contornos + coordenadas), pan/zoom, listeners de mouse/touch.
- [x] 2.4 `ProjectTerritory.svelte`: `<g>` con path de borde sutil + label mono.
- [x] 2.5 `TaskNode.svelte`: `<g>` con círculo + label + estados (selected / priority / completed / dimmed).
- [x] 2.6 `Lighthouse.svelte`: SVG del faro + haz cónico que apunta al nodo foco.
- [x] 2.7 `MapControls.svelte`: `+` `−` `center` `focus` `filters`.
- [x] 2.8 `TaskSidePanel.svelte`: slide-in derecha con detalle + acciones (Completar / Enfocar / Editar).
- [x] 2.9 `FocusBar.svelte`: chip "Siguiente paso: …" sobre el mapa cuando focus mode está activo.

## 3. Vista `Mapa.svelte`

- [x] 3.1 Fetch de `api.listLists()` + `api.pullSync(null)`.
- [x] 3.2 Derivar territorios (uno por lista) + nodos (uno por task no-deleted) + rutas (`dependsOnId`).
- [x] 3.3 Estado local: `viewport` (x, y, zoom), `selectedTaskId`, `focusedTaskId`, `focusMode`.
- [x] 3.4 Componer `MapCanvas` + `Lighthouse` + `MapControls` + `FocusBar` + `TaskSidePanel`.
- [x] 3.5 Click en nodo → selecciona + abre side panel.
- [x] 3.6 Drag de nodo → reposiciona (state local, no persistido).
- [x] 3.7 Drag desde nodo origen a nodo destino con threshold > 6px → `setTaskDependency` y refresca.

## 4. Focus mode

- [x] 4.1 Cuando activo: nodos no relacionados con `focusedTaskId` bajan a `opacity: 0.18`.
- [x] 4.2 Faro apunta a `focusedTaskId`.
- [x] 4.3 `FocusBar` muestra el título.
- [x] 4.4 Botón `focus` en controles toggle el modo.

## 5. API helper

- [x] 5.1 En `apps/web/src/lib/api.ts`: `setTaskDependency(taskId, dependsOnId)` que hace `PATCH /tasks/:id` con `{ dependsOnId }`.

## 6. Polish

- [x] 6.1 Tokens nuevos en `theme.ts`: `--color-coast`, `--color-coast-2`, `--color-depth`.
- [x] 6.2 Utilidades en `app.css`: `.chart-grid`, `.chart-contour`, `.nautical-coord`.
- [x] 6.3 Hover tooltip en nodo (title nativo + delay).
- [x] 6.4 Transiciones CSS 150ms en selección / focus / side-panel.

## 7. Verificación

- [x] 7.1 `npm run typecheck` (api + web) sin errores nuevos.
- [x] 7.2 `npm run build:web` sin errores.
- [x] 7.3 Deploy → smoke: abrir `/mapa`, ver nodos + faro, click tarea, focus mode, side panel.