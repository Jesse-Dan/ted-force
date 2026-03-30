export type AgentAccessScope = 'management' | 'runtime';

export interface AgentAccessContext {
  agentId?: string;
  organizationId?: string;
  userId?: string;
  apiKeyId?: string;
  scope: AgentAccessScope;
}
