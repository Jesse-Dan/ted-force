export interface RequestContextState {
  requestId: string;
  requestStartedAt: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  organizationId?: string;
  agentId?: string;
  sessionId?: string;
  conversationId?: string;
  apiKey?: string;
  authorization?: string;
  publicAccess?: boolean;
  metadata?: Record<string, unknown>;
}
