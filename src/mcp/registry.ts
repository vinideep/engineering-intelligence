export type JsonSchema = {
  type: "object";
  properties?: Record<string, { type: "string" | "number" | "boolean" | "array"; enum?: string[]; items?: { type: "string" }; minimum?: number }>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface RegisteredTool<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (args: TArgs) => Promise<unknown>;
}

function validateValue(name: string, value: unknown, schema: NonNullable<JsonSchema["properties"]>[string]): void {
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
    if (schema.items?.type === "string" && !value.every((item) => typeof item === "string")) throw new Error(`${name} must contain only strings.`);
    return;
  }
  if (typeof value !== schema.type) throw new Error(`${name} must be a ${schema.type}.`);
  if (schema.type === "number" && schema.minimum !== undefined && (value as number) < schema.minimum) throw new Error(`${name} must be at least ${schema.minimum}.`);
  if (schema.enum && !schema.enum.includes(value as string)) throw new Error(`${name} must be one of: ${schema.enum.join(", ")}.`);
}

export function validateArguments(schema: JsonSchema, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Tool arguments must be an object.");
  const args = input as Record<string, unknown>;
  for (const required of schema.required ?? []) if (args[required] === undefined) throw new Error(`${required} is required.`);
  const properties = schema.properties ?? {};
  for (const [name, value] of Object.entries(args)) {
    const property = properties[name];
    if (!property) {
      if (schema.additionalProperties === false) throw new Error(`Unknown argument: ${name}.`);
      continue;
    }
    validateValue(name, value, property);
  }
  return args;
}

export class McpToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register<TArgs extends Record<string, unknown>>(tool: RegisteredTool<TArgs>): this {
    if (this.tools.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`);
    this.tools.set(tool.name, tool as RegisteredTool);
    return this;
  }

  has(name: string): boolean { return this.tools.has(name); }

  list(): Array<{ name: string; description: string; inputSchema: JsonSchema }> {
    return [...this.tools.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  }

  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const args = validateArguments(tool.inputSchema, input);
    return tool.handler(args);
  }
}
