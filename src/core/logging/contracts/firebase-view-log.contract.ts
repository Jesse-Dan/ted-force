export type FirebaseViewLogType =
  | "execution_logs"
  | "tool_calls"
  | "tasks"
  | "orchestration_graph";

export interface FirebaseViewLogEntry {
  type: FirebaseViewLogType;
  agentId: string;
  sessionId: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}
