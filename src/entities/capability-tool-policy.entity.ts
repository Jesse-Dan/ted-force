import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { CapabilityProfile } from "./capability-profile.entity";
import { PlatformTool } from "./platform-tool.entity";

@Entity("capability_tool_policies")
export class CapabilityToolPolicy extends AuditableEntity {
  @Column({ name: "capability_profile_id", type: "uuid" })
  capabilityProfileId!: string;

  @Column({ name: "platform_tool_id", type: "uuid" })
  platformToolId!: string;

  @Column({ name: "user_enabled", type: "boolean", default: true })
  userEnabled!: boolean;

  @ManyToOne(() => CapabilityProfile, (capabilityProfile) => capabilityProfile.toolPolicies, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "capability_profile_id" })
  capabilityProfile!: CapabilityProfile;

  @ManyToOne(() => PlatformTool, (platformTool) => platformTool.capabilityPolicies, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "platform_tool_id" })
  platformTool!: PlatformTool;
}
