import { RequiredString, Validate, Validators } from "fragment-ts";

export class UploadFileDto {
  @RequiredString(1, { name: "originalFilename", required: true })
  originalFilename!: string;

  @RequiredString(1, { name: "base64Content", required: true })
  base64Content!: string;

  @Validate({ name: "mimeType" })
  @Validators.IsOptional()
  @Validators.IsString()
  mimeType?: string;

  @Validate({ name: "agentId" })
  @Validators.IsOptional()
  @Validators.IsString()
  agentId?: string;

  @Validate({ name: "sessionId" })
  @Validators.IsOptional()
  @Validators.IsString()
  sessionId?: string;

  @Validate({ name: "uploadedByUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  uploadedByUserId?: string;
}
