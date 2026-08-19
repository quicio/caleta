## Purpose

Define la política de auditoría de dependencias del proyecto: qué se audita, con qué severidad falla el CI, y cómo se mantienen actualizadas las versiones.

## ADDED Requirements

### Requirement: Dependabot proposes weekly version bumps

El archivo `.github/dependabot.yml` MUST configurar Dependabot para abrir PRs automáticos al menos una vez por semana, agrupados por ecosistema `npm`, contra la rama `main`.

#### Scenario: schedule and target
- **WHEN** se cumple el schedule configurado (lunes 09:00 UTC)
- **THEN** Dependabot abre un PR por cada update disponible, con label `dependencies` y commit prefix `deps`.

#### Scenario: open PR limit
- **WHEN** hay más de 5 PRs abiertos por Dependabot
- **THEN** no se abren más hasta que se cierren algunos (`open-pull-requests-limit: 5`).

#### Scenario: ignored packages
- **WHEN** un update afectaría a un package en la lista de ignore (`wrangler`, `undici`)
- **THEN** Dependabot no abre PR para ese package.

### Requirement: CI fails on high-severity runtime vulnerabilities

Cada workflow de CI MUST correr `npm audit --omit=dev --audit-level=high` después de `npm ci`. Si hay vulnerabilidades con severidad `high` o `critical` en dependencies de runtime, el job falla.

#### Scenario: no high vulnerabilities
- **WHEN** el audit no encuentra vulnerabilidades `high` o `critical` en runtime deps
- **THEN** el step pasa y el job continúa.

#### Scenario: high vulnerability detected
- **WHEN** el audit encuentra al menos una vulnerabilidad `high` o `critical`
- **THEN** el step falla con exit code no-cero y el job se detiene.

#### Scenario: only dev vulnerabilities
- **WHEN** las únicas vulnerabilidades son en devDeps
- **THEN** el audit pasa (porque corre con `--omit=dev`).

### Requirement: Audit runs on every PR and on deploy

El audit MUST correr en `.github/workflows/ci.yml` (PRs) y en `.github/workflows/deploy.yml` (push a main).

#### Scenario: PR triggers audit
- **WHEN** se abre un PR contra main
- **THEN** el workflow `ci` corre y falla si hay vulnerabilidades altas.

#### Scenario: push to main triggers audit
- **WHEN** se hace push a main
- **THEN** el workflow `deploy` corre el audit antes de aplicar Terraform.