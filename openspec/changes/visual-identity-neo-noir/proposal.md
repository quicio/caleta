## Why

El frontend actual de caleta usa la paleta por defecto de Tailwind (slate/violet, cards blancas con sombras, dark mode a medias). Eso choca con la identidad del producto: una app de tareas personal, rápida y con carácter, que debe sentirse "cuidada" y no como un SaaS genérico.

La app ya resuelve el problema funcional (sync multi-dispositivo, OAuth, CRUD). Lo que falta es la **identidad visual**: el sistema de diseño que la haga sentirse propia, premium y reconocible. Este cambio es puramente de frontend (`apps/web`); no toca la API, el storage ni el modelo de datos.

## What Changes

- Reemplazar la paleta y tipografía por el sistema "caleta neo-noir":
  - Fondo near-black `#0B0F10`, superficies `#121719` y `#1A2023`.
  - Acento lima `#E7FF44` para acciones, estados seleccionados e indicadores.
  - Tipografía geométrica (Space Grotesk) para títulos/tareas/navegación; mono (IBM Plex Mono) para fechas, conteos y metadata.
  - Bordes finos de 1px, esquinas suaves, sombras discretas, grano sutil.
- Restructurar la navegación: sidebar en desktop (Hoy / Próximos / Algún día / Hechos + Proyectos con indicadores de color + perfil al pie) y bottom-nav en mobile (Tareas / Calendario / Actividad / Ajustes).
- Rediseñar la vista principal: encabezado "Hoy", fecha mono, contador de tareas, botón "+ Nueva tarea" en lima, y lista de tareas como **filas separadas por líneas sutiles** (no cards grandes).
- Nuevo flujo "Nueva tarea" como input minimalista de una línea con metadata natural (fecha, hora, proyecto, prioridad, recordatorio, notas), sin forms grandes.
- Estado vacío con ilustración minimalista de faro/caleta en monocromo con acentos lima.
- Wordmark "caleta" en minúsculas como marca; icono de app basado en una "C/Ç" estilizada (no un checkmark genérico).
- Interacciones: checkbox pequeños y precisos, tareas completadas con tachado y mute, hover sutil, estrella lima para prioridad.

### Fuera de alcance

- Cambios en el backend (`apps/api`), migraciones o modelo de datos.
- Colaboración, tags, recurrencias, attachments (son cambios funcionales futuros, no de identidad).
- Ajustes funcionales (recordatorios push, calendario real): la bottom-nav mobile con "Calendario"/"Actividad" puede ser placeholder navegable, no funcional.
- Temas claros: la app es dark-only por identidad.

## Capabilities

### New Capabilities

- `ui-system`: capacidad que describe el sistema de diseño visual de caleta: tokens de color/tipografía, layout de navegación, componentes de tarea, interacciones, estados vacíos e iconografía. Deriva de este cambio y gobierna cualquier UI futura.

### Modified Capabilities

- *(ninguna — el cambio `task-sync` no cambia su contrato; la UI lo consume igual)*

## Impact

- Código y archivos afectados (solo `apps/web/`):
  - `src/app.css` (tokens, tipografía, componentes base).
  - `src/lib/` (nuevo design system: `theme.ts`, componentes `Icon`, `Checkbox`, `Button`, `TaskRow`, `Sidebar`, `BottomNav`, `EmptyState`).
  - `src/routes/` (`Login.svelte`, `Lists.svelte` → layout con sidebar/tabs, `TaskList.svelte` → task rows, `Callback.svelte`).
  - `src/App.svelte` (layout global).
  - `index.html` (title, meta, fonts).
- Dependencias nuevas: `@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono` (o Google Fonts link). Sin dependencias de runtime nuevas.
- Sistemas externos: ninguno.
- Configuración: `VITE_API_URL`/`WEB_URL` sin cambios.
- Riesgos: rediseño visual sin cambios funcionales → bajo riesgo; mayor riesgo es romper el flujo OAuth/layout, mitigado manteniendo los mismos contratos de `api.ts`/`auth.ts`.
