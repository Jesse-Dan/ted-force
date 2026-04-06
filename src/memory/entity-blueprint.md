# TUUL v2 entity blueprint

## Intent

Mirror v1 capability, but make the model clearer, more consistent, and easier to evolve in Fragment.

## Core design decisions

### 1. Name by business meaning, not by migration history

- v1 `Project` becomes v2 `Agent`
- v1 `ProjectConfiguration` becomes v2 `AgentConfig`
- v1 `ProjectParameters` becomes v2 `AgentProfileSnapshot` or `AgentPromptSnapshot`
- v1 `ProjectTuul` becomes v2 `AgentTool`
- v1 `ProjectInstance` becomes v2 `AgentInstance`

### 2. Separate aggregate roots from snapshots

Some v1 entities mix current state and version history together. In v2:

- `Agent` is the root aggregate
- `AgentConfig` is the current runtime configuration
- `AgentProfileSnapshot` stores versioned prompt/profile state
- `AgentInstance` stores deployable/runtime instance state
- `AgentVersionEntry` stores commit/release history

### 3. Prefer explicit ownership columns

Most major business entities should answer these questions quickly:

- who owns this?
- which organization does it belong to?
- which agent does it belong to?

That means clearer foreign keys and stable naming:

- `owner_user_id`
- `organization_id`
- `agent_id`

### 4. Standardize audit columns

Use shared base entities for:

- `id`
- `created_at`
- `updated_at`
- optional `deleted_at`

### 5. Keep JSON where it adds leverage, not vagueness

JSON is useful for:

- model/provider tuning blobs
- tool schemas
- rich message payloads
- flexible metadata

JSON is not ideal for:

- core ownership relationships
- statuses
- frequently queried business fields

Use typed columns and enums for those.

## Proposed v2 domains

### Identity and tenancy

- `UserAccount`
- `Organization`
- `OrganizationMembership`
- `OrganizationInvitation`
- `OrganizationHealth`
- `OrganizationProfile`

### Agent core

- `Agent`
- `AgentConfig`
- `AgentProfileSnapshot`
- `VoiceProfile`
- `CapabilityProfile`
- `ContextRuleSet`
- `AgentEnvironmentVariable`

### Agent runtime and versioning

- `AgentInstance`
- `AgentVersionEntry`
- `AgentChangeItem`
- `Run`
- `PublishRun`
- `TestRun`
- `TokenUsageSession`

### Tools and memory

- `AgentTool`
- `ToolMemoryEntry`
- `PlatformTool`
- `CapabilityToolPolicy`

### Knowledge and resources

- `Asset`
- `ExternalResource`
- `StoredFile`
- `DataSourceConnection`

### Messaging and observability

- `RichMessage`
- `ApiCallLog`
- `ActivityLog`
- `AgentAnalytics`
- `BillingLedgerEntry`
- `BillingReport`

## Proposed aggregate boundaries

### Organization aggregate

- `Organization`
- `OrganizationMembership`
- `OrganizationInvitation`
- `OrganizationHealth`
- `OrganizationProfile`

### Agent aggregate

- `Agent`
- `AgentConfig`
- `AgentProfileSnapshot`
- `VoiceProfile`
- `CapabilityProfile`
- `ContextRuleSet`
- `AgentEnvironmentVariable`

### Runtime aggregate

- `AgentInstance`
- `AgentVersionEntry`
- `Run`
- `RichMessage`

### Tools aggregate

- `AgentTool`
- `ToolMemoryEntry`

## Improvements over v1

### Naming cleanup

- remove mixed `project` and `agent` naming inside the same entity graph
- stop using class names like `TFile` and `ProjectTuul`
- rename ambiguous `tuul_user` style concepts into more standard domain names

### Relationship clarity

- avoid relation names like `project` on an `Agent`-based model
- use `agent`, `organization`, `ownerUser`, `instance` consistently
- prefer explicit foreign key columns when they are queried directly

### Better technical shape

- use base classes for audit behavior
- use `DeleteDateColumn` for soft deletes instead of manual nullable timestamps
- promote critical enums to shared domain enums
- isolate versioned snapshot data from mutable current config

## High-value entity renames

| v1 entity | v2 entity |
| --- | --- |
| `Agent` class in `project.entity.ts` | `Agent` |
| `ProjectConfiguration` | `AgentConfig` |
| `ProjectParameters` | `AgentProfileSnapshot` |
| `ProjectTuul` | `AgentTool` |
| `ProjectInstance` | `AgentInstance` |
| `VersionEntryData` | `AgentVersionEntry` |
| `ProjectEnvVar` | `AgentEnvironmentVariable` |
| `TFile` | `StoredFile` |
| `TuulUser` | `UserAccount` |
| `OrganizationBackstory` | `OrganizationProfile` |

## Suggested first v2 entity implementation order

1. `UserAccount`
2. `Organization`
3. `OrganizationMembership`
4. `Agent`
5. `AgentConfig`
6. `AgentEnvironmentVariable`
7. `StoredFile`
8. `AgentInstance`
9. `AgentVersionEntry`
10. `AgentTool`

## Implemented now

- `UserAccount`
- `Organization`
- `OrganizationMembership`
- `Agent`
- `AgentConfig`
- `AgentEnvironmentVariable`
- `StoredFile`
- `AgentInstance`
- `AgentVersionEntry`
- `AgentTool`
- `ToolMemoryEntry`

## Rules for future entities

1. One entity should have one obvious responsibility.
2. If an object is versioned, model the snapshot explicitly.
3. Avoid embedding primary business concepts inside generic `metadata` JSON when they need querying.
4. Prefer singular class names and stable table names.
5. Name properties for the domain we want in v2, not the one we inherited from v1.
