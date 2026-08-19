## Why

`npm audit` reporta 9 vulnerabilidades (5 high, 4 moderate) en transitivas que entran vía `wrangler` (devDep) pero el repo no tiene automatización para enterarse cuando aparece una nueva ni para abrir PRs de bump. Este cambio agrega dos capas:

1. **Dependabot**: PRs semanales agrupados por ecosistema, con `npm audit` corriendo en cada PR, scope de ignore configurable, labels automáticas.
2. **`npm audit` en CI**: un step que corre `npm audit --omit=dev --audit-level=high` después de `npm ci`. Falla el job si hay vulnerabilidades altas en runtime deps.

`--omit=dev` porque las devDeps no se deployan al runtime; auditar el dev también sería ruido (la mayoría de las vulnerabilidades actuales son de `wrangler`/`esbuild`/`undici` que solo afectan el dev local).

## What Changes

- `.github/dependabot.yml` nuevo: schedule semanal (lunes 09:00 UTC), ecosystem `npm`, target `main`, labels `dependencies`, reviewers nulos (es hobby). Ignora `wrangler` por ahora porque bumpearlo a v4 requiere cambios manuales que ya están en el backlog.
- `.github/workflows/ci.yml`: nuevo step `Audit (runtime)` que corre `npm audit --omit=dev --audit-level=high` después de `npm ci`.
- `.github/workflows/deploy.yml`: mismo step de audit antes del `Terraform Apply`.

## Capabilities

### New Capabilities

- `dependency-security`: define que el repo audita vulnerabilidades en runtime deps en cada CI y propone bumps automáticos vía Dependabot.

## Impact

- Sin cambios de código runtime.
- Sin cambios de schema ni de infra productiva.
- Riesgos: PRs automáticos de Dependabot podrían ser ruidosos si el ecosistema cambia muy rápido. Mitigación: `open-pull-requests-limit: 5` y `rebase-strategy: auto`.