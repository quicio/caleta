## Purpose

Describe la integración read-only con Google Calendar en caleta: almacenamiento del refresh token, endpoint backend que proxea la API de Calendar, y vista frontend que muestra los eventos del usuario agrupados por día.

## ADDED Requirements

### Requirement: OAuth scope ampliado

El redirect de OAuth de Google incluye el scope `https://www.googleapis.com/auth/calendar.readonly` además de los scopes base (`openid email profile`). Esto habilita al backend a leer los eventos del calendario del usuario.

#### Scenario: Primer login del usuario
- **WHEN** el usuario completa el flow de OAuth por primera vez (o cuando no tiene refresh_token persistido)
- **THEN** Google solicita consentimiento incluyendo lectura de calendario, y devuelve un `refresh_token`

#### Scenario: Login subsiguiente sin scope de Calendar
- **WHEN** el usuario ya tenía un refresh_token persistido pero sin scope de Calendar
- **THEN** el backend fuerza `prompt=consent` para que Google muestre la pantalla de consentimiento con el scope adicional

### Requirement: Persistencia del refresh token

El `refresh_token` que entrega Google se guarda en la fila del usuario en la tabla `users` (columna `google_refresh_token`). Nunca se devuelve al cliente.

#### Scenario: Callback de OAuth completa
- **WHEN** Google devuelve un `refresh_token` en el token exchange
- **THEN** el backend lo persiste en `users.google_refresh_token` antes de redirigir al callback del cliente

#### Scenario: Refresh token ausente
- **WHEN** Google NO devuelve `refresh_token` (caso típico: el usuario ya tenía un refresh_token válido y Google omite uno nuevo)
- **THEN** el backend no modifica `users.google_refresh_token`; el existente se conserva

### Requirement: Endpoint `GET /api/calendar/events`

Endpoint autenticado que devuelve los eventos del calendario primario del usuario en una ventana de tiempo.

#### Scenario: Request válido
- **WHEN** el cliente llama a `GET /api/calendar/events?from=2026-08-25T00:00:00Z&to=2026-09-01T00:00:00Z`
- **THEN** el backend canjea el refresh_token por un access_token, llama a `https://www.googleapis.com/calendar/v3/calendars/primary/events` con `timeMin=from`, `timeMax=to`, `singleEvents=true`, `orderBy=startTime`, junta todas las páginas si `nextPageToken` está presente, y devuelve `{ events: [...] }`

#### Scenario: Sin refresh_token persistido
- **WHEN** el usuario nunca autorizó el scope de Calendar
- **THEN** el endpoint responde `403` con `{ error: "calendar not connected" }`. El cliente debe mostrar un CTA para re-loguear con scope ampliado

#### Scenario: Access token expirado o refresh revocado
- **WHEN** Google devuelve 401 desde la API de Calendar
- **THEN** el endpoint responde `401` con `{ error: "google_reauth_required" }`

### Requirement: Forma del evento

Cada evento devuelto tiene la forma:
```ts
{
  id: string;
  summary: string;
  start: { iso: string; date?: string; timeZone?: string };
  end: { iso: string; date?: string; timeZone?: string };
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
  calendarName: string;
}
```

`allDay=true` cuando Google devuelve `date` (no `dateTime`). Para eventos con `dateTime`, normalizamos a ISO 8601 con offset.

### Requirement: Vista Calendario

Reemplaza el `NavPlaceholder` en `/calendario`. El componente:
- Header con el rango visible (ej: "25 ago — 1 sep") y botones `←` `→` y "hoy".
- Por defecto, muestra los próximos 7 días desde hoy.
- Eventos agrupados por día. Cada grupo tiene un header con la fecha ("lunes 25 de agosto") y un contador.
- Cada evento es una fila con hora (o "todo el día"), summary, ubicación, y link externo (ícono).

#### Scenario: Sin eventos en el rango
- **WHEN** el API devuelve `events: []`
- **THEN** la vista muestra el empty state con copy "Sin eventos en este rango."

#### Scenario: Error 403 calendar not connected
- **WHEN** el API responde `calendar not connected`
- **THEN** la vista muestra un CTA "Conectar Google Calendar" que dispara un nuevo OAuth (con `prompt=consent` forzado).

## NON-GOALS (explícitos)

- No hay escritura sobre Calendar.
- No se listan calendars del usuario — siempre se usa `primary`.
- No hay webhooks / push notifications — solo polling al abrir la vista.
- No hay cache de access_tokens entre requests.
- No hay time zone configurable — se respeta el `timeZone` que devuelve cada evento.