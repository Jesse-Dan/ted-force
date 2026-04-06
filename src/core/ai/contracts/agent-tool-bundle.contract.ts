import type { AgentTool } from "../../../entities/agent-tool.entity";
import type { CapabilityProfile } from "../../../entities/capability-profile.entity";
import type { PlatformTool } from "../../../entities/platform-tool.entity";

export interface PlatformToolBundleInput {
  capabilityProfile?: CapabilityProfile | null;
  platformTools?: PlatformTool[];
}

export interface AgentToolBundleInput {
  agentTools?: AgentTool[];
}
