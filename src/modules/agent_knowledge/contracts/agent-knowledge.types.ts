export type AgentKnowledgeKind = 'file' | 'asset' | 'url' | 'document';

export interface AgentKnowledgeItem {
  id: string;
  agentId: string;
  kind: AgentKnowledgeKind;
  name: string;
  source: string;
  enabled: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
