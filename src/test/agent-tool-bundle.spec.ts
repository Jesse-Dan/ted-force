import { beforeEach, describe, DIContainer, expect, it } from 'fragment-ts';
import { AgentToolBundleService } from '../modules/agent_tools/services/agent-tool-bundle.service';

describe('AgentToolBundleService', () => {
  let service: AgentToolBundleService;

  beforeEach(() => {
    const container = DIContainer.getInstance();
    container.reset();
    service = container.resolve(AgentToolBundleService);
  });

  it('builds an AI-friendly tool bundle for an agent', () => {
    const bundle = service.buildForAgent('agent_demo_support');

    expect(bundle.agentId).toBe('agent_demo_support');
    expect(bundle.tools.length).toBeTruthy();
    expect(bundle.tools[0].inputSchema.type).toBe('object');
    expect(bundle.tools[0].inputSchema.additionalProperties).toBe(false);
  });
});
