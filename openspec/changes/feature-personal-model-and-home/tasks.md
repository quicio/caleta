# Tasks — feature/personal-model-and-home

## 1. Migración

- [ ] 1.1 Crear `apps/api/migrations/0005_personal_model.sql` con las tablas `goals`, `rhythms`, `rhythm_entries` y los `ALTER TABLE` para `lists.goal_id` y `tasks.bucket`. Idempotente (`IF NOT EXISTS`).
- [ ] 1.2 Agregar `idx_goals_user_id_updated_at`, `idx_rhythms_user_id_updated_at`, `idx_rhythm_entries_unique`, `idx_tasks_user_id_bucket`.
- [ ] 1.3 Aplicar la migración en D1 remoto con `wrangler d1 execute caleta --remote --file=apps/api/migrations/0005_personal_model.sql`.

## 2. Storage — types

- [ ] 2.1 En `apps/api/src/storage/types.ts` agregar tipos: `Goal`, `Rhythm`, `RhythmEntry`, `CreateGoalInput`, `UpdateGoalPatch`, `CreateRhythmInput`, `UpdateRhythmPatch`, `CreateRhythmEntryInput`. Extender `UpdateTaskPatch` con `bucket?` y `UpdateListPatch` con `goalId?`.
- [ ] 2.2 Extender `StorageProvider` con métodos: `getGoal`, `listGoals`, `createGoal`, `updateGoal`, `deleteGoal`, `getRhythm`, `listRhythms`, `createRhythm`, `updateRhythm`, `deleteRhythm`, `listRhythmEntries(rhythmId, since?)`, `upsertRhythmEntry(input)`, `listTasksByBucket(userId, bucket)`.

## 3. Storage — D1 implementation

- [ ] 3.1 En `apps/api/src/storage/d1.ts` implementar los nuevos métodos. `upsertRhythmEntry` usa `ON CONFLICT(user_id, rhythm_id, date) DO UPDATE SET kind=excluded.kind`.
- [ ] 3.2 Extender `getSyncSnapshot` para incluir `goals`, `rhythms`, `rhythm_entries` con el mismo criterio `since`. Devolver `bucket` en `tasks` y `goal_id` en `lists`.
- [ ] 3.3 Actualizar `pushTasks` para aceptar `bucket` en `CreateTaskInput`.

## 4. API — goals

- [ ] 4.1 Crear `apps/api/src/routes/goals.ts` con CRUD: `GET /api/goals`, `POST /api/goals`, `PATCH /api/goals/:id`, `DELETE /api/goals/:id`. Validación: `title` no vacío; `status ∈ active|done|abandoned`.
- [ ] 4.2 Rate limit por IP en cada ruta con un `route` distinto (`goals_read`, `goals_write`).
- [ ] 4.3 Montar en `apps/api/src/index.ts`.

## 5. API — rhythms

- [ ] 5.1 Crear `apps/api/src/routes/rhythms.ts` con CRUD: `GET /api/rhythms`, `POST /api/rhythms`, `PATCH /api/rhythms/:id`, `DELETE /api/rhythms/:id`.
- [ ] 5.2 `GET /api/rhythms/:id/entries?since=YYYY-MM-DD` lista entries.
- [ ] 5.3 `POST /api/rhythms/:id/entries` con body `{ date, kind }`. Validar `kind ∈ full|minimum|missed` y `date` formato `YYYY-MM-DD`.
- [ ] 5.4 Rate limit y montaje en `index.ts`.

## 6. API — task & list patches

- [ ] 6.1 Extender `PATCH /api/tasks/:id` (en `routes/tasks.ts`) para aceptar `bucket ∈ now|next|someday`. Validar server-side.
- [ ] 6.2 Extender `PATCH /api/lists/:id` (en `routes/lists.ts`) para aceptar `goal_id` (string o null). Validar ownership del goal.

## 7. Frontend — api client

- [ ] 7.1 En `apps/web/src/lib/api.ts` agregar métodos: `listGoals`, `createGoal`, `patchGoal`, `deleteGoal`, `listRhythms`, `createRhythm`, `patchRhythm`, `deleteRhythm`, `listRhythmEntries`, `logRhythmEntry`.
- [ ] 7.2 Extender tipos: `ApiGoal`, `ApiRhythm`, `ApiRhythmEntry`. Extender `ApiTask` con `bucket` y `ApiList` con `goalId`.

## 8. Frontend — Home sections

- [ ] 8.1 En `apps/web/src/routes/Home.svelte` introducir estado `bucket: 'now'|'next'|'someday'|'done'` por sección.
- [ ] 8.2 Renderizar las cuatro secciones en orden estricto con headers mono y conteos.
- [ ] 8.3 Filtros: tareas completadas a Hechos; tareas no completadas por bucket.
- [ ] 8.4 Control de bucket inline por tarea (menú de 3 opciones), optimistic update con rollback en error.
- [ ] 8.5 Mantener la identidad visual (lime, charcoal, sin decoración nueva).

## 9. Frontend — Goals sub-section

- [ ] 9.1 Crear sub-sección "Objetivos" en Home: lista de goals con título, descripción colapsable y estado.
- [ ] 9.2 Botón "Nuevo objetivo" → modal/input sobrio para crear.
- [ ] 9.3 Editar / eliminar inline (sin modal pesado).

## 10. Frontend — Ritmos sub-section

- [ ] 10.1 Sub-sección "Ritmos" en Home (entre Próximo y Algún día).
- [ ] 10.2 Lista de rhythms con barra `███████░  6 / 7` (mono, small).
- [ ] 10.3 Toggle FULL / MINIMUM / MISSED para el día de hoy; edición para días pasados.
- [ ] 10.4 Botón "Nuevo ritmo" → input sobrio.

## 11. Frontend — Project → Goal selector

- [ ] 11.1 Dentro del panel de edición de un proyecto (en sidebar o task list), agregar selector discreto de goal.

## 12. Verificación

- [ ] 12.1 Build: `npm run typecheck` para api; `npm run build:web` para web.
- [ ] 12.2 Deploy: aplicar migración 0005 en remote, luego `wrangler deploy --keep-vars` en api y web.
- [ ] 12.3 Smoke test manual: crear goal → crear proyecto → asignar proyecto a goal → crear tarea → mover entre Ahora/Próximo/Algún día → crear rhythm → marcar FULL/MINIMUM/MISSED → ver sync.

## 13. Notas

- No se renombra `lists` → `projects` en la DB. El concepto user-facing es "proyecto".
- No se introducen notificaciones ni gamificación.
- No se agrega entrada al nav principal.