import { Service } from 'fragment-ts';
import { AgentAccessContext } from '../contracts/agent-access-context';

@Service()
export class AgentAccessService {
  buildManagementContext(): AgentAccessContext {
    return {
      userId: 'user_demo',
      organizationId: 'org_demo',
      scope: 'management',
    };
  }

  buildRuntimeContext(agentId?: string): AgentAccessContext {
    return {
      agentId,
      apiKeyId: 'key_demo_runtime',
      scope: 'runtime',
    };
  }
}
