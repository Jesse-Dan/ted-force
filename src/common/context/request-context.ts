export type PermissionHubAction = "view" | "create" | "edit" | "delete";

export type PermissionHubScope =
  | "organization.profile"
  | "organization.members"
  | "organization.repository"
  | "organization.transfer"
  | "agent.workspace"
  | "agent.create"
  | "agent.delete"
  | "unknown";

export interface PermissionHubState {
  action: PermissionHubAction;
  scope: PermissionHubScope;
  role: string | null;
  allowed: boolean;
  organizationId?: string;
  agentId?: string;
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageOrganizationSettings: boolean;
    canManageMembers: boolean;
    canTransferOwnership: boolean;
  };
}

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
  permissionHub?: PermissionHubState;
  metadata?: Record<string, unknown>;
}
