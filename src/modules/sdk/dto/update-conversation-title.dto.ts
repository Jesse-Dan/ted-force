import { RequiredString } from "fragment-ts";

export class UpdateConversationTitleDto {
  @RequiredString(1, { name: "title", required: true })
  title!: string;
}
