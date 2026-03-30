export type AgentToolTransport = 'http' | 'internal' | 'workflow';

export interface AgentToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, AgentToolParameter>;
  strict?: boolean;
}

export interface AgentToolRuntimeConfig {
  timeoutMs?: number;
  retryCount?: number;
  requiresConfirmation?: boolean;
  transport: AgentToolTransport;
}

export interface AgentToolRecord {
  id: string;
  agentId: string;
  name: string;
  description: string;
  enabled: boolean;
  definition: AgentToolDefinition;
  runtime: AgentToolRuntimeConfig;
  handler: {
    kind: 'internal' | 'http';
    target: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  };
  tags?: string[];
}

export interface AgentToolBundleItem {
  id: string;
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: boolean;
  };
  runtime: AgentToolRuntimeConfig;
  handler: AgentToolRecord['handler'];
}

export interface AgentToolBundle {
  agentId: string;
  tools: AgentToolBundleItem[];
}
