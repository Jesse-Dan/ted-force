import { RequiredString, Validate, Validators } from "fragment-ts";
import { DataSourceType } from "../../../entities/enums/data-source-type.enum";

export class CreateDataSourceDto {
  @RequiredString(1, { name: "name", required: true })
  name!: string;

  @Validate({ name: "type" })
  @Validators.IsIn(Object.values(DataSourceType))
  type!: DataSourceType;

  @Validate({ name: "config" })
  @Validators.IsOptional()
  @Validators.IsObject()
  config?: Record<string, unknown>;
}
