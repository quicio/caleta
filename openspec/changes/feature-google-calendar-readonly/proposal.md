## Why

La vista Calendario es hoy un placeholder ("Próximamente") desde `feature-mapa-view`. El usuario pidió que caleta muestre su calendario real — no una lista estilizada — para tener una sola vista donde converjan las tareas propias y los compromisos externos (reuniones, deadlines que viven en Calendar, eventos personales).

El alcance es read-only MVP: la app consume Google Calendar vía `calendar.readonly`, lista eventos en una ventana de tiempo, los muestra agrupados por día. Sin escritura, sin sync bidireccional, sin subscripciones por calendario. Esa simplicidad evita todo el problema de conflict resolution y mantiene el cambio acotado.

## What Changes

- **OAuth scope**: el redirect a Google suma `https://www.googleapis.com/auth/calendar.readonly` al scope existente.
- **Token storage**: persistimos el `refresh_token` de Google en la fila del usuario (migración 0003). El `access_token` es efímero — se canjea en cada request al endpoint de Calendar.
- **Endpoint nuevo**: `GET /api/calendar/events?from=ISO8601&to=ISO8601` que devuelve eventos del calendario primario del usuario autenticado. Paginación de Google manejada internamente.
- **UI**: nueva ruta `/calendario` (reemplaza el placeholder). Componente `Calendario.svelte` con eventos agrupados por día, header con rango y controles prev/next.
- **API helper frontend**: `api.listCalendarEvents(from, to)` que llama al endpoint.

### Fuera de alcance

- Crear/editar/borrar eventos en Google Calendar (escritura).
- Selección de calendario distinto al primario (no se listan calendars del usuario).
- Sincronización bidireccional eventos ↔ tareas.
- Suscripción webhooks / push notifications de Calendar (solo polling al abrir la vista).
- Cache del `access_token` entre requests (se canjea cada vez — aceptable para 1 usuario).
- Time zones configurables: usamos el `timeZone` que devuelve cada evento o UTC como fallback.

## Capabilities

### New Capabilities

- `calendar-view`: capacidad que describe la integración read-only con Google Calendar. Gobierna el endpoint backend, el helper frontend y el componente de UI.

### Modified Capabilities

- `task-sync` (no cambia contrato; el storage sigue siendo D1 sobre `tasks`/`lists`).

## Impact

- Código y archivos afectados:
  - `apps/api/migrations/0003_google_refresh_token.sql` *(nuevo)*: `ALTER TABLE users ADD COLUMN google_refresh_token TEXT`.
  - `apps/api/src/storage/types.ts`: `User.googleRefreshToken` (no se devuelve al cliente).
  - `apps/api/src/storage/d1.ts`: `rowToUser` incluye el campo; nuevos `upsertUser` acepta el campo.
  - `apps/api/src/auth/google.ts`: `buildAuthRedirectUrl` suma el scope; `exchangeCodeForToken` devuelve `refreshToken` opcional.
  - `apps/api/src/auth/token-store.ts` *(nuevo)*: helpers para canjear refresh_token por access_token y guardar/cargar el refresh_token del usuario.
  - `apps/api/src/routes/auth.ts`: el callback persiste `refresh_token` cuando Google lo entrega.
  - `apps/api/src/routes/calendar.ts` *(nuevo)*: `GET /api/calendar/events`.
  - `apps/api/src/index.ts`: monta `calendarRoutes`.
  - `apps/web/src/lib/api.ts`: `listCalendarEvents(from, to)`.
  - `apps/web/src/routes/Calendario.svelte` *(nuevo)*: vista con eventos agrupados.
  - `apps/web/src/App.svelte`: ruta `/calendario` → `Calendario` en lugar de `NavPlaceholder`.
- Dependencias nuevas: ninguna.
- Secretos nuevos: ninguno (usa los `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` existentes).
- Riesgos:
  - Google solo entrega `refresh_token` la primera vez que el usuario autoriza. Si el usuario ya tenía sesión previa con scope menor, hay que forzar re-consent con `prompt=consent` cuando el scope cambia.
  - Access tokens expiran (1h). Si el refresh token está revocado o expiró (>6 meses sin uso), la API de Calendar devolverá 401 → manejamos eso devolviendo un error claro al cliente.
  - El `prompt=select_account` actual en el redirect puede impedir re-consent. Cambio mínimo: si el usuario ya tiene tokens sin Calendar scope, forzamos `prompt=consent`. Esto se detecta chequeando si `googleRefreshToken` ya existe y tiene scope de Calendar — pero como no persistimos scopes, simplificamos: **siempre** enviamos `prompt=consent`. Esto fuerza re-prompt en cada login hasta que el usuario renueve, lo cual es molesto. Mitigación: cambiamos a `prompt=select_account` solo si YA tenemos un refresh_token persistido.