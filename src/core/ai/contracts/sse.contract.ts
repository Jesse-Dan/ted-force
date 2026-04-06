export type SseEventType =
  | "start"
  | "delta"
  | "reasoning"
  | "tool-call"
  | "tool-result"
  | "finish"
  | "error"
  | "done";

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data?: T;
  id?: string;
  event?: string;
}
