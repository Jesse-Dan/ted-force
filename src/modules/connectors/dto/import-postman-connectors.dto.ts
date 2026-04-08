import { RequiredString, Validate, Validators } from "fragment-ts";

export class ImportPostmanConnectorsDto {
  @RequiredString(1, { name: "agentId", required: true })
  agentId!: string;

  @RequiredString(2, { name: "name", required: true })
  name!: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @RequiredString(1, { name: "collectionJson", required: true })
  collectionJson!: string;

  @Validate({ name: "collectionObject" })
  @Validators.IsOptional()
  @Validators.IsObject()
  collectionObject?: Record<string, unknown>;

  @Validate({ name: "isLive" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isLive?: boolean;

  @Validate({ name: "isPublic" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isPublic?: boolean;
}
