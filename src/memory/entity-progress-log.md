# Entity progress log

## Wave 1

- implemented `UserAccount`
- implemented `Organization`
- implemented `OrganizationMembership`
- implemented `Agent`
- implemented `AgentConfig`

## Wave 2

- implemented `AgentEnvironmentVariable`
- implemented `StoredFile`
- implemented `AgentInstance`
- implemented `AgentVersionEntry`
- implemented `AgentTool`
- implemented `ToolMemoryEntry`

## Wave 3

- implemented `AgentParameter`
- implemented `VoiceProfile`
- implemented `CapabilityProfile`
- implemented `CapabilityToolPolicy`
- implemented `ContextRuleSet`
- implemented `AgentAnalytics`
- implemented `Asset`
- implemented `ExternalResource`
- implemented `DataSourceConnection`
- implemented `DomainTemplate`
- implemented `OrganizationHealth`
- implemented `OrganizationProfile`
- implemented `OrganizationInvitation`
- implemented `PlatformTool`
- implemented `WaitlistEntry`

## Wave 4

- implemented `RuntimeRun`
- implemented `RuntimeMessage`
- implemented `ApiCallLog`
- implemented `ActivityLog`
- implemented `AwarenessRecord`
- implemented `TokenUsageSession`
- implemented `BillingLedgerEntry`
- implemented `BillingReport`

## Notes

- v2 names now consistently use `agent` instead of `project`
- version and tool runtime concepts have been separated into clearer entities
- file storage moved from `TFile` to `StoredFile`
- future work should introduce run and message entities once the runtime module shape is settled
- runtime core is now being built separately from entities so payload contracts stay clean
- waitlist now has a richer intake model with sender and request context
- runtime messages now store AI SDK-aligned `ModelMessage` and `UIMessage` payloads
