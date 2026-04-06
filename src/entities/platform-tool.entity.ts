import { Column, Entity, OneToMany } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { CapabilityToolPolicy } from "./capability-tool-policy.entity";

export interface PlatformToolArg {
  name: string;
  type: string;
  description: string;
}

@Entity("platform_tools")
export class PlatformTool extends AuditableEntity {
  @Column({ type: "varchar", length: 255, unique: true })
  key!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({ type: "text", nullable: true })
  example?: string | null;

  @Column({ name: "is_new", type: "boolean", default: false })
  isNew!: boolean;

  @Column({ name: "system_enabled", type: "boolean", default: true })
  systemEnabled!: boolean;

  @Column({ type: "json", nullable: true })
  args?: PlatformToolArg[] | null;

  @OneToMany(() => CapabilityToolPolicy, (policy) => policy.platformTool, {
    cascade: true,
  })
  capabilityPolicies!: CapabilityToolPolicy[];
}
