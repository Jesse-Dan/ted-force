import { DeleteDateColumn } from "typeorm";
import { AuditableEntity } from "./auditable.entity";

export abstract class SoftDeletableEntity extends AuditableEntity {
  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt?: Date | null;
}
