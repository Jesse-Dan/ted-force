import { ServerResponse } from "node:http";
import type { SseEvent } from "../contracts/sse.contract";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export class SseWriter {
  constructor(private readonly response: ServerResponse) {}

  initialize(): void {
    this.response.writeHead(200, SSE_HEADERS);
  }

  write<T>(event: SseEvent<T>): void {
    if (event.id) {
      this.response.write(`id: ${event.id}\n`);
    }

    this.response.write(`event: ${event.event ?? event.type}\n`);
    this.response.write(`data: ${JSON.stringify(event.data ?? null)}\n\n`);
  }

  comment(comment: string): void {
    this.response.write(`: ${comment}\n\n`);
  }

  done(): void {
    this.write({ type: "done" });
    this.response.end();
  }
}
