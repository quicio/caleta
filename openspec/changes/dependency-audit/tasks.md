## 1. Dependabot

- [ ] 1.1 Crear `.github/dependabot.yml` con un solo ecosystem `npm`, schedule semanal, target branch `main`, labels `dependencies`, commit prefix `deps`, `open-pull-requests-limit: 5`, `rebase-strategy: auto`. Ignorar `wrangler` y `undici` (transitiva de wrangler; bumpearlos requiere cambios manuales).

## 2. Audit en CI

- [ ] 2.1 En `.github/workflows/ci.yml`: añadir step `Audit (runtime)` entre `Install deps` y `Typecheck (api)`, comando `npm audit --omit=dev --audit-level=high`.
- [ ] 2.2 En `.github/workflows/deploy.yml`: añadir el mismo step entre `Install deps` y `Typecheck`.

## 3. Validación

- [ ] 3.1 `openspec validate dependency-audit` sin errores.
- [ ] 3.2 CI en el PR verde.