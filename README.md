# TUUL Service v2

This service is the Fragment-based successor to `digitwhale_tuul_service`.

## Migration strategy

The migration is intentionally incremental. We are not rewriting all of v1 at once.

### Rules

1. Keep `v1` as the production reference while `v2` gains parity module by module.
2. Migrate by bounded context, not by random file copy.
3. Move shared business rules into `v2` services first, then expose routes.
4. Prefer low-coupling slices first so we can validate the Fragment structure early.
5. Only cut traffic to `v2` after a module reaches parity and has been shadow-validated.

## Current structure

- `src/main.ts`: Fragment application bootstrap.
- `src/common`: shared helpers, contracts, middlewares, guards, and filters.
- `src/config`: typed configuration adapters.
- `src/core/ai`: AI SDK-native bundling, runtime payloads, and SSE helpers.
- `src/entities`: shared entities.
- `src/migrations`: database migrations.
- `src/memory`: process memory and migration notes.
- `src/modules/migration`: v1-to-v2 inventory and migration registry.
- `src/modules/app`: root app surface.
- `src/modules/auth`: authentication and identity concerns.
- `src/modules/organization`: organization and membership domain.
- `src/modules/agent`: core v2 agent domain.
- `src/modules/config`: agent configuration.
- `src/modules/environment`: environment variable management.
- `src/modules/files`: file management.
- `src/modules/preferences`: persona, niche, capabilities, and related preferences.
- `src/modules/tools`: tool definitions and execution support.
- `src/modules/version-control`: instances and change history.
- `src/modules/api-runtime`: runtime and model gateway concerns.
- `src/modules/onboarding`: onboarding workflows.
- `src/modules/public`: public, non-authenticated surfaces.
- `src/modules/status`: health/status contracts and services.
- `src/tools/print-migration-report.ts`: CLI report of what should be migrated next.

## Suggested first execution slices

1. `status`
2. `organizations`
3. `config`
4. `environment`
5. `agents`

Run `npm run migration:report` inside this folder to view the current migration queue.

## Intended module tree

```text
src/
├── common/
├── config/
├── entities/
├── memory/
├── migrations/
├── modules/
│   ├── app/
│   ├── auth/
│   ├── organization/
│   ├── agent/
│   ├── config/
│   ├── environment/
│   ├── files/
│   ├── preferences/
│   ├── tools/
│   ├── version-control/
│   ├── api-runtime/
│   ├── onboarding/
│   ├── public/
│   ├── status/
│   └── migration/
└── tools/
```

Fragment v2 does not use empty `*Module` placeholder classes here. The module boundaries are expressed by folders, controllers, services, entities, and core runtime helpers.
