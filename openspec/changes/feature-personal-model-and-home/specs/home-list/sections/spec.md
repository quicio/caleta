# Home / Lista — sections with intent

## Purpose

Reorganizar la vista **Home / Lista** en cuatro secciones con jerarquía clara — **Ahora**, **Próximo**, **Algún día**, **Hechos** — para que el usuario pueda ver de un vistazo qué importa ahora sin que el resto lo abrume. La identidad visual se preserva.

## ADDED Requirements

### Requirement: Home muestra cuatro secciones en orden fijo

La vista Home MUST renderizar, en este orden estricto, las secciones: **Ahora**, **Próximo**, **Algún día**, **Hechos**. Cada sección es collapsible individualmente; por defecto **Ahora** está expandida y las demás también.

#### Scenario: Render inicial
- **WHEN** el usuario abre Home (`/`)
- **THEN** ve las cuatro secciones con sus conteos (`Ahora · 3`, `Próximo · 11`, `Algún día · 5`, `Hechos · 27`)

#### Scenario: Sección vacía
- **WHEN** una sección no tiene tareas
- **THEN** muestra un mensaje sobrio (mono, small) del tipo "Sin nada acá."

### Requirement: Ahora contiene sólo tareas de bucket `now`

La sección **Ahora** MUST mostrar exclusivamente tareas con `bucket = 'now'` y `completed = 0`. Es la sección visualmente dominante.

#### Scenario: Tarea en Ahora
- **WHEN** una tarea tiene `bucket='now'` y no está completada
- **THEN** aparece únicamente en **Ahora**

### Requirement: Próximo contiene tareas de bucket `next`

La sección **Próximo** MUST mostrar tareas con `bucket = 'next'` y `completed = 0`.

### Requirement: Algún día contiene tareas de bucket `someday`

La sección **Algún día** MUST mostrar tareas con `bucket = 'someday'` y `completed = 0`.

### Requirement: Hechos contiene tareas completadas

La sección **Hechos** MUST mostrar tareas con `completed = 1` ordenadas por `updated_at` desc, sin importar su bucket.

### Requirement: El usuario puede cambiar el bucket de una tarea

Cada tarea MUST ofrecer un control discreto (botón/menú inline) para moverla entre `now | next | someday` (sin incluir "hechos"; el toggle de completed sigue gobernando eso).

#### Scenario: Mover a Algún día
- **WHEN** el usuario elige "Algún día" en el control de bucket
- **THEN** la tarea desaparece de su sección actual y aparece en **Algún día** sin recarga (optimistic update)

#### Scenario: Falla del server
- **WHEN** el PATCH al server falla
- **THEN** la UI revierte el cambio y muestra un mensaje de error breve

### Requirement: La jerarquía visual refleja el orden de las secciones

**Ahora** MUST ser visualmente más prominente que las otras secciones. El resto debe sentirse presente pero **quieto**: tipografía monoespaciada pequeña, sin decoración adicional, sin badges.

#### Scenario: Tipografía
- **WHEN** se renderiza Home
- **THEN** **Ahora** usa el tamaño de item de tarea actual; Próximo y Algún día usan el mismo item; **Hechos** usa el mismo item con opacidad reducida (~60%) para que se sienta "archivado"

### Requirement: Conteos por sección

Cada header de sección MUST mostrar el conteo de tareas en formato `Sección · N` (mono, small).

### Requirement: Las secciones respetan el proyecto activo

Si el usuario seleccionó un proyecto (ruta `/lists/:id`), la vista Home MUST mostrar las secciones filtradas a ese proyecto. El comportamiento actual de filtrado por proyecto se preserva.

### Requirement: No se agregan rutas nuevas al nav

Esta change MUST NOT agregar entradas nuevas al nav principal. La nav sigue siendo: **Lista · Calendario · Mapa · Configuración**. Goals y Ritmos se acceden dentro de Home, no como rutas separadas.