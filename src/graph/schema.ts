export type Confidence = "verified" | "inferred" | "unknown";

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  path?: string;
  confidence: Confidence;
  metadata: Record<string, unknown>;
  evidence: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  confidence: Confidence;
  metadata: Record<string, unknown>;
  evidence: string[];
}

export interface DependencyGraph {
  schemaVersion: 1;
  graphType: "dependency";
  generatedAt: string;
  scope: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  unknowns: string[];
}

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

function validateConfidence(value: unknown, path: string): Confidence {
  if (value === "verified" || value === "inferred" || value === "unknown") {
    return value;
  }
  throw new SchemaValidationError(`${path}: confidence must be "verified" | "inferred" | "unknown", got ${JSON.stringify(value)}`);
}

function validateNode(value: unknown, index: number): GraphNode {
  if (!value || typeof value !== "object") throw new SchemaValidationError(`nodes[${index}]: must be an object`);
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) throw new SchemaValidationError(`nodes[${index}].id: must be a non-empty string`);
  if (typeof v.kind !== "string" || !v.kind) throw new SchemaValidationError(`nodes[${index}].kind: must be a non-empty string`);
  if (typeof v.label !== "string") throw new SchemaValidationError(`nodes[${index}].label: must be a string`);
  if (!Array.isArray(v.evidence)) throw new SchemaValidationError(`nodes[${index}].evidence: must be an array`);
  return {
    id: v.id,
    kind: v.kind,
    label: v.label,
    path: typeof v.path === "string" ? v.path : undefined,
    confidence: validateConfidence(v.confidence, `nodes[${index}].confidence`),
    metadata: (v.metadata && typeof v.metadata === "object" && !Array.isArray(v.metadata)) ? (v.metadata as Record<string, unknown>) : {},
    evidence: (v.evidence as unknown[]).map((e, i) => {
      if (typeof e !== "string") throw new SchemaValidationError(`nodes[${index}].evidence[${i}]: must be a string`);
      return e;
    }),
  };
}

function validateEdge(value: unknown, index: number): GraphEdge {
  if (!value || typeof value !== "object") throw new SchemaValidationError(`edges[${index}]: must be an object`);
  const v = value as Record<string, unknown>;
  if (typeof v.from !== "string" || !v.from) throw new SchemaValidationError(`edges[${index}].from: must be a non-empty string`);
  if (typeof v.to !== "string" || !v.to) throw new SchemaValidationError(`edges[${index}].to: must be a non-empty string`);
  if (typeof v.relation !== "string" || !v.relation) throw new SchemaValidationError(`edges[${index}].relation: must be a non-empty string`);
  if (!Array.isArray(v.evidence)) throw new SchemaValidationError(`edges[${index}].evidence: must be an array`);
  return {
    from: v.from,
    to: v.to,
    relation: v.relation,
    confidence: validateConfidence(v.confidence, `edges[${index}].confidence`),
    metadata: (v.metadata && typeof v.metadata === "object" && !Array.isArray(v.metadata)) ? (v.metadata as Record<string, unknown>) : {},
    evidence: (v.evidence as unknown[]).map((e, i) => {
      if (typeof e !== "string") throw new SchemaValidationError(`edges[${index}].evidence[${i}]: must be a string`);
      return e;
    }),
  };
}

export function validateGraph(value: unknown): DependencyGraph {
  if (!value || typeof value !== "object") throw new SchemaValidationError("graph: must be an object");
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== 1) throw new SchemaValidationError(`schemaVersion: must be 1, got ${JSON.stringify(v.schemaVersion)}`);
  if (v.graphType !== "dependency") throw new SchemaValidationError(`graphType: must be "dependency", got ${JSON.stringify(v.graphType)}`);
  if (typeof v.generatedAt !== "string") throw new SchemaValidationError("generatedAt: must be a string");
  if (typeof v.scope !== "string") throw new SchemaValidationError("scope: must be a string");
  if (!Array.isArray(v.nodes)) throw new SchemaValidationError("nodes: must be an array");
  if (!Array.isArray(v.edges)) throw new SchemaValidationError("edges: must be an array");
  if (!Array.isArray(v.unknowns)) throw new SchemaValidationError("unknowns: must be an array");
  return {
    schemaVersion: 1,
    graphType: "dependency",
    generatedAt: v.generatedAt,
    scope: v.scope,
    nodes: (v.nodes as unknown[]).map(validateNode),
    edges: (v.edges as unknown[]).map(validateEdge),
    unknowns: (v.unknowns as unknown[]).map((u, i) => {
      if (typeof u !== "string") throw new SchemaValidationError(`unknowns[${i}]: must be a string`);
      return u;
    }),
  };
}
