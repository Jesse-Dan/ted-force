# Migration roadmap

## Foundation

- bootstrap Fragment app cleanly
- establish shared guards, filters, and interceptors
- define response contracts
- define auth and organization context strategy

## Early modules

- `status`
- `organization`
- `config`
- `environment`
- `files`

## Core domain modules

- `agent`
- `tools`
- `preferences`
- `version-control`
- `api-runtime`

## Cut-over principle

Move by bounded context. Do not mix incomplete route copies with new behavior unless the transition is explicitly tracked.
