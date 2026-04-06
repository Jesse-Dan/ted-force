import { RequiredString, Validate, Validators } from "fragment-ts";
import { ExternalResourceCategory } from "../../../entities/enums/external-resource-category.enum";

export class CreateExternalResourceDto {
  @RequiredString(1, { name: "name", required: true })
  name!: string;

  @RequiredString(1, { name: "url", required: true })
  url!: string;

  @RequiredString(1, { name: "description", required: true })
  description!: string;

  @Validate({ name: "category" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ExternalResourceCategory))
  category?: ExternalResourceCategory;
}
