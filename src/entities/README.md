# Shared entities

Put cross-module TypeORM entities here when they are reused across multiple domains.

If an entity is tightly coupled to one module, colocating it under that module is also acceptable if the team prefers it.

## Current first-pass entities

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
- `AgentParameter`
- `VoiceProfile`
- `CapabilityProfile`
- `CapabilityToolPolicy`
- `ContextRuleSet`
- `AgentAnalytics`
- `Asset`
- `ExternalResource`
- `DataSourceConnection`
- `DomainTemplate`
- `OrganizationHealth`
- `OrganizationProfile`
- `OrganizationInvitation`
- `PlatformTool`
- `WaitlistEntry`
- `RuntimeRun`
- `RuntimeMessage`
- `ApiCallLog`
- `ActivityLog`
- `AwarenessRecord`
- `TokenUsageSession`
- `BillingLedgerEntry`
- `BillingReport`

## Modeling conventions

- audit fields come from shared base entities
- names use the v2 domain language
- foreign keys prefer `agent_id`, `organization_id`, and `owner_user_id`
- legacy identifiers should be stored explicitly as `legacy_*` fields when needed
