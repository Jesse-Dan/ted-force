import { Validate, Validators } from "fragment-ts";
import { ConnectorSource } from "../../../entities/enums/connector-source.enum";

export class UpdateConnectorDto {
  @Validate({ name: "name" })
  @Validators.IsOptional()
  @Validators.IsString()
  name?: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string | null;

  @Validate({ name: "source" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ConnectorSource))
  source?: ConnectorSource;

  @Validate({ name: "auth" })
  @Validators.IsOptional()
  @Validators.IsObject()
  auth?: Record<string, unknown> | null;

  @Validate({ name: "operations" })
  @Validators.IsOptional()
  @Validators.IsArray()
  operations?: Record<string, unknown>[] | null;

  @Validate({ name: "envConfig" })
  @Validators.IsOptional()
  @Validators.IsObject()
  envConfig?: Record<string, string> | null;

  @Validate({ name: "envRefs" })
  @Validators.IsOptional()
  @Validators.IsArray()
  envRefs?: Record<string, unknown>[] | null;

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
  logoUrl?: string | null;
}
