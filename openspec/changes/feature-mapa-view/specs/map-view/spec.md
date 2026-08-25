## Purpose

Define la vista de mapa interactivo de caleta: representación SVG tipo carta náutica donde las tareas son nodos de navegación, los proyectos territorios, las dependencias rutas, y el foco del usuario un faro que ilumina su próximo paso. Es la segunda vista top-level del producto (`Lista | Calendario | Mapa`).

## ADDED Requirements

### Requirement: Top-level view switcher

El switcher top-level del producto expone exactamente tres vistas: `Lista`, `Calendario`, `Mapa`. Los filtros temporales (Hoy / Próximos / Algún día / Hechos) son una concern de la vista Lista y se exponen como un sub-switcher dentro de ella, no como vistas top-level.

#### Scenario: Usuario abre la app
- **WHEN** la app carga tras autenticarse
- **THEN** el switcher top-level muestra `Lista | Calendario | Mapa` con exactamente esas tres opciones

#### Scenario: Usuario abre Mapa
- **WHEN** el usuario selecciona `Mapa` en el switcher
- **THEN** la URL pasa a `/mapa` y se renderiza la vista de carta náutica con nodos / territorios / faro

#### Scenario: Calendario es placeholder
- **WHEN** el usuario selecciona `Calendario`
- **THEN** la vista muestra un placeholder explícito ("Próximamente") sin claims falsos de funcionalidad

### Requirement: Carta náutica como fondo

El fondo del mapa es una carta náutica digital: cuadrícula sutil de baja opacidad, 2-3 contornos topográficos (curvas tipo isolínea) en verde-negro muy apagado, y coordenadas mono en las cuatro esquinas. No hay fotografía ni textura real; el efecto debe ser el de un instrumento digital.

#### Scenario: Inspección visual del fondo
- **WHEN** el mapa renderiza sin tareas
- **THEN** siguen visibles la cuadrícula, los contornos y las coordenadas; el fondo nunca queda vacío

### Requirement: Territorios de proyecto

Cada `list` (proyecto) se representa como un territorio con borde sutil cerrado (path SVG) y un label en mono uppercase tracking-wide. El territorio se posiciona según un seed determinístico del id del proyecto, separado de los demás con al menos ~80px de margen.

#### Scenario: Proyecto con actividad densa
- **WHEN** un proyecto tiene >=5 tareas activas
- **THEN** su territorio tiene el borde un poco más opaco y el label un poco más brillante que un proyecto con <5

#### Scenario: Proyecto inactivo
- **WHEN** un proyecto tiene 0 tareas activas (solo completadas)
- **THEN** su territorio baja a `opacity: 0.4` y el label a `mist/60`

### Requirement: Nodos de tarea

Cada task no-deletada se representa como un nodo circular. Estados visuales:
- **Seleccionada**: anillo lima de 2px + halo (`box-shadow` SVG via filter).
- **Prioridad alta**: anillo lima continuo sin relleno.
- **En progreso / activa**: relleno `moss`, borde `mist/50`.
- **Completada**: relleno `surface-2`, label tachado, `opacity: 0.5`.
- **Default**: relleno `ink`, borde `surface-2`.

Label del nodo: máx 28 chars, trunca con ellipsis, mono 10px, color `ink-0`/`mist`.

#### Scenario: Hover sobre nodo
- **WHEN** el usuario hace hover sobre un nodo
- **THEN** aparece un tooltip nativo con el título completo, el proyecto, y la fecha de vencimiento (si tiene)

#### Scenario: Click sobre nodo
- **WHEN** el usuario hace click sobre un nodo
- **THEN** se selecciona, el mapa centra el viewport sobre él con animación CSS, y se abre el side panel

### Requirement: Rutas de dependencia

Una task con `dependsOnId` válido se conecta al nodo de esa task con una línea dashed (`stroke-dasharray: 4 4`), 1px, color `mist/35`. Si el destino no existe en el set actual, no se dibuja la ruta.

#### Scenario: Dependencia rota
- **WHEN** una task referencia un `dependsOnId` que ya no existe
- **THEN** el nodo origen se renderiza sin ruta; no se intenta dibujar al vacío

### Requirement: Faro de foco

El faro es un elemento SVG fijo (no un nodo más) que emite un haz triangular cuando hay foco. Si no hay foco, el faro está apagado (sin haz). El haz apunta siempre al nodo `focusedTaskId` (o al último `selectedTaskId` si no hay foco explícito).

#### Scenario: Sin foco
- **WHEN** ningún nodo está seleccionado ni enfocado
- **THEN** el faro renderiza sin haz, en gris muted

#### Scenario: Foco activo
- **WHEN** hay un `focusedTaskId`
- **THEN** el haz triangular conecta la punta del faro con el centro del nodo, con `opacity` animada de 0 a 1 en 200ms

### Requirement: Pan y zoom

El viewport es un SVG con viewBox dinámico (`x`, `y`, `width`, `height`). Pan con drag de fondo (botón izquierdo sobre zona vacía) o touch drag. Zoom con rueda del mouse (centro = posición del cursor) o botones `+` / `−`. Límites: zoom min 0.4, max 2.5. Pan sin límite (puede salir del contenido).

#### Scenario: Zoom out excesivo
- **WHEN** el usuario hace zoom out más allá del mínimo
- **THEN** el zoom se clampa a 0.4

#### Scenario: Doble click sobre fondo
- **WHEN** el usuario hace doble click sobre una zona sin nodo
- **THEN** se hace zoom-in centrado en ese punto (factor 1.4)

### Requirement: Drag de nodo

El usuario puede arrastrar un nodo con el mouse/touch. El nodo sigue el cursor durante el drag. Al soltar, la posición se actualiza en state local (no se persiste al backend en esta iteración; ver `proposal.md` Fuera de alcance).

#### Scenario: Drag con threshold
- **WHEN** el usuario inicia un press sobre un nodo
- **THEN** si el movimiento supera 6px, entra en modo drag; si suelta antes de los 6px, se trata como click (selección)

### Requirement: Conectar dependencias

Para crear una dependencia entre dos tareas: el usuario hace drag desde un nodo origen hacia un nodo destino. Si el destino es distinto del origen, al soltar se llama `setTaskDependency(originId, destId)` y se refresca el mapa.

#### Scenario: Conexión inválida (a sí mismo)
- **WHEN** el usuario suelta el drag de conexión sobre el mismo nodo origen
- **THEN** no se crea dependencia; se cancela el drag con animación

#### Scenario: Conexión duplicada
- **WHEN** el origen ya tiene como dependencia al destino
- **THEN** no se llama al API; el feedback visual es no-op

### Requirement: Focus mode

Cuando el modo foco está activo:
- Los nodos cuyo proyecto no coincide con el de la tarea foco Y no están en su cadena de dependencias bajan a `opacity: 0.18`.
- El faro apunta a la tarea foco.
- Aparece un `FocusBar` sobre el mapa con el título de la tarea y un botón "Salir del foco".

#### Scenario: Activar foco desde side panel
- **WHEN** el usuario clickea "Enfocar" en el side panel
- **THEN** `focusMode = true`, `focusedTaskId = selectedTaskId`, los demás nodos se atenúan, el faro se enciende

#### Scenario: Salir del foco
- **WHEN** el usuario clickea "Salir del foco" en el FocusBar
- **THEN** `focusMode = false`, los nodos vuelven a su opacity normal, el faro se apaga (o queda en idle si hay selección)

### Requirement: Side panel de tarea

Panel de 360px que se desliza desde la derecha sobre el mapa (el mapa sigue visible detrás). Contiene:
- Header: título + botón cerrar.
- Metadata mono: `Proyecto · Prioridad · Vence`.
- Descripción (puede ser multilínea).
- Lista de dependencias (quién depende de esta + de quién depende esta).
- Acciones: `Completar` (toggle), `Enfocar` (toggle focus mode sobre esta), `Editar` (placeholder).

#### Scenario: Click fuera del panel
- **WHEN** el usuario clickea fuera del side panel y fuera de un nodo
- **THEN** el panel se cierra y la selección se limpia

### Requirement: Controles del mapa

Esquina inferior derecha. Cinco botones pequeños estilo instrumento: `+`, `−`, `center`, `focus`, `filters`. Iconos 14px, fondo `surface/70`, borde `surface-2`, hover `moss/40`. Sin sombras grandes, sin badges.

#### Scenario: Click en `center`
- **WHEN** el usuario clickea `center`
- **THEN** el viewport vuelve a x=0, y=0, zoom=1 con transición CSS

### Requirement: Top bar del Mapa

La barra superior del Mapa contiene (de izquierda a derecha): wordmark "caleta" (oculto en mobile, ya está en sidebar), switcher `Lista | Calendario | Mapa`, separador, search input pequeño, botón filters, grupo de zoom (`+` `−`), botón primary `+ Nueva tarea`. En mobile, todo colapsa en el patrón existente de Tabs + BottomNav.

#### Scenario: Crear tarea desde el Mapa
- **WHEN** el usuario clickea `+ Nueva tarea`
- **THEN** se abre el quick-create existente (input + datetime), la tarea se crea con `listId` = lista del último nodo seleccionado o la primera lista

### Requirement: Performance techo

El mapa está implementado en SVG nativo. Con <200 nodos la interacción es fluida en hardware moderno. Con >300 nodos puede haber jank durante pan/zoom. No se requiere optimización adicional en esta iteración.

#### Scenario: Comentario de techo
- **WHEN** un developer lee `MapCanvas.svelte`
- **THEN** ve un comentario `ponytail:` que documenta el techo (~200 nodos) y la upgrade path (canvas / WebGL / clustering).