import { Service } from 'fragment-ts';
import { AgentKnowledgeItem } from '../contracts/agent-knowledge.types';

@Service()
export class AgentKnowledgeService {
  private readonly items: AgentKnowledgeItem[] = [
    {
      id: 'knowledge_demo_handbook',
      agentId: 'agent_demo_support',
      kind: 'document',
      name: 'Support handbook',
      source: 'seed://support-handbook',
      enabled: true,
      tags: ['support', 'starter'],
      metadata: {
        version: 1,
      },
    },
  ];

  listByAgent(agentId: string): AgentKnowledgeItem[] {
    return this.items.filter((item) => item.agentId === agentId);
  }
}
