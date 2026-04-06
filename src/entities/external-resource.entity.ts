import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { ExternalResourceCategory } from "./enums/external-resource-category.enum";

@Entity("external_resources")
export class ExternalResource extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  agentId?: string | null;

  @ManyToOne(() => Agent, (agent) => agent.externalResources, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 2048 })
  url!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({
    type: "enum",
    enum: ExternalResourceCategory,
    default: ExternalResourceCategory.OTHER,
  })
  category!: ExternalResourceCategory;
}
