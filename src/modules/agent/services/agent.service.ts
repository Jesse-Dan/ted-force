import { Service } from 'fragment-ts';
import { AgentEntity, AgentStatus } from '../entities/agent.entity';

@Service()
export class AgentService {
  private readonly agents: AgentEntity[] = [
    {
      id: 'agent_demo_support',
      slug: 'demo-support-agent',
      name: 'Demo Support Agent',
      description: 'Starter agent used to exercise the v2 runtime surface.',
      organizationId: 'org_demo',
      ownerUserId: 'user_demo',
      status: AgentStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  getAll(): AgentEntity[] {
    return this.agents;
  }

  getById(agentId: string): AgentEntity | undefined {
    return this.agents.find((agent) => agent.id === agentId);
  }
}
