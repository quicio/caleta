## 1. Tokens y fundaciones

- [ ] 1.1 Instalar `@fontsource/space-grotesk` y `@fontsource/ibm-plex-mono` en `apps/web`.
- [ ] 1.2 Definir en `apps/web/src/app.css` el `@theme` de Tailwind v4 con la paleta (ink, surface, surface-2, moss, lime, mist, ink-0) y las fuentes (font-sans → Space Grotesk, font-mono → IBM Plex Mono).
- [ ] 1.3 Importar las fuentes en `main.ts` (o `app.css`) y setear `index.html` (title, lang, theme-color, favicon).
- [ ] 1.4 Redefinir `.btn`, `.btn-primary`, `.input` y agregar `.btn-danger` con la nueva estética (sin violeta, bordes finos, lime como primario).
- [ ] 1.5 Agregar grano sutil (SVG noise de fondo) como clase opcional y usarla en el body.

## 2. Componentes base

- [ ] 2.1 Crear `src/lib/ui/Icon.svelte` con set de iconos inline (más, estrella, sol/luna, ajustes, lista, calendario, actividad, logo "c", chevron) con trazo 1.5.
- [ ] 2.2 Crear `src/lib/ui/Checkbox.svelte` (16px, borde 1px, checked = lime + check oscuro) con `bindable checked`.
- [ ] 2.3 Crear `src/lib/ui/Wordmark.svelte` ("caleta" minúscula, "c" en lime).
- [ ] 2.4 Crear `src/lib/ui/EmptyState.svelte` con ilustración SVG de faro/caleta monocroma + acentos lime y slots para título/copy/acción.
- [ ] 2.5 Crear `src/lib/ui/TaskRow.svelte`: fila con border-b, checkbox, título, indicador de proyecto (punto color), hora mono, estrella lime opcional, hover sutil y acciones progresivas.

## 3. Navegación

- [ ] 3.1 Crear `src/lib/ui/Sidebar.svelte`: wordmark, nav (Hoy/Próximos/Algún día/Hechos), divisor, Proyectos con puntos de color, perfil al pie (avatar inicial, nombre, toggle tema, ajustes).
- [ ] 3.2 Crear `src/lib/ui/BottomNav.svelte` (mobile): Tareas / Calendario / Actividad / Ajustes con item activo en lime.
- [ ] 3.3 Crear `src/lib/ui/Tabs.svelte` (mobile top): Hoy / Próximos / Algún día / Hechos.

## 4. Layout principal y rutas

- [ ] 4.1 Refactorizar `src/App.svelte` para envolver en layout global: sidebar desktop (`lg:`) + contenido + bottom-nav mobile.
- [ ] 4.2 Rediseñar `src/routes/Lists.svelte` → vista "Hoy": encabezado con título, fecha mono, conteo de tareas mono, botón "+ Nueva tarea" lime; usar `TaskRow`; mantener la lógica funcional actual (`api.listLists`, create, delete, sync).
- [ ] 4.3 Rediseñar `src/routes/TaskList.svelte` → vista de tareas de una lista/proyecto con `TaskRow`, input "Nueva tarea" y estado vacío; mantener `api.*`.
- [ ] 4.4 Implementar el input "¿Qué tienes que hacer?" con metadata natural (fecha/hora/proyecto/prioridad/recordatorio/notas) en un campo de una línea (se puede usar el campo `dueAt` existente para fecha/hora).
- [ ] 4.5 Rediseñar `src/routes/Login.svelte` con wordmark + botón Google + microcopy en la identidad nueva.
- [ ] 4.6 Ajustar `src/routes/Callback.svelte` al estilo nuevo (procesando sesión sobrio).

## 5. Branding

- [ ] 5.1 Crear el icono "C/Ç" en SVG (fondo ink + símbolo lima) y exportarlo como `public/favicon.svg` + referencia en `index.html` y, si aplica, manifest.
- [ ] 5.2 Verificar que favicon sea legible a 16px.

## 6. Validación

- [ ] 6.1 `npm run typecheck --workspace=apps/web` pase sin errores nuevos.
- [ ] 6.2 `npm run build --workspace=apps/web` pase.
- [ ] 6.3 Correr local (`npm run dev -w apps/web`) y verificar visualmente: sidebar desktop, bottom-nav mobile, filas de tarea, estado vacío, login, new task input.
- [ ] 6.4 Validar que el flujo OAuth siga funcionando (login completo con Google).
