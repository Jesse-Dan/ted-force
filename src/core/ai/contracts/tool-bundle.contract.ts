import type { Tool, ToolSet } from "ai";

export type CoreTool<I = unknown, O = unknown> = Tool<I, O>;
export type CoreToolSet = ToolSet;

export interface ToolBundle {
  tools: ToolSet;
  toolNames: string[];
}
