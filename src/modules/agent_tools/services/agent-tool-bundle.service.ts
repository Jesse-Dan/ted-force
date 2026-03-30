import { Service } from 'fragment-ts';
import {
  AgentToolBundle,
  AgentToolBundleItem,
  AgentToolRecord,
} from '../contracts/agent-tool.types';
import { AgentToolRegistryService } from './agent-tool-registry.service';

@Service()
export class AgentToolBundleService {
  constructor(
    private readonly registry: AgentToolRegistryService = new AgentToolRegistryService(),
  ) {}

  buildForAgent(agentId: string): AgentToolBundle {
    const tools = this.registry
      .listByAgent(agentId)
      .filter((tool) => tool.enabled)
      .map((tool) => this.toBundleItem(tool));

    return {
      agentId,
      tools,
    };
  }

  private toBundleItem(tool: AgentToolRecord): AgentToolBundleItem {
    const required = Object.entries(tool.definition.parameters)
      .filter(([, value]) => value.required)
      .map(([key]) => key);

    const properties = Object.fromEntries(
      Object.entries(tool.definition.parameters).map(([key, value]) => [
        key,
        {
          type: value.type,
          description: value.description,
        },
      ]),
    );

    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
      runtime: tool.runtime,
      handler: tool.handler,
    };
  }
}
