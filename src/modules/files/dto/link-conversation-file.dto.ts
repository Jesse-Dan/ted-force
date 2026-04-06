import { RequiredString, Validate, Validators } from "fragment-ts";

export class LinkConversationFileDto {
  @RequiredString(1, { name: "conversationMessageId", required: true })
  conversationMessageId!: string;

  @RequiredString(1, { name: "storedFileId", required: true })
  storedFileId!: string;

  @Validate({ name: "attachmentLabel" })
  @Validators.IsOptional()
  @Validators.IsString()
  attachmentLabel?: string;
}
