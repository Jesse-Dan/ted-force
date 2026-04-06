import { RequiredString, Validate, Validators } from "fragment-ts";
import { AssetType } from "../../../entities/asset.entity";

export class CreateAssetDto {
  @RequiredString(1, { name: "name", required: true })
  name!: string;

  @Validate({ name: "type" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(AssetType))
  type?: AssetType;

  @Validate({ name: "size" })
  @Validators.IsOptional()
  @Validators.IsInt()
  size?: number;

  @RequiredString(1, { name: "url", required: true })
  url!: string;

  @Validate({ name: "tags" })
  @Validators.IsOptional()
  @Validators.IsArray()
  tags?: string[];
}
