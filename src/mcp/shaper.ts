import { estimateTokens } from "../token-optimizer.js";

// ---------------------------------------------------------------------------
// Response shaper — keep MCP tool outputs cheap WITHOUT ever changing an answer.
//
// Accuracy contract (v2.4.1):
//   1. Fields marked `mustKeep` are NEVER truncated — they ARE the answer
//      (direct impacts, testsToRun, callers…). If they alone exceed the budget,
//      the budget soft-expands and the response says so (`budgetNote`).
//   2. Only exploration fields may be trimmed, and always with an explicit
//      `+K more (expand via …)` marker — nothing is silently hidden.
//   3. Before anything lossy happens, large object arrays are packed into a
//      lossless cols/rows form (~35-45% smaller), so more real data fits per
//      token in the first place.
// The on-disk graph remains the lossless original the agent can drill into
// (stable ids + get_graph/find_symbol) — the reversible-compression pattern.
// ---------------------------------------------------------------------------

export { estimateTokens };

export const DEFAULT_BUDGET = 2000;

// Per-array expansion hints, priority, and completeness guarantee. Lower
// priority arrays are trimmed first when a payload is over budget. `mustKeep`
// fields are exempt from trimming entirely.
export interface FieldHint {
  hint?: string; // e.g. "get_graph pattern=<id>"
  priority?: number; // higher = keep longer (default 5)
  mustKeep?: boolean; // never truncate — this field IS the answer
}

export interface ShapeOptions {
  budget?: number; // 0 or negative = unlimited
  hints?: Record<string, FieldHint>;
}

// --- Lossless packing --------------------------------------------------------

// Packed form of an object array: column names once + row tuples. Same
// information, no repeated JSON keys. Missing values become null.
export interface Packed {
  cols: string[];
  rows: unknown[][];
}

export function packRows(items: Array<Record<string, unknown>>, cols: string[]): Packed {
  return { cols, rows: items.map((it) => cols.map((c) => (it[c] === undefined ? null : it[c]))) };
}

export function unpackRows(packed: Packed): Array<Record<string, unknown>> {
  return packed.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    packed.cols.forEach((c, i) => {
      if (row[i] !== null && row[i] !== undefined) obj[c] = row[i];
    });
    return obj;
  });
}

function isPacked(value: unknown): value is Packed {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Array.isArray((value as Packed).cols) && Array.isArray((value as Packed).rows);
}

// --- Pruning ------------------------------------------------------------------

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
    // Packed tables pass through untouched — null cells are meaningful there.
    if (isPacked(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v);
      if (!isEmpty(pv)) out[k] = pv;
    }
    return out as T;
  }
  return value;
}

// --- Budget fitting -------------------------------------------------------------

function fieldLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (isPacked(value)) return value.rows.length;
  return 0;
}

function sliceField(value: unknown, cap: number): unknown {
  if (Array.isArray(value)) return value.slice(0, cap);
  if (isPacked(value)) return { cols: value.cols, rows: value.rows.slice(0, cap) };
  return value;
}

// Top-level trimmable (array or packed) fields, largest serialized first.
function trimmableFields(obj: Record<string, unknown>, hints: Record<string, FieldHint>): string[] {
  return Object.keys(obj)
    .filter((k) => (Array.isArray(obj[k]) || isPacked(obj[k])) && !hints[k]?.mustKeep)
    .sort((a, b) => JSON.stringify(obj[b]).length - JSON.stringify(obj[a]).length);
}

export const BUDGET_EXPANDED_NOTE = "budget expanded to preserve complete results";

// Cap a payload's trimmable fields until it fits `budget` tokens. mustKeep
// fields are never touched: if the payload is still over budget once every
// trimmable field is exhausted, the budget soft-expands (answer completeness
// beats frugality) and `budgetNote` says so.
export function fit(payload: Record<string, unknown>, options: ShapeOptions = {}): Record<string, unknown> {
  const budget = options.budget ?? DEFAULT_BUDGET;
  const hints = options.hints ?? {};
  const obj = prune({ ...payload }) as Record<string, unknown>;

  if (budget <= 0) return obj; // unlimited
  if (estimateTokens(JSON.stringify(obj)) <= budget) return obj;

  const truncated: Record<string, string> = {};
  const fields = trimmableFields(obj, hints);
  // Priority-ascending: trim least-important arrays first.
  fields.sort((a, b) => (hints[a]?.priority ?? 5) - (hints[b]?.priority ?? 5));

  // Progressive caps: try generous limits first, shrink until under budget.
  const caps = [50, 25, 15, 10, 5, 3, 1, 0];
  for (const cap of caps) {
    for (const field of fields) {
      const current = fieldLength(obj[field]);
      const original = fieldLength(payload[field]) || current;
      if (current > cap) {
        obj[field] = sliceField(obj[field], cap);
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

  // Every trimmable field is empty and we are STILL over budget: the remaining
  // weight is mustKeep answer data. Keep it complete and say the budget grew.
  if (Object.keys(truncated).length > 0) obj.truncated = truncated;
  obj.budgetNote = BUDGET_EXPANDED_NOTE;
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
