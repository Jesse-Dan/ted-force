import { Column, Index } from "typeorm";

export abstract class OwnershipColumns {
  @Column({ name: "owner_user_id", type: "varchar", length: 255, nullable: true })
  @Index()
  ownerUserId?: string | null;

  @Column({ name: "organization_id", type: "uuid", nullable: true })
  @Index()
  organizationId?: string | null;
}
