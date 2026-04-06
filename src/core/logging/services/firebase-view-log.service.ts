import { Service } from "fragment-ts";
import type { DocumentData } from "firebase-admin/firestore";
import { Firebase } from "../../../config/firebase";
import type {
  FirebaseViewLogEntry,
  FirebaseViewLogType,
} from "../contracts/firebase-view-log.contract";

@Service()
export class FirebaseViewLogService {
  async log(entry: FirebaseViewLogEntry): Promise<void> {
    try {
      const db = Firebase.getInstance().getDb();
      const safeEntry = this.sanitize({
        ...entry,
        timestamp: entry.timestamp ?? new Date().toISOString(),
      });

      await db
        .collection("logs")
        .doc(entry.agentId)
        .collection(entry.type)
        .doc(entry.sessionId)
        .collection("entries")
        .add(safeEntry);
    } catch (error) {
      console.error("FirebaseViewLogService Error:", error);
    }
  }

  async executionLog(
    agentId: string,
    sessionId: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type: "execution_logs",
      agentId,
      sessionId,
      message,
      details,
    });
  }

  async toolCall(
    agentId: string,
    sessionId: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type: "tool_calls",
      agentId,
      sessionId,
      message,
      details,
    });
  }

  async task(
    agentId: string,
    sessionId: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type: "tasks",
      agentId,
      sessionId,
      message,
      details,
    });
  }

  async graph(
    agentId: string,
    sessionId: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type: "orchestration_graph",
      agentId,
      sessionId,
      message,
      details,
    });
  }

  private sanitize(value: unknown): DocumentData {
    if (value === undefined) {
      return { value: null };
    }

    if (value === null || typeof value !== "object") {
      return { value };
    }

    if (Array.isArray(value)) {
      return {
        value: value.map((item) => this.unwrapSanitizedValue(this.sanitize(item))),
      };
    }

    const safeObject: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
      safeObject[key] = this.unwrapSanitizedValue(this.sanitize(child));
    }

    return safeObject;
  }

  private unwrapSanitizedValue(value: DocumentData): unknown {
    if (Object.keys(value).length === 1 && "value" in value) {
      return value.value;
    }

    return value;
  }
}
