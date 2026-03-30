import { Service } from 'fragment-ts';
import { AgentToolRecord } from '../contracts/agent-tool.types';

@Service()
export class AgentToolRegistryService {
  private readonly tools: AgentToolRecord[] = [
    {
      id: 'tool_lookup_order',
      agentId: 'agent_demo_support',
      name: 'lookup_order',
      description: 'Look up an order by its public reference.',
      enabled: true,
      definition: {
        name: 'lookup_order',
        description: 'Fetch order status, items, and delivery summary.',
        strict: true,
        parameters: {
          orderReference: {
            type: 'string',
            description: 'Public-facing order reference.',
            required: true,
          },
        },
      },
      runtime: {
        transport: 'http',
        timeoutMs: 8000,
        retryCount: 1,
      },
      handler: {
        kind: 'http',
        method: 'POST',
        target: '/internal/tools/lookup-order',
      },
      tags: ['orders', 'support'],
    },
    {
      id: 'tool_create_refund_ticket',
      agentId: 'agent_demo_support',
      name: 'create_refund_ticket',
      description: 'Create a refund review ticket for a human team.',
      enabled: true,
      definition: {
        name: 'create_refund_ticket',
        description: 'Open a refund ticket with customer context.',
        parameters: {
          orderReference: {
            type: 'string',
            description: 'Order reference linked to the refund request.',
            required: true,
          },
          reason: {
            type: 'string',
            description: 'Human-readable reason for the refund request.',
            required: true,
          },
        },
      },
      runtime: {
        transport: 'internal',
        requiresConfirmation: true,
      },
      handler: {
        kind: 'internal',
        target: 'refund-ticket.create',
      },
      tags: ['billing', 'support'],
    },
  ];

  listByAgent(agentId: string): AgentToolRecord[] {
    return this.tools.filter((tool) => tool.agentId === agentId);
  }
}
