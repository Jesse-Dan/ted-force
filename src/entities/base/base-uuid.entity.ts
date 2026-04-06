import { PrimaryGeneratedColumn } from "typeorm";

export abstract class BaseUuidEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;
}
