import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { BaseUuidEntity } from "./base-uuid.entity";

export abstract class AuditableEntity extends BaseUuidEntity {
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
