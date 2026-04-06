import { Validate, Validators } from "fragment-ts";
import { DataSourceType } from "../../../entities/enums/data-source-type.enum";

export class UpdateDataSourceDto {
  @Validate({ name: "name" })
  @Validators.IsOptional()
  @Validators.IsString()
  name?: string;

  @Validate({ name: "type" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(DataSourceType))
  type?: DataSourceType;

  @Validate({ name: "config" })
  @Validators.IsOptional()
  @Validators.IsObject()
  config?: Record<string, unknown> | null;
}
