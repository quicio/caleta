# Rhythms

## Purpose

Introducir la noción de **ritmo** (recurrencia con intención) sin gamificación. Un ritmo representa algo que el usuario quiere mantener con constancia a lo largo del tiempo. Se visualiza con barras de progreso sobrias y un selector **FULL / MINIMUM / MISSED** por día, sin streaks agresivos, puntos ni badges.

## ADDED Requirements

### Requirement: Un rhythm describe una intención recurrente

Un rhythm MUST tener: `title`, `target_per_week` (entero ≥ 1), `minimum` opcional (string libre, ej. "10 minutes", "5 pages") y `unit` opcional.

#### Scenario: Crear un rhythm
- **WHEN** el usuario envía `POST /api/rhythms` con `{ title, target_per_week, minimum?, unit? }`
- **THEN** el server crea el rhythm con esos valores

### Requirement: Cada día se registra con `kind` ∈ full | minimum | missed

El usuario MUST poder registrar, para cada rhythm, el estado de un día. Una entry es única por `(user, rhythm, date)`.

#### Scenario: Registrar un día FULL
- **WHEN** el usuario envía `POST /api/rhythms/:id/entries` con `{ date: "2026-08-25", kind: "full" }`
- **THEN** el server crea o reemplaza la entry del día para ese rhythm

#### Scenario: Reemplazar la entry del día
- **WHEN** el usuario envía otra entry para el mismo `(rhythm, date)`
- **THEN** el server reemplaza el `kind` (no crea duplicado)

#### Scenario: Registrar un día MISSED
- **WHEN** el usuario marca el día como `missed`
- **THEN** el sistema lo refleja en la visualización pero **NO castiga ni resetea** al usuario: la barra muestra progreso y trend, no "racha rota"

### Requirement: La recurrencia es semanal y se cuenta con entries reales

El progreso semanal de un rhythm MUST calcularse contando `rhythm_entries` en los últimos 7 días con `kind ∈ {full, minimum}`. `target_per_week` define el objetivo; el progreso es `count / target_per_week` (capado a 1.0).

#### Scenario: Cálculo del progreso
- **WHEN** el front quiere mostrar la barra de un rhythm
- **THEN** hace `GET /api/rhythms/:id` (o usa el snapshot del sync) y cuenta entries en los últimos 7 días con `kind='full' o 'minimum'`

### Requirement: Visualización sobria sin gamificación

La sección de Ritmos MUST mostrar, por rhythm, una barra de progreso en texto monoespaciado estilo `███████░  6 / 7`. No MUST usar badges, XP, fuegos ni streaks agresivos. Un día perdido no rompe la barra.

#### Scenario: Render
- **WHEN** el usuario tiene un rhythm con `target_per_week=7` y 6 days completados esta semana
- **THEN** ve `███████░  6 / 7` debajo del título del rhythm

### Requirement: El control FULL / MINIMUM / MISSED es por día, discreto

Para el día actual, el rhythm MUST ofrecer un toggle de tres estados que registra la entry. Para días pasados, se permite editar la entry (no se borra el historial).

#### Scenario: Marcar hoy
- **WHEN** el usuario elige "FULL" en el toggle de hoy
- **THEN** se registra `kind='full'` para la fecha de hoy (zona local del usuario)

### Requirement: Minimum se distingue de Full

Una entry `kind='minimum'` MUST contar para el progreso pero visualizarse más tenue que `full` (ej. bloque con opacidad reducida). La etiqueta "minimum" no se muestra en la barra principal; sólo el conteo.

### Requirement: Sync incluye rhythms y rhythm_entries

`/api/sync` MUST devolver `rhythms` y `rhythm_entries` (filtrados por `since` si aplica).

### Requirement: No hay notificaciones, recordatorios ni push

Esta change MUST NOT introducir notificaciones, emails ni recordatorios. La sección Ritmos existe cuando el usuario la abre.