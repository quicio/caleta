# Personal model

## Purpose

Define el modelo de datos de Caleta para representar la vida personal del usuario más allá de tareas: **goals** (objetivos / destinos), **projects** (proyectos / territorios), **tasks** (acciones) y **rhythms** (ritmos / construcción constante), y las relaciones entre ellos.

## ADDED Requirements

### Requirement: Goals representan destinos del usuario

Caleta MUST permitir al usuario crear, editar, archivar y eliminar **goals**. Un goal tiene título obligatorio, descripción opcional y un estado ∈ `active | done | abandoned`.

#### Scenario: Crear un goal
- **WHEN** el usuario envía `POST /api/goals` con `{ title, description? }`
- **THEN** el server crea un goal con `status='active'` y devuelve el goal creado

#### Scenario: Marcar un goal como done
- **WHEN** el usuario envía `PATCH /api/goals/:id` con `{ status: 'done' }`
- **THEN** el server actualiza el goal; el goal sigue listado pero visualmente diferenciado

#### Scenario: Eliminar un goal
- **WHEN** el usuario envía `DELETE /api/goals/:id`
- **THEN** el server elimina el goal y los proyectos asociados quedan con `goal_id = NULL` (no se eliminan en cascada)

### Requirement: Projects (lists) pueden pertenecer a un goal

La tabla `lists` MUST tener una columna opcional `goal_id`. Un proyecto puede tener cero o un goal asociado. Un goal puede tener muchos proyectos.

#### Scenario: Asignar un proyecto a un goal
- **WHEN** el usuario envía `PATCH /api/lists/:id` con `{ goal_id: "<goal-id>" }`
- **THEN** el server valida que el goal pertenece al usuario y actualiza el proyecto

#### Scenario: Validación de goal ajeno
- **WHEN** el usuario envía `PATCH /api/lists/:id` con un `goal_id` que pertenece a otro usuario
- **THEN** el server responde `400` con `{ error: "goal no pertenece al usuario" }`

#### Scenario: Desasociar
- **WHEN** el usuario envía `PATCH /api/lists/:id` con `{ goal_id: null }`
- **THEN** el server limpia la asociación sin eliminar el proyecto

### Requirement: Tasks tienen bucket de intención

Toda tarea MUST tener un `bucket` ∈ `now | next | someday`. El bucket determina en qué sección de Home aparece la tarea. Default `next`.

#### Scenario: Mover tarea a Ahora
- **WHEN** el usuario envía `PATCH /api/tasks/:id` con `{ bucket: 'now' }`
- **THEN** la tarea aparece en la sección **Ahora** de Home

#### Scenario: Mover a Algún día
- **WHEN** el bucket cambia a `someday`
- **THEN** la tarea desaparece de Ahora y Próximo y aparece en **Algún día**

#### Scenario: Tareas completadas
- **WHEN** `completed = 1`
- **THEN** la tarea aparece en **Hechos** independientemente de su bucket

### Requirement: Tareas pertenecen a un proyecto, no directamente a un goal

El grafo MUST respetar la cadena `Goal → Project → Task`. Una tarea no se asocia directamente a un goal; su goal es el del proyecto. Esto mantiene el modelo limpio.

#### Scenario: El goal de una tarea
- **WHEN** el front quiere mostrar a qué goal pertenece una tarea
- **THEN** resuelve vía `task.list_id → list.goal_id`

### Requirement: Sync incluye goals y projects con goal_id

`GET /api/sync?since=...` MUST devolver, además de lists y tasks, los goals del usuario con su `updated_at`. El campo `goal_id` MUST estar presente en cada list devuelta.

#### Scenario: Cliente nuevo, server nuevo
- **WHEN** el cliente pide sync
- **THEN** recibe `goals`, `lists` (con `goal_id`), `tasks` (con `bucket`)

#### Scenario: Cliente viejo, server nuevo
- **WHEN** un cliente que ignora los campos nuevos pide sync
- **THEN** el server responde 200; el cliente ignora los campos desconocidos sin error

#### Scenario: Cliente nuevo, server viejo (sin migración)
- **WHEN** el cliente pide sync
- **THEN** el server responde 200 con `goals: []`, `rhythms: []`, `rhythm_entries: []` o el cliente trata la ausencia como arreglo vacío