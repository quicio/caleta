## Purpose

Define el comportamiento contractual del servicio de sincronización de listas y tareas entre dispositivos: cómo se autentican usuarios, qué entidades existen y cómo se sincronizan sus cambios de forma incremental. Esta capacidad es la raíz funcional del producto; la API HTTP y las rutas internas del Worker derivan de sus requisitos, y la abstracción de `StorageProvider` debe cumplirlos en cualquier implementación.

## ADDED Requirements

### Requirement: Google OAuth Authentication

El servicio autentica usuarios vía Google OpenID Connect. Al finalizar el callback el servicio emite un JWT firmado HS256 con duración de 30 días y claims `sub` (Google user id) y `email`.

#### Scenario: Successful sign-in
- **WHEN** el usuario completa el consent screen de Google con scope `openid email profile`
- **THEN** el servicio redirige al `redirect_uri` con un JWT firmado
- **AND** el JWT es verificable con la misma `JWT_SECRET` del entorno

#### Scenario: Missing or expired token
- **WHEN** una request a un endpoint protegido llega sin Authorization header o con un JWT expirado
- **THEN** el servicio responde `401 Unauthorized`

#### Scenario: Bad signing secret at server start
- **WHEN** la variable de entorno `JWT_SECRET` no está definida en runtime
- **THEN** el servidor falla al iniciar con un error explícito, no inicia de forma silenciosa

### Requirement: Users have Lists, Lists have Tasks

Una `List` pertenece a un único usuario (`user_id`). Una `Task` pertenece a una única `List`. Toda lectura/escritura debe estar aislada por `user_id`; un usuario nunca debe poder leer/escribir recursos de otro.

#### Scenario: Creating a list
- **WHEN** un usuario autenticado pide `POST /api/lists` con `{ "name": "Hogar" }`
- **THEN** el servicio crea una lista con un `id` generado, `user_id` tomado del JWT, y responde `201` con la lista creada

#### Scenario: Listing a user's lists
- **WHEN** un usuario autenticado pide `GET /api/lists`
- **THEN** el servicio responde `200` con todas las listas cuyo `user_id` coincide con el del token

#### Scenario: Attempting to access another user's list
- **WHEN** un usuario autenticado pide `GET /api/lists/<other-id>` donde `<other-id>` no le pertenece
- **THEN** el servicio responde `404 Not Found` (no `403`, para no filtrar existencia)

### Requirement: Task CRUD with Required Fields

Una `Task` tiene, como mínimo: `id`, `list_id`, `user_id` (denormalizado para sync), `title`, `description` (opcional), `due_at` (ISO8601, opcional), `completed` (bool), `created_at`, `updated_at`, `deleted_at` (soft delete).

#### Scenario: Creating a task
- **WHEN** un usuario autenticado pide `POST /api/lists/<list-id>/tasks` con `{ "title": "Comprar pan" }`
- **THEN** el servicio crea la tarea, le setea `list_id`, `user_id`, `created_at`, `updated_at`, y responde `201`

#### Scenario: Updating a task
- **WHEN** un usuario autenticado pide `PATCH /api/tasks/<task-id>` con cualquier subset de campos modificables
- **THEN** el servicio actualiza sólo los campos provistos, actualiza `updated_at`, y responde `200` con la tarea nueva

#### Scenario: Deleting a task
- **WHEN** un usuario autenticado pide `DELETE /api/tasks/<task-id>`
- **THEN** el servicio setea `deleted_at` con el timestamp actual (soft delete), actualiza `updated_at`, y responde `204`. No borra físicamente.

#### Scenario: Task without title is invalid
- **WHEN** un cliente intenta `POST` o `PATCH` una task con `title` vacío o ausente
- **THEN** el servicio responde `400 Bad Request`

### Requirement: Incremental Sync by Watermark

El servicio soporta sync incremental basado en la marca `updated_at`. Los dispositivos no necesitan descargar todo: piden sólo lo que cambió desde el último pull.

#### Scenario: Pulling lists since a watermark
- **WHEN** un cliente pide `GET /api/sync?since=<iso8601>`
- **THEN** el servicio responde `200` con un objeto `{ lists: [...], tasks: [...] }` conteniendo sólo las entidades del usuario con `updated_at > since`. La response incluye un header `X-Watermark` con el mayor `updated_at` observado.

#### Scenario: Pushing changes from a device
- **WHEN** un cliente pide `POST /api/sync` con `{ tasks: [{ id, list_id, title, ... }] }` (cliente-generated UUIDv7 ids para tareas nuevas)
- **THEN** el servicio hace upsert por `id`, valida que cada `list_id` pertenezca al usuario, actualiza `updated_at`, y responde `200` con las tareas resultantes

#### Scenario: First sync with no watermark
- **WHEN** un cliente pide `GET /api/sync` sin el parámetro `since`
- **THEN** el servicio responde `200` con todas las listas y tareas no borradas del usuario, y setea `X-Watermark: now`

#### Scenario: Sync payload validation
- **WHEN** un cliente envía `POST /api/sync` con tareas que apuntan a `list_id` que no le pertenecen
- **THEN** el servicio descarta esas tareas, no actualiza nada más, y devuelve `400`

### Requirement: Storage Provider Abstraction

El acceso a almacenamiento se realiza únicamente a través de la interfaz `StorageProvider`, declarada en TypeScript, que define el contrato para todas las operaciones de lectura/escritura usadas por las rutas. La primera implementación es `D1Provider`. Cualquier otra implementación (futura: `PostgresProvider`, etc.) debe implementar la misma interfaz y comportarse idénticamente ante los requisitos anteriores.

#### Scenario: D1Provider implements StorageProvider
- **WHEN** el servicio arranca con la variable de entorno `STORAGE_PROVIDER=d1`
- **THEN** `D1Provider` se instancia y todas las rutas lo consumen vía la misma interfaz. Ninguna ruta importa `D1Provider` directamente.

#### Scenario: Swapping providers requires zero route changes
- **WHEN** un cambio futuro introduce, por ejemplo, `PostgresProvider` que implementa `StorageProvider`
- **THEN** ninguna ruta del código de las API necesita cambiar; sólo se añade un caso nuevo al factory de providers.

### Requirement: Clock and Watermark Determinism

`updated_at` se genera en el servidor (no desde el cliente) para evitar problemas de skew. Para pruebas determinísticas, una variable `CLOCK_FAKE_NOW` (opcional) puede inyectarse en el factory.

#### Scenario: Server-generated updated_at
- **WHEN** el servicio crea o modifica cualquier entidad
- **THEN** el campo `updated_at` se genera con `new Date().toISOString()` del servidor (o el valor inyectado por `CLOCK_FAKE_NOW`).
