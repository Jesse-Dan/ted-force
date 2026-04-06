import { jsonSchema, tool, type Tool, type ToolSet } from "ai";
import type { JSONSchema7 } from "ai";
import type { ToolBundle } from "../contracts/tool-bundle.contract";

export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  execute?: Tool<I, O>["execute"];
}

export class ToolBundleBuilder {
  private readonly definitions = new Map<string, ToolDefinition>();

  add(definition: ToolDefinition): this {
    this.definitions.set(definition.name, definition);
    return this;
  }

  addMany(definitions: ToolDefinition[]): this {
    for (const definition of definitions) {
      this.add(definition);
    }
    return this;
  }

  build(): ToolBundle {
    const tools: ToolSet = {};

    for (const definition of this.definitions.values()) {
      tools[definition.name] = tool<any, any>({
        description: definition.description,
        inputSchema: jsonSchema(
          definition.inputSchema ?? {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        ),
        execute: definition.execute,
      }) as Tool<any, any>;
    }

    return {
      tools,
      toolNames: Object.keys(tools),
    };
  }
}
