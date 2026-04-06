import { Validate, Validators } from "fragment-ts";

export class UpsertContextRuleSetDto {
  @Validate({ name: "preset" })
  @Validators.IsOptional()
  @Validators.IsString()
  preset?: string;

  @Validate({ name: "historyDepth" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  historyDepth?: number;

  @Validate({ name: "persistentMemory" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  persistentMemory?: boolean;

  @Validate({ name: "customBehavioralRules" })
  @Validators.IsOptional()
  @Validators.IsArray()
  @Validators.IsString({ each: true })
  customBehavioralRules?: string[];
}
