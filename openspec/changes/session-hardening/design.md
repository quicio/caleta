## Context

El MVP está en producción y la auditoría inicial dejó 9 hallazgos críticos/altos ya cerrados en `security-hardening`. Quedan dos riesgos relacionados con la longevidad de la sesión:

- **TTL de 30 días sin refresh**: un JWT capturado es válido por un mes. El cliente lo guarda en `localStorage`; cualquier XSS lo exfiltra y el atacante tiene un mes de acceso sin que el usuario lo note.
- **Sin rate limit**: un atacante puede enumerar códigos de OAuth contra `/auth/google/callback`, abusar de `/api/sync` POST para agotar cuota D1 del free tier, o forzar login CSRF (relevante aún con la cookie de state, porque cada intento legítimo también cuenta).

Este cambio opera sólo sobre la capa de sesión: **TTL corto + refresh sliding** y **rate limit por IP/usuario en endpoints sensibles**. La migración completa a cookie httpOnly (que cerraría también el riesgo de XSS-exfiltration del token) queda como un cambio aparte — `auth-cookie-hardening` — porque requiere rehacer el flow OAuth completo.

Restricciones del entorno:

- Cloudflare Workers KV: free tier 100k reads/día, 1k writes/día, 1 GB. Para hobby sobra. Sin dependencias externas.
- Cloudflare ya tiene Rate Limit rules en el plan de pago. No las usamos (no se puede combinar con lógica por usuario sin request header customization, y queremos control por sub cuando hay JWT).

## Goals / Non-Goals

**Goals:**
- TTL de access token ≤ 1h, con refresh transparente.
- Rate limit en auth callback, login redirect, y sync push.
- Sin romper la API actual: un cliente viejo (que solo lee `#token=...`) sigue funcionando hasta que se actualice.

**Non-Goals:**
- Migrar a cookie httpOnly (cambio aparte).
- Persistir refresh tokens en DB para revocación individual.
- Rate limit por usuario en endpoints no autenticados.
- Almacenar counters en D1.

## Decisions

### 1. Dos tokens: access (1h) + refresh (30d)

**Decisión:** el callback de OAuth emite ambos. El cliente actual los guarda en `localStorage`. El refresh se usa sólo cuando el access falla con 401 (o preventivamente cuando expira pronto, vía header).

**Razón:** el patrón estándar (OAuth2/OIDC). El access corto limita daño por captura; el refresh largo evita pedirle al usuario que re-loggee cada hora.

**Alternativa considerada:** un solo token con TTL 1h y un endpoint `POST /auth/refresh` que pide `{ token }` y responde otro. Más simple, pero más frágil — un refresh comprometido es indistinguible de un access comprometido. Con dos tokens separados, el refresh puede tener más fricción (e.g., rotación) más adelante.

### 2. Refresh sliding via header `X-Refresh-Token`

**Decisión:** cuando el access expira en < 15min, el middleware setea `X-Refresh-Token: <nuevo>` en la response. El cliente lo reemplaza silenciosamente en `localStorage`.

**Razón:** el usuario no nota nada; la sesión se extiende automáticamente. El header está separado del body para no obligar a parsear JSON.

**Alternativa considerada:** refresh sólo cuando hay 401. Más simple pero significa que el primer request después de la hora falla. UX peor.

### 3. Rate limit con KV sliding window

**Decisión:** key = `rl:<route>:<ip>` (o `<userId>` si hay token). Increment con `put` y TTL = windowSec. Si el valor > limit, 429.

**Razón:** sliding window deprecado (cuenta exacta por segundo) usa dos keys (current + previous) y una fórmula. Para hobby el "fixed window con TTL" alcanza: 5 req en 60s en una ventana empieza fresco al expirar. La diferencia con sliding real es aceptable para un atacante humano.

**Alternativa considerada:** sliding window real con dos contadores. Descartada por overhead y porque el `Retry-After` ya se setea con el TTL restante, lo que da el mismo efecto desde la perspectiva del cliente.

### 4. Rate limit en auth (no en todas las rutas)

**Decisión:** aplicar en `/auth/google`, `/auth/google/callback` y `POST /api/sync`. NO aplicar en GET `/api/lists`, `/api/lists/:id/tasks`, `/api/sync` (sync pull) — son reads razonables que un cliente legítimo puede hacer en burst.

**Razón:** los endpoints sin auth no exponen vectores de cuota serios. Los reads autenticados ya están rate-limited implícitamente por la cuota gratuita de Workers. El POST sync es el más caro (escribe a D1) y el más interesante de abusar.

### 5. Refresh token guardado en `localStorage` (mismo lugar que el access)

**Decisión:** mismo storage, mismo riesgo. Esto NO es la solución final — la migración a cookie httpOnly queda para `auth-cookie-hardening`.

**Razón:** este cambio es TTL + rate limit. Mover tokens a cookie es ortogonal. Documentamos el riesgo abierto en la spec.

## Risks / Trade-offs

- **Riesgo:** un atacante con acceso a `localStorage` puede usar tanto el access como el refresh. Mitigación parcial: el TTL corto (1h) limita cuánto tiempo puede actuar sin que el usuario se dé cuenta. Mitigación completa: `auth-cookie-hardening` futuro.
- **Riesgo:** rate limit con fixed window permite ráfagas de 2x al borde de la ventana (10 al segundo 59, 10 al segundo 60). Aceptable para hobby.
- **Riesgo:** KV es eventualmente consistente en writes. Dos requests concurrentes pueden pasar si llegan en el mismo segundo. Aceptable: el rate limit es aproximado por diseño.
- **Trade-off:** un usuario legítimo que abre 6 tabs y refresca sync simultáneamente puede chocar contra el límite de 30/min. Mitigación: el límite está en POST sync, no en GET. Pulls no cuentan.