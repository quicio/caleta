# session-hardening

Reduce la ventana de exposición de un JWT robado (TTL 1h + refresh sliding vía `X-Refresh-Token`) y agrega rate limiting por IP/usuario en endpoints sensibles (auth callback, sync push).