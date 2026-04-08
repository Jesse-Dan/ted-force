import { RequiredString, Validate, Validators } from "fragment-ts";
import { ConnectorSource } from "../../../entities/enums/connector-source.enum";

export class CreateConnectorDto {
  @RequiredString(1, { name: "agentId", required: true })
  agentId!: string;

  @RequiredString(2, { name: "name", required: true })
  name!: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "source" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ConnectorSource))
  source?: ConnectorSource;

  @Validate({ name: "auth" })
  @Validators.IsOptional()
  @Validators.IsObject()
  auth?: Record<string, unknown>;

  @Validate({ name: "operations" })
  @Validators.IsOptional()
  @Validators.IsArray()
  operations?: Record<string, unknown>[];

  @Validate({ name: "envConfig" })
  @Validators.IsOptional()
  @Validators.IsObject()
  envConfig?: Record<string, string>;

  @Validate({ name: "envRefs" })
  @Validators.IsOptional()
  @Validators.IsArray()
  envRefs?: Record<string, unknown>[];

  @Validate({ name: "isLive" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isLive?: boolean;

  @Validate({ name: "isPublic" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isPublic?: boolean;

  @Validate({ name: "logoUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  logoUrl?: string;
}
