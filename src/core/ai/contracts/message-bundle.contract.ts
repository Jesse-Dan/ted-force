import type { ModelMessage, UIMessage } from "ai";

export type CoreModelMessage = ModelMessage;
export type CoreUIMessage = UIMessage;

export interface MessageBundleOptions {
  system?: string;
  history?: ModelMessage[];
  maxMessages?: number;
}

export interface MessageBundle {
  system?: string;
  messages: ModelMessage[];
  uiMessages?: UIMessage[];
}
