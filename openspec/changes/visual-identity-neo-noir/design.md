## Context

El frontend (`apps/web`, Svelte 5 + Vite + Tailwind v4) hoy usa la paleta default de Tailwind (slate/violet, cards blancas con sombra). Se reemplaza por un sistema de diseño propietario "neo-noir".

**Restricciones del entorno:**
- Solo cambia `apps/web`. El backend (`apps/api`), las migraciones y el modelo de datos no se tocan.
- Los contratos actuales de `apps/web/src/lib/api.ts` y `apps/web/src/lib/auth.ts` se mantienen: la UI sigue consumiendo las mismas funciones.
- El mini-router propio (`lib/router.svelte.ts`, `Router/Route/Link`) se conserva.
- No hay tests de UI; validación por build (`npm run build`) y typecheck.

**Restricciones del producto:**
- App dark-only. "caleta" = "muchas cosas por hacer" → sensación de orden sobre caos.
- Copy en español (es-AR neutral). Microcopy cuidada.

## Goals / Non-Goals

**Goals:**
- Tokens de diseño en Tailwind v4 (`@theme`) con los colores y tipografías del sistema.
- Wordmark "caleta" minúscula; icono "C/Ç" estilizada (no checkmark).
- Layout desktop con sidebar (nav + proyectos + perfil) y mobile con tabs + bottom-nav.
- Task list como filas separadas por líneas finas; checkbox/prioridad/tiempo/proyecto en cada fila.
- "Nueva tarea" como input de una línea con metadata natural (fecha, hora, proyecto, prioridad, recordatorio, notas).
- Estado vacío con ilustración de faro/caleta sutil y monocroma.
- Login rediseñado con la misma identidad.

**Non-Goals:**
- No funcionalidad nueva de backend; sin tags/recurrencias/colaboración.
- Sin modo claro.
- "Calendario"/"Actividad" en bottom-nav pueden ser placeholders navegables no funcionales.
- Sin tests automatizados de UI.

## Decisions

### 1. Tokens vía Tailwind v4 `@theme` en `app.css`

**Decisión:** definir colores y fuentes en `@layer theme`/`@theme` de Tailwind v4 (CSS custom properties), no como archivo separado.

**Razón:** Tailwind v4 ya centraliza tokens en CSS; evita JS config y permite que las utilidades (`bg-surface`, `text-lime`) salgan del mismo sistema. Un archivo `theme.ts` solo expone constantes TS (fuentes, espaciados) si hacen falta.

### 2. Tipografías auto-hospedadas con `@fontsource`

**Decisión:** usar `@fontsource/space-grotesk` y `@fontsource/ibm-plex-mono` importadas en `main.ts`/`app.css`.

**Razón:** auto-hosting evita dependencia de Google Fonts (privacidad + velocidad en Cloudflare). Space Grotesk para títulos/tareas/botones; IBM Plex Mono para fechas/conteos/metadata.

### 3. Componentes atómicos en `src/lib/ui/`

**Decisión:** crear primitivas reutilizables: `Icon.svelte` (SVG inline, sin librería), `Checkbox.svelte`, `TaskRow.svelte`, `EmptyState.svelte`, `Sidebar.svelte`, `BottomNav.svelte`, `Button.svelte`.

**Razón:** el diseño pide consistencia (mismos checkbox, mismas filas, mismos hovers) en desktop y mobile; componentes evitan duplicación.

### 4. Filas de tarea (no cards)

**Decisión:** las tareas se renderizan como filas con `border-b` fina, no como cards con sombra.

**Razón:** el brief explícitamente rechaza cards grandes. La fila mantiene el "quiet premium" y permite escanear muchas tareas de golpe.

### 5. Iconografía SVG inline propia

**Decisión:** un set chico de iconos inline (`Icon.svelte` con `#snippet`) en lugar de una librería de iconos.

**Razón:** mantiene el bundle liviano, evita dependencias y permite trazos de 1.5px consistentes con la estética.

### 6. Checkbox e interacción con CSS-first, JS para toggle

**Decisión:** checkbox custom de 16px, redondeado, borde 1px; completado = lima relleno con check oscuro + `line-through` en el título.

**Razón:** pequeño y preciso como pide el brief; el estado visual sale de clases condicionales en Svelte.

### 7. Layout responsive vía clases Tailwind

**Decisión:** `lg:` para sidebar visible / mobile con bottom-nav; una sola fuente de verdad en el markup.

**Razón:** evita dos árboles de componentes y mantiene consistencia visual entre tamaños (el brief pide que mobile parezca el mismo producto).

## Risks / Trade-offs

- **Riesgo:** rediseño grande en un solo cambio puede romper el flujo OAuth/login si se toca mal el layout. Mitigación: `App.svelte`/`Login`/`Callback` se mantienen con la misma lógica, solo cambia markup/clases.
- **Trade-off:** dark-only limita accesibilidad en ambientes claros; aceptado por identidad.
- **Riesgo:** auto-hosting de fuentes suma ~100KB al bundle. Aceptable; se puede precargar vía `rel=preload` en `index.html`.
- **Trade-off:** bottom-nav con pestañas "Calendario"/"Actividad" no funcionales puede confundir; se marcan como vista vacía con copy clara ("Próximamente").
