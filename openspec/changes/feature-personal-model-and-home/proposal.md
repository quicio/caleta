# feature/personal-model-and-home

## Why

Caleta ya responde tres preguntas — **Lista** (qué hacer), **Calendario** (cuándo), **Mapa** (hacia dónde) — pero trata todo como tareas planas. El usuario acumula "caleta de cosas" sin un modelo para distinguir qué es un **objetivo**, qué es un **proyecto**, qué es un **ritmo** y qué es ruido.

El resultado: la interfaz se vuelve un cajón donde todo pesa igual. El usuario no puede separar lo urgente de lo importante, ni ver qué está construyendo con constancia, ni mover el foco sin perder contexto.

El documento de visión define la evolución completa hacia un **sistema personal de coordinación**: goals, projects, tasks, rhythms, focus, personal context, AI, integraciones. Esa evolución es de meses.

Esta change implementa **el primer slice implementable**: el modelo de datos subyacente (goals + rhythms) y la reorganización de **Home / Lista** en secciones con intención (**Ahora / Próximo / Algún día / Hechos**), más la visualización sobria de **Ritmos** con modo mínimo. Es la base que vuelve todo lo demás posible, sin agregar AI, ⌘K ni MCP todavía.

## What changes

- **Modelo de datos** (migración `0005_personal_model.sql`):
  - Nueva tabla `goals` (título, descripción opcional, estado `active|done|abandoned`).
  - `lists` gana una columna opcional `goal_id` (un proyecto puede pertenecer a un objetivo). El concepto user-facing pasa a llamarse **proyecto**, pero la tabla conserva el nombre `lists` para no romper el sync existente.
  - `tasks` gana una columna `bucket` (`now|next|someday`, default `next`) para soportar las secciones de Home.
  - Nueva tabla `rhythms` (título, `target_per_week`, `minimum` opcional, `unit` opcional).
  - Nueva tabla `rhythm_entries` (fecha local, `kind` ∈ `full|minimum|missed`) para registrar adherencia sin gamificación.
- **API**:
  - CRUD `/api/goals` (GET/POST/PATCH/DELETE).
  - CRUD `/api/rhythms` (GET/POST/PATCH/DELETE) + `POST /api/rhythms/:id/entries` para registrar un día.
  - PATCH de `/api/tasks/:id` y `/api/lists/:id` aceptan `bucket` y `goal_id` respectivamente.
  - Sync (`/api/sync`) incluye goals, rhythms y rhythm_entries para mantener la coherencia multi-device.
- **Home / Lista** se reorganiza en cuatro secciones: **Ahora**, **Próximo**, **Algún día**, **Hechos**. Mantiene la identidad visual (lime, charcoal, restrained). El bucket es editable por tarea con un control discreto.
- **Ritmos**: sección sobria en Home con barra de progreso de la semana (consistency, no streaks) y selector **FULL / MINIMUM / MISSED** por día.
- **Goals**: gestión dentro de Home (lista breve) y un selector para asignar un proyecto a un objetivo. No agrega ruta nueva al nav principal.

## Non-goals

Esta change **no** incluye:

- AI / ⌘K command palette / propuestas estructuradas (changes futuras).
- Integraciones externas nuevas (Google Tasks, GitHub, fitness, MCP).
- "Focus" como mecánica visual de atenuar el resto (queda para una change posterior que lo conecte con Mapa).
- Event sourcing ni audit log.
- Renombrar la tabla `lists` a `projects` (rompería sync en dispositivos activos; el concepto user-facing es "proyecto" igualmente).
- Recurrencia tipo RRULE completa (los rhythms usan `target_per_week` + entries explícitas, más simple y suficiente para el primer slice).
- Gamificación de rhythms (XP, badges, streaks agresivos). La visualización muestra consistencia y trend.

## Risks

- **Sync breaking**: agregar columnas a `tasks` y `lists` con DEFAULT no rompe clientes viejos (ignoran campos nuevos). Las tablas nuevas (`goals`, `rhythms`, `rhythm_entries`) no entran en conflicto.
- **Migración**: se ejecuta con `--remote` vía wrangler; la columna `bucket` default `next` mantiene el comportamiento actual para tareas existentes.
- **Visual**: introducir Ritmos y Goals en Home puede saturar si no se trata con restraint. El spec obliga a tipografía monoespaciada pequeña y sin decoración nueva.

## Out of scope (changes futuras)

- AI orchestration + ⌘K command palette.
- Focus + atenuación visual + integración Mapa.
- MCP / API broker para integraciones externas.
- Recurrencia avanzada en rhythms (RRULE).
- Personal context engine.