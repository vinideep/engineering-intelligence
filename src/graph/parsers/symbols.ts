import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GraphNode, GraphEdge } from "../schema.js";

export interface PendingCall {
  from: string; // symbol id of the enclosing definition
  calleeName: string; // bare callee name to resolve against the global symbol table
  evidence: string; // "<file>:<line>"
}

export interface SymbolResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  pendingCalls: PendingCall[];
}

const JS_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

// Callee names that are language/runtime built-ins or control-flow keywords —
// never treated as user-defined symbol calls.
const IGNORED_CALLEES = new Set([
  "if", "for", "while", "switch", "catch", "return", "function", "await",
  "typeof", "instanceof", "new", "super", "this", "void", "delete", "in", "of",
  "require", "import", "console", "Promise", "Array", "Object", "String",
  "Number", "Boolean", "Set", "Map", "JSON", "Math", "Date", "Error", "Symbol",
]);

interface Definition {
  name: string;
  kind: "function" | "class" | "method";
  line: number; // 1-based
  bodyStart: number; // index in content of the opening "{"
  bodyEnd: number; // index in content just past the matching "}"
}

// Find the matching closing brace for the "{" at openIndex. Returns the index
// just past the "}", or content.length if unbalanced. Skips braces inside
// strings, template literals, and comments well enough for source heuristics.
function matchBrace(content: string, openIndex: number): number {
  let depth = 0;
  let i = openIndex;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; i++; }
      continue;
    }
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return content.length;
}

function lineAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// Extract top-level function/class definitions and class methods.
function findDefinitions(content: string): Definition[] {
  const defs: Definition[] = [];

  // Top-level functions: function foo( / export async function foo(
  const fnRe = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(content)) !== null) {
    const brace = content.indexOf("{", m.index + m[0].length);
    if (brace === -1) continue;
    const end = matchBrace(content, brace);
    defs.push({ name: m[1], kind: "function", line: lineAt(content, m.index + 1), bodyStart: brace, bodyEnd: end });
  }

  // Arrow / function-expression consts: const foo = (...) => { / const foo = async function (
  const arrowRe = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  while ((m = arrowRe.exec(content)) !== null) {
    const brace = content.indexOf("{", m.index + m[0].length - 1);
    if (brace === -1) continue;
    const end = matchBrace(content, brace);
    defs.push({ name: m[1], kind: "function", line: lineAt(content, m.index + 1), bodyStart: brace, bodyEnd: end });
  }

  // Classes: class Foo { / export class Foo extends Bar {
  const classRe = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = classRe.exec(content)) !== null) {
    const brace = content.indexOf("{", m.index + m[0].length);
    if (brace === -1) continue;
    const end = matchBrace(content, brace);
    const className = m[1];
    defs.push({ name: className, kind: "class", line: lineAt(content, m.index + 1), bodyStart: brace, bodyEnd: end });

    // Methods inside the class body (one level of brace nesting from the class).
    const classBody = content.slice(brace + 1, end - 1);
    const methodRe = /(?:^|\n)\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={;]+)?\{/g;
    let mm: RegExpExecArray | null;
    while ((mm = methodRe.exec(classBody)) !== null) {
      const name = mm[1];
      if (IGNORED_CALLEES.has(name) || name === "constructor" && false) { /* keep constructor */ }
      if (["if", "for", "while", "switch", "catch", "return"].includes(name)) continue;
      const localBrace = classBody.indexOf("{", mm.index + mm[0].length - 1);
      if (localBrace === -1) continue;
      const absBrace = brace + 1 + localBrace;
      const absEnd = matchBrace(content, absBrace);
      defs.push({
        name: `${className}.${name}`,
        kind: "method",
        line: lineAt(content, absBrace),
        bodyStart: absBrace,
        bodyEnd: absEnd,
      });
    }
  }

  return defs;
}

export async function extractSymbols(filePath: string, root: string): Promise<SymbolResult> {
  const ext = path.extname(filePath).toLowerCase();
  if (!JS_EXTS.has(ext)) return { nodes: [], edges: [], pendingCalls: [] };

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [], pendingCalls: [] };
  }

  const rel = path.relative(root, filePath).replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
  const moduleId = `module:${rel}`;
  const relFile = path.relative(root, filePath);

  const defs = findDefinitions(content);
  if (defs.length === 0) return { nodes: [], edges: [], pendingCalls: [] };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const pendingCalls: PendingCall[] = [];

  // Local symbol table: bare name -> symbol id (for same-file call resolution).
  const localByName = new Map<string, string>();
  for (const def of defs) {
    const id = `symbol:${rel}#${def.name}`;
    localByName.set(def.name, id);
    // For methods, also index the bare method name (after the dot).
    if (def.kind === "method") {
      const bare = def.name.split(".").pop()!;
      if (!localByName.has(bare)) localByName.set(bare, id);
    }
    nodes.push({
      id,
      kind: "symbol",
      label: def.name,
      path: rel,
      confidence: "verified",
      metadata: { symbolKind: def.kind, line: def.line },
      evidence: [`${relFile}:${def.line}`],
    });
    edges.push({
      from: moduleId,
      to: id,
      relation: "defines",
      confidence: "verified",
      metadata: {},
      evidence: [`${relFile}:${def.line}`],
    });
  }

  // Call sites within each definition's body.
  const callRe = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const def of defs) {
    const fromId = `symbol:${rel}#${def.name}`;
    // Skip the definition's own header so its name/params aren't read as a call.
    const body = content.slice(def.bodyStart + 1, def.bodyEnd - 1);
    const bodyOffset = def.bodyStart + 1;
    let c: RegExpExecArray | null;
    callRe.lastIndex = 0;
    const seenInThisDef = new Set<string>();
    while ((c = callRe.exec(body)) !== null) {
      const callee = c[1];
      if (IGNORED_CALLEES.has(callee)) continue;
      if (callee === def.name) continue; // ignore trivial self-recursion noise
      const line = lineAt(content, bodyOffset + c.index);
      const local = localByName.get(callee);
      if (local && local !== fromId) {
        const key = `${fromId}->${local}`;
        if (seenInThisDef.has(key)) continue;
        seenInThisDef.add(key);
        edges.push({
          from: fromId,
          to: local,
          relation: "calls",
          confidence: "verified",
          metadata: {},
          evidence: [`${relFile}:${line}`],
        });
      } else if (!local) {
        pendingCalls.push({ from: fromId, calleeName: callee, evidence: `${relFile}:${line}` });
      }
    }
  }

  return { nodes, edges, pendingCalls };
}

// Resolve cross-file pending calls against a global name -> symbol-id table.
// Only emits an edge when the callee name maps to exactly one known symbol
// (honest accuracy: ambiguous or unknown names are skipped).
export function resolvePendingCalls(
  pendingCalls: PendingCall[],
  globalSymbolsByName: Map<string, string[]>,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const pc of pendingCalls) {
    const candidates = globalSymbolsByName.get(pc.calleeName);
    if (!candidates || candidates.length !== 1) continue;
    const to = candidates[0];
    if (to === pc.from) continue;
    const key = `${pc.from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      from: pc.from,
      to,
      relation: "calls",
      confidence: "inferred",
      metadata: {},
      evidence: [pc.evidence],
    });
  }
  return edges;
}

// Build a global name -> [symbol id] table from symbol nodes. Indexes both the
// full label and, for methods, the bare method name.
export function buildGlobalSymbolTable(symbolNodes: GraphNode[]): Map<string, string[]> {
  const table = new Map<string, string[]>();
  const add = (name: string, id: string) => {
    const list = table.get(name) ?? [];
    if (!list.includes(id)) list.push(id);
    table.set(name, list);
  };
  for (const node of symbolNodes) {
    if (node.kind !== "symbol") continue;
    add(node.label, node.id);
    if (node.label.includes(".")) add(node.label.split(".").pop()!, node.id);
  }
  return table;
}
