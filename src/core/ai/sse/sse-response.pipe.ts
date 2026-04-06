import type { TextStreamPart, ToolSet } from "ai";
import { SseWriter } from "./sse-writer";

export class SseResponsePipe<TOOLS extends ToolSet = ToolSet> {
  constructor(private readonly writer: SseWriter) {}

  async pipe(parts: AsyncIterable<TextStreamPart<TOOLS>>): Promise<void> {
    this.writer.write({ type: "start" });

    for await (const part of parts) {
      this.writer.write({
        type: this.resolveType(part.type),
        data: part,
      });
    }

    this.writer.write({ type: "finish" });
    this.writer.done();
  }

  private resolveType(type: string) {
    switch (type) {
      case "text-delta":
        return "delta" as const;
      case "reasoning":
      case "reasoning-delta":
        return "reasoning" as const;
      case "tool-call":
        return "tool-call" as const;
      case "tool-result":
        return "tool-result" as const;
      default:
        return "delta" as const;
    }
  }
}
