import { Service } from 'fragment-ts';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { AgentToolBundleService } from './agent-tool-bundle.service';

@Service()
export class AgentToolService {
  constructor(
    private readonly registry: AgentToolRegistryService = new AgentToolRegistryService(),
    private readonly bundler: AgentToolBundleService = new AgentToolBundleService(),
  ) {}

  list(agentId: string) {
    return this.registry.listByAgent(agentId);
  }

  getBundle(agentId: string) {
    return this.bundler.buildForAgent(agentId);
  }
}
