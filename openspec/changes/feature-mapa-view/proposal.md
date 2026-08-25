## Why

Caleta hoy es solo una lista filtrable (Hoy / Próximos / Algún día / Hechos). Sirve para responder "¿qué tengo que hacer?" pero no "¿hacia dónde voy?". Cuando el volumen crece, el usuario pierde la sensación de dirección: las tareas son nodos sueltos sin relación espacial ni jerarquía visible.

La metáfora náutica ya está en el ADN de la marca (faro, "caleta", wave ASCII del login, nombres en `costa`/`mareas`). Lo que falta es convertir esa metáfora en una **feature productiva real**: una vista de mapa donde las tareas se vuelven nodos de navegación, los proyectos territorios, las dependencias rutas, y el foco del usuario un faro que ilumina su próximo paso. No decoración: una herramienta de orientación.

## What Changes

- Nueva vista **Mapa** accesible desde el switcher top-level `Lista | Calendario | Mapa` (Calendario queda como placeholder navegable).
- Restructurar el switcher top-level: `Sidebar.views` y `Tabs.tabs` pasan de `[Hoy, Próximos, Algún día, Hechos]` a `[Lista, Calendario, Mapa]`. Los filtros temporales siguen disponibles dentro de Lista (no se pierden).
- Mapa interactivo renderizado como SVG (pan + zoom con mouse/touch), alimentado por el API real (tasks + lists + sync).
- Representación:
  - **Proyectos** = territorios con borde sutil y label uppercase mono.
  - **Tareas** = nodos circulares. Tarea seleccionada / foco = lima brillante. Tareas prioritarias = anillo lima. Tareas en progreso = filled. Completadas = dimmed + tachado.
  - **Dependencias** = rutas dashed finas entre nodos; solo entre tareas reales (`dependsOnId`).
  - **Faro** = elemento SVG fijo (no nodo) que emite un haz triangular apuntando al nodo seleccionado / foco. Idle si no hay selección.
  - **Fondo** = carta náutica: cuadrícula sutil, contornos topográficos, coordenadas en mono en las esquinas.
- Interacciones:
  - Click en tarea → abre **side panel** derecho (no navega fuera del mapa).
  - Click en proyecto → filtra el mapa a ese territorio.
  - Pan con drag de fondo, zoom con rueda/pinch/botones.
  - **Drag de tarea** dentro del mapa (reposiciona el nodo; layout es manual, no auto).
  - **Connect**: drag desde un nodo origen hacia un nodo destino crea una dependencia (`PATCH /tasks/:id { dependsOnId }`).
  - Botón **Enfocar** en el top bar y en el side panel → activa focus mode.
  - **Focus mode** = todo lo no relacionado con la tarea foco baja a `opacity: 0.2`; el faro apunta al foco; aparece chip "Siguiente paso: <título>".
- Side panel (slide-in desde la derecha, ~360px):
  - Título, metadata mono (`Proyecto · Prioridad · Vence`), descripción, subtareas, dependencias, notas, actividad.
  - Botones: **Completar** (toggle), **Enfocar** (scroll al nodo + activa focus), **Editar** (placeholder).
- Controles del mapa (esquina inferior derecha, pequeños, estilo instrumento):
  - `+` / `−` zoom
  - `center` recentrar
  - `focus` toggle focus mode
  - `filters` abrir sheet de filtros (placeholder mínimo: por proyecto, por estado).
- Top bar del Mapa: switcher Lista/Calendario/Mapa + search + filters + zoom controls + `+ Nueva tarea`.

### Fuera de alcance

- Auto-layout / graph algorithms (las posiciones de los nodos son manuales y se persisten en `task.position` local — sin migrar el schema del API).
- Persistir pan/zoom en el servidor (es state local del componente).
- Vista Calendario funcional (placeholder navegable).
- Animaciones largas / spring physics (todo transiciones CSS de 150-200ms).
- Subtasks jerárquicas (el modelo actual no las soporta — se listan planas en el side panel).
- Multi-faro / faros por proyecto (un solo faro global = foco del usuario).

## Capabilities

### New Capabilities

- `map-view`: capacidad que describe la vista de mapa interactivo de caleta: render SVG con cartas náuticas, nodos de tarea, territorios de proyecto, rutas de dependencia, faro de foco, focus mode, side panel, drag/connect. Es la segunda vista top-level del producto.

### Modified Capabilities

- `ui-system`: el switcher top-level pasa de 4 filtros temporales a 3 vistas (`Lista`, `Calendario`, `Mapa`). Los filtros temporales siguen disponibles dentro de Lista (sin cambio de contrato).
- `task-sync`: el modelo `ApiTask` gana un campo opcional `dependsOnId` (derivado de links del sync) y `priority` (high/normal) si no estaba. Sin cambio de wire protocol — son campos que el cliente ya recibía pero no mostraba.

## Impact

- Código y archivos afectados:
  - `apps/web/src/App.svelte`: nueva ruta `/mapa`, switcher top-level.
  - `apps/web/src/lib/ui/Sidebar.svelte`, `Tabs.svelte`: nuevo array de vistas.
  - `apps/web/src/lib/ui/TopBar.svelte` *(nuevo)*: barra superior del Mapa con switcher, search, filters, zoom, + Nueva tarea.
  - `apps/web/src/routes/Mapa.svelte` *(nuevo)*: composición del mapa.
  - `apps/web/src/lib/map/` *(nuevo módulo)*: `MapCanvas.svelte`, `TaskNode.svelte`, `ProjectTerritory.svelte`, `Lighthouse.svelte`, `MapControls.svelte`, `TaskSidePanel.svelte`, `FocusBar.svelte`, `layout.ts`, `types.ts`.
  - `apps/web/src/lib/ui/theme.ts`: tokens nuevos (`--color-coast-*` para contornos del fondo).
  - `apps/web/src/app.css`: capa del mapa (`@layer components` con utilidades de carta náutica).
  - `apps/web/src/lib/api.ts`: helper `setTaskDependency(taskId, dependsOnId)`.
- Dependencias nuevas: ninguna. SVG nativo + transiciones CSS.
- Sistemas externos: ninguno (la API ya soporta `dependsOnId` vía PATCH genérico; verificable en `apps/api/src/routes/tasks.ts`).
- Configuración: sin cambios.
- Riesgos:
  - Performance con muchos nodos: SVG con >200 nodos empieza a sufrir. Aceptable para uso personal (1 usuario, docenas de tareas). Marcar techo en comentario.
  - Drag-to-connect debe ser distinguible de click + drag de fondo: usar threshold de movimiento (~6px) para discriminar.
  - Reestructurar el switcher es un breaking change visual para usuarios existentes: amortiguar manteniendo los filtros dentro de Lista.