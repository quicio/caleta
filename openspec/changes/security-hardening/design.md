## Context

El MVP está en producción contra `hg-moraga.workers.dev` y se mantiene con un workflow de deploy único (`deploy.yml`) que buildea + aplica Terraform. La auditoría inicial (ver [README](../README.md)) enumeró 19 hallazgos en seguridad, CI y hardening. Este cambio opera sobre los 9 hallazgos de **alto impacto y bajo costo**: SQL injection en sync, OAuth sin state, persist-credentials en Actions, headers faltantes, errores verbosos, typecheck ausente en CI, validación de longitud, `email_verified` y paridad de `compatibility_date`.

Los hallazgos que requieren refactor mayor (autenticación por cookie httpOnly, refresh tokens, rate limiting, tfstate remoto, framework de tests) quedan explícitamente fuera de alcance — son cambios futuros que viven en sus propios specs.

## Goals / Non-Goals

**Goals:**
- Cerrar los hallazgos críticos y altos con diffs pequeños y trazables.
- Mantener el contrato HTTP observable desde el cliente (un login legítimo no cambia; un `since` legítimo se sigue aceptando).
- No introducir dependencias runtime nuevas.
- Cubrir con typecheck el camino de build del Worker.

**Non-Goals:**
- Reemplazar el flujo OAuth por auth-code + cookie httpOnly.
- Introducir refresh tokens o reducir el TTL del JWT.
- Rate limiting por IP/token.
- Backend remoto para tfstate (R2/S3) o Dependabot.
- Framework de tests unitarios.

## Decisions

### 1. `since` se bindea en `getSyncSnapshot`

**Decisión:** cambiar el patrón del archivo. En vez de `${sinceFilter}` inline, dos statements preparados (`since == null` y `since != null`) con `?2` bindeado.

**Razón:** es la técnica que ya usa el resto del archivo (`listLists`, `listTasksInList`); mantener el mismo patrón es defensa en profundidad. El costo es una rama más en la función, sin costo de runtime medible.

**Alternativa considerada:** seguir escapando `'` con `''` — descartada porque no cubre `--` ni caracteres de control de SQL fuera del literal.

### 2. `state` de OAuth en cookie httpOnly, no KV

**Decisión:** cookie `caleta_oauth_state` con `Path=/auth/`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=600`. Se setea en `/auth/google` antes del redirect a Google; se lee y borra en `/auth/google/callback`.

**Razón:** KV sería stateless pero añade una dependencia de runtime y un round-trip por callback. La cookie vive en el mismo dominio del Worker (`.workers.dev`) y se borra al validar. No uso el prefijo `__Host-` porque exige `Path=/`, lo que haría la cookie visible para otros endpoints del Worker.

**Alternativa considerada:** KV binding — descartada por simplicidad. Sesión firmada — descartada porque el state ya es un secreto random de 128 bits con CSPRNG, no necesita integridad criptográfica extra.

### 3. `persist-credentials: false` y push del tfstate vía `${{ github.token }}`

**Decisión:** checkout sin persistir credenciales; el step "Commit updated tfstate" usa `git -c credential.helper= -c http.extraheader="Authorization: Bearer $GITHUB_TOKEN"` o, más simple, reusa el `actions/checkout` con token explícito en `with.token`.

**Razón:** el token de GitHub Actions no debe quedar en `.git/config` de un runner. Si llega un PR de un fork con steps maliciosos, ese token sería exfiltrable vía cualquier llamada al runner.

**Alternativa considerada:** usar un PAT dedicado — descartada por agregar manejo de secretos extra. La opción que finalmente implementamos: checkout normal con `persist-credentials: false` y, para el push del tfstate, `git push` con un helper de credenciales inline de una línea.

### 4. Headers de seguridad en un solo middleware

**Decisión:** un middleware nuevo en `apps/api/src/index.ts` después del CORS que setea `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, y CSP estricta (`default-src 'none'; frame-ancestors 'none'`) para responses JSON. CSP del HTML queda fuera (meta tag o header del Worker de assets).

**Razón:** un solo middleware evita repetir headers en cada route. La CSP es `default-src 'none'` porque la API solo responde JSON; nunca debería ser consumida por un navegador como página.

### 5. `onError` genérico

**Decisión:** el handler global devuelve `{ error: "internal error" }` con status 500; el detalle se loggea con `console.error` (visible en `wrangler tail`).

**Razón:** cualquier `throw` con mensaje técnico (D1, jose, etc.) puede filtrar información interna. El cliente no necesita el detalle.

### 6. Validación de longitud como guard temprano

**Decisión:** funciones `validateCreateInput`/`validateListCreate` chequean `title.length ≤ 500`, `description.length ≤ 5000`, `name.length ≤ 120` antes de tocar la DB.

**Razón:** corte temprano evita que un cliente envíe `title` de 10 MB y consuma cuota gratuita de D1.

### 7. Test ad-hoc para el fix de inyección

**Decisión:** un único test runner-less en `apps/api/test/sync-no-injection.test.ts`. Construye un mock mínimo de `D1Database` que captura el SQL recibido y los binds, llama `getSyncSnapshot` con un payload inyectado, y assert que la cadena cruda no aparece en el SQL.

**Razón:** la regla ponytail dice "non-trivial logic deja un runnable check detrás". Un mock de 20 líneas basta para que el fix se rompa visiblemente si alguien vuelve al patrón anterior.

## Risks / Trade-offs

- **Trade-off:** este cambio incrementa el tamaño del bundle del Worker en unos pocos KB (headers, parseo de cookie). Aceptable para hobby.
- **Riesgo:** si Google desactiva `email_verified` por alguna razón atípica, el login deja de funcionar globalmente. Mitigación: `email_verified === false` falla cerrado pero tolerante (`undefined` se acepta como `true` para no romper a usuarios existentes que vinieron antes del fix). Documentado en spec.
- **Riesgo:** `persist-credentials: false` complica el push del tfstate. Mitigación: usar un helper de credenciales inline de una línea en el step de commit.
- **Riesgo:** el test ad-hoc de inyección es frágil si la firma de `D1PreparedStatement` cambia. Mitigación: usa solo `prepare(...).bind(...).first/all()` con `.sql` opcional (no obligatorio); si el binding no expone `sql`,assert sobre los argumentos bindeados.