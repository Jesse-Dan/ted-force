import { Validate, Validators } from "fragment-ts";

export class UpsertVoiceProfileDto {
  @Validate({ name: "coreVoiceProfile" })
  @Validators.IsOptional()
  @Validators.IsObject()
  coreVoiceProfile?: Record<string, unknown>;

  @Validate({ name: "tonalPalette" })
  @Validators.IsOptional()
  @Validators.IsArray()
  @Validators.IsString({ each: true })
  tonalPalette?: string[];

  @Validate({ name: "behavioralGuardrails" })
  @Validators.IsOptional()
  @Validators.IsArray()
  @Validators.IsString({ each: true })
  behavioralGuardrails?: string[];
}
