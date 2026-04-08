import { Validate, Validators } from "fragment-ts";

export class UpdateSdkWidgetDto {
  @Validate({ name: "allowedDomains" })
  @Validators.IsOptional()
  @Validators.IsArray()
  allowedDomains?: string[];

  @Validate({ name: "embedEnabled" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  embedEnabled?: boolean;

  @Validate({ name: "theme" })
  @Validators.IsOptional()
  @Validators.IsObject()
  theme?: {
    primaryAccentToken?: string;
    launcherPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    greetingPrompt?: string;
    launcherLabel?: string;
    borderRadius?: number;
    backgroundColor?: string;
    surfaceColor?: string;
    textColor?: string;
    mutedTextColor?: string;
    showBranding?: boolean;
    proactiveGreeting?: boolean;
    autoOpenOnReturn?: boolean;
  };
}
