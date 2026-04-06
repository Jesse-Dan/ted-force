# Core runtime notes

## Current decision

Use AI SDK types directly for v2 runtime plumbing instead of preserving custom prompt and transport payload types from v1.

## Implemented

- `MessageBundleBuilder` for assembling `ModelMessage[]`
- `ParameterBundleBuilder` for model and response settings
- `ToolBundleBuilder` for compiling AI SDK tools
- `AgentToolDefinitionBuilder` for converting:
  - enabled platform tools from capability policy
  - enabled agent tools from `AgentTool` entities
- `RuntimePayloadBuilder` for the final runtime request shape
- `AgentBundlingEngine` to compose all bundles together
- `SseWriter` and `SseResponsePipe` for clean SSE transport
- `AgentRuntimeRepository` for loading runtime dependencies
- `LanguageModelResolverService` for provider/model resolution
- `AgentRuntimeService` for the first end-to-end SSE runtime path
- `POST /agents/:agentId/runtime` endpoint as the first runtime controller
- `POST /runtime/agents/:agentId` as a shared API-runtime SSE entry point
- `AgentRuntimePersistenceRepository` for runtime persistence writes
- `AgentRuntimePersistenceService` for:
  - `RuntimeRun` creation/finalization
  - `RuntimeMessage` persistence
  - `TokenUsageSession` recording
  - `ApiCallLog` recording
- `AgentRuntimeRequestDto` as the validated Fragment DTO for runtime requests
- `mock` runtime mode for safe test responses without a live provider call
- runtime requests now send only fresh user input and conversation identifiers
- runtime requests now optionally accept `fileIds`, `reasoning`, and `webSearch`
- conversation history is loaded from persisted conversation entities instead of request bodies
- public agent bootstrap now provisions conversation state before runtime calls
- conversation message attachments are linked internally through stored file records
- `AgentRuntimeFileContextService` resolves linked files into reusable model context
- `web_search` can now be enabled or disabled per request without changing the stored capability policy
- files can now be ingested before runtime through a dedicated upload path that returns a persisted `fileId`
- parsed file text is stored on `StoredFile` and reused when building runtime file context

## Why this is better

- less type drift between app code and model runner code
- easier upgrade path with AI SDK primitives
- cleaner separation between domain entities and runtime transport
- fewer TUUL-specific wrapper types to maintain
- SSE is now the primary response transport for runtime responses
- users can test agent behavior shape without incurring live model cost
- DTO validation now matches Fragment's request binding model more closely

## Next runtime steps

1. wire real execution handlers for platform tools
2. wire real execution handlers for agent tools
3. add auth/org guardrails around runtime access
4. extend the same SSE request/response contract across more public and organization entry points
5. persist richer assistant payloads beyond plain text when tool/results are emitted
