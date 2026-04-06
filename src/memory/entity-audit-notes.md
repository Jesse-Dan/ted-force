# Entity audit notes from v1

## What v1 already gets right

- strong separation of many business concerns into separate tables
- tenancy model exists through organization membership
- runtime/version history exists
- tools and memory are modeled independently

## What is awkward in v1

- `project` and `agent` naming are mixed together
- some class names are too implementation-specific or product-specific
- several entities use broad JSON without clear aggregate boundaries
- some timestamps that look like soft deletes are plain columns instead of TypeORM soft-delete support
- relation field names sometimes point to old concepts

## Specific observations

### `project.entity.ts`

- Class is already called `Agent`, but table and property names are still project-centric.
- `project_id` is unclear because the primary key already exists as `id`.
- `metadata` is useful, but some fields may deserve more explicit modeling later.

### `project-config.entity.ts`

- mixes API access, rate limiting, security posture, and model tuning in one table
- still acceptable as a first v2 `AgentConfig`, but may later split into:
  - access config
  - model config
  - runtime limits

### `project-parameter.entity.ts`

- acts more like a versioned profile/prompt snapshot than simple parameters
- should not stay named as generic “parameters” in v2

### `project-instance.entity.ts`

- good concept, but naming should align to `AgentInstance`
- `deletedAt` should become a real soft-delete column

### `file.entity.ts`

- good metadata richness
- class name `TFile` should be replaced by `StoredFile`
- explicit `projectId` plus relation is useful and should be kept, but renamed to `agentId`

### `tuul.entity.ts`

- useful tool model, but product naming hides the intent
- `AgentTool` is clearer and easier to onboard new developers to
