# auth-cookie-hardening

Cierra el eslabón más débil del MVP: el JWT vive en `localStorage` (XSS exfiltration). Migra a cookie `__Host-caleta_session` httpOnly+Secure+SameSite=Lax, usando auth code de un solo uso en el redirect. La SPA nunca toca el JWT.