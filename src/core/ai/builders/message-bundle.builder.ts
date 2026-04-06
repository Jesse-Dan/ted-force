import type { ModelMessage, UIMessage } from "ai";
import type {
  MessageBundle,
  MessageBundleOptions,
} from "../contracts/message-bundle.contract";

export class MessageBundleBuilder {
  private system?: string;
  private messages: ModelMessage[] = [];
  private uiMessages: UIMessage[] = [];
  private maxMessages?: number;

  constructor(options: MessageBundleOptions = {}) {
    this.system = options.system;
    this.maxMessages = options.maxMessages;
    this.addMessages(options.history ?? []);
  }

  withSystem(system?: string | null): this {
    this.system = system ?? undefined;
    return this;
  }

  addMessages(messages: ModelMessage[]): this {
    this.messages.push(...messages);
    this.prune();
    return this;
  }

  addUIMessages(messages: UIMessage[]): this {
    this.uiMessages.push(...messages);
    return this;
  }

  addUserText(text: string): this {
    this.messages.push({
      role: "user",
      content: [{ type: "text", text }],
    });
    this.prune();
    return this;
  }

  addAssistantText(text: string): this {
    this.messages.push({
      role: "assistant",
      content: [{ type: "text", text }],
    });
    this.prune();
    return this;
  }

  build(): MessageBundle {
    return {
      system: this.system,
      messages: [...this.messages],
      uiMessages: this.uiMessages.length > 0 ? [...this.uiMessages] : undefined,
    };
  }

  private prune(): void {
    if (this.maxMessages && this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }
}
