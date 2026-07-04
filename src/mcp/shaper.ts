import { estimateTokens } from "../token-optimizer.js";

// ---------------------------------------------------------------------------
// Response shaper — keep MCP tool outputs cheap.
//
// Headroom-style principle applied deterministically (no ML, no proxy): shape
// what the agent reads. We (1) drop empty/volatile fields, (2) minify, (3) cap
// long lists with an explicit "+K more" marker so nothing is *silently* hidden,
// and (4) trim lowest-priority lists until the payload fits a token budget. The
// on-disk graph remains the lossless original the agent can drill into (stable
// ids + get_graph/find_symbol) — the reversible-compression pattern.
// ---------------------------------------------------------------------------

export { estimateTokens };

export const DEFAULT_BUDGET = 2000;

// Per-array expansion hints and priority. Lower priority arrays are trimmed
// first when a payload is over budget. Hints tell the agent how to get the
// omitted items — the reversible drill-down loop.
export interface FieldHint {
  hint: string; // e.g. "get_graph pattern=<id>"
  priority?: number; // higher = keep longer (default 5)
}

export interface ShapeOptions {
  budget?: number;
  hints?: Record<string, FieldHint>;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

// Recursively drop undefined/null/empty-array/empty-string/empty-object values.
export function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => prune(v)).filter((v) => !isEmpty(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v);
      if (!isEmpty(pv)) out[k] = pv;
    }
    return out as T;
  }
  return value;
}

// Top-level array fields, longest first (by serialized size).
function arrayFields(obj: Record<string, unknown>): string[] {
  return Object.keys(obj)
    .filter((k) => Array.isArray(obj[k]))
    .sort((a, b) => JSON.stringify(obj[b]).length - JSON.stringify(obj[a]).length);
}

// Cap a payload's arrays until it fits `budget` tokens. Returns a new object
// with `truncated` markers describing what was omitted and how to expand it.
export function fit(payload: Record<string, unknown>, options: ShapeOptions = {}): Record<string, unknown> {
  const budget = options.budget ?? DEFAULT_BUDGET;
  const hints = options.hints ?? {};
  const obj = prune({ ...payload }) as Record<string, unknown>;

  if (estimateTokens(JSON.stringify(obj)) <= budget) return obj;

  const truncated: Record<string, string> = {};
  const fields = arrayFields(obj);
  // Priority-ascending: trim least-important arrays first.
  fields.sort((a, b) => (hints[a]?.priority ?? 5) - (hints[b]?.priority ?? 5));

  // Progressive caps: try generous limits first, shrink until under budget.
  const caps = [50, 25, 15, 10, 5, 3, 1, 0];
  for (const cap of caps) {
    for (const field of fields) {
      const arr = obj[field] as unknown[];
      const original = (payload[field] as unknown[])?.length ?? arr.length;
      if (arr.length > cap) {
        obj[field] = arr.slice(0, cap);
        const omitted = original - cap;
        const hint = hints[field]?.hint;
        truncated[field] = `+${omitted} more${hint ? ` (expand via ${hint})` : ""}`;
      }
      if (estimateTokens(JSON.stringify({ ...obj, truncated })) <= budget) {
        if (Object.keys(truncated).length > 0) obj.truncated = truncated;
        return obj;
      }
    }
  }
  if (Object.keys(truncated).length > 0) obj.truncated = truncated;
  return obj;
}

// Shape a payload into a compact, budget-bounded JSON string (minified).
export function shape(payload: Record<string, unknown>, options: ShapeOptions = {}): string {
  return JSON.stringify(fit(payload, options));
}

// Compact one-line renderings for graph elements (used by get_graph).
export function terseNode(n: { id: string; kind: string; label: string; evidence?: string[] }): string {
  return `${n.id} <${n.kind}>${n.evidence && n.evidence[0] ? ` @${n.evidence[0]}` : ""}`;
}

export function terseEdge(e: { from: string; to: string; relation: string }): string {
  return `${e.from} -${e.relation}-> ${e.to}`;
}
