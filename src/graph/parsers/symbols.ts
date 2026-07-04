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
const PY_EXTS = new Set([".py"]);

// Callee names that are language/runtime built-ins or control-flow keywords —
// never treated as user-defined symbol calls (JS/TS).
const JS_IGNORED_CALLEES = new Set([
  "if", "for", "while", "switch", "catch", "return", "function", "await",
  "typeof", "instanceof", "new", "super", "this", "void", "delete", "in", "of",
  "require", "import", "console", "Promise", "Array", "Object", "String",
  "Number", "Boolean", "Set", "Map", "JSON", "Math", "Date", "Error", "Symbol",
]);

// Python built-ins and control-flow keywords.
const PY_IGNORED_CALLEES = new Set([
  "if", "for", "while", "with", "elif", "else", "try", "except", "finally",
  "return", "yield", "raise", "assert", "lambda", "print", "len", "range",
  "str", "int", "float", "bool", "list", "dict", "set", "tuple", "frozenset",
  "isinstance", "issubclass", "super", "type", "enumerate", "zip", "map",
  "filter", "sorted", "reversed", "open", "getattr", "setattr", "hasattr",
  "delattr", "repr", "abs", "min", "max", "sum", "any", "all", "next", "iter",
  "format", "input", "vars", "dir", "id", "hash", "bytes", "bytearray",
]);

interface Definition {
  name: string;
  kind: "function" | "class" | "method";
  line: number; // 1-based
  bodyStart: number; // index in content of the body start
  bodyEnd: number; // index in content just past the body end
}

// ---------------------------------------------------------------------------
// Line index — precompute once per file so line lookups are O(log n), not O(n).
// ---------------------------------------------------------------------------

// Returns an array where element i is the content index at which line (i+1) starts.
function buildLineIndex(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

// 1-based line number for a content index, via binary search over line starts.
function lineForIndex(lineStarts: number[], index: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

// ---------------------------------------------------------------------------
// JS/TS definition + call extraction (brace matching)
// ---------------------------------------------------------------------------

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

// Extract top-level function/class definitions and class methods (JS/TS).
function findJsDefinitions(content: string, lineStarts: number[]): Definition[] {
  const defs: Definition[] = [];

  // Top-level functions: function foo( / export async function foo(
  const fnRe = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(content)) !== null) {
    const brace = content.indexOf("{", m.index + m[0].length);
    if (brace === -1) continue;
    const end = matchBrace(content, brace);
    defs.push({ name: m[1], kind: "function", line: lineForIndex(lineStarts, m.index + 1), bodyStart: brace, bodyEnd: end });
  }

  // Arrow / function-expression consts: const foo = (...) => { / const foo = async function (
  const arrowRe = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  while ((m = arrowRe.exec(content)) !== null) {
    const brace = content.indexOf("{", m.index + m[0].length - 1);
    if (brace === -1) continue;
    const end = matchBrace(content, brace);
    defs.push({ name: m[1], kind: "function", line: lineForIndex(lineStarts, m.index + 1), bodyStart: brace, bodyEnd: end });
  }

  // Classes: class Foo { / export class Foo extends Bar {
  const classRe = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = classRe.exec(content)) !== null) {
    const brace = content.indexOf("{", m.index + m[0].length);
    if (brace === -1) continue;
    const end = matchBrace(content, brace);
    const className = m[1];
    defs.push({ name: className, kind: "class", line: lineForIndex(lineStarts, m.index + 1), bodyStart: brace, bodyEnd: end });

    // Methods inside the class body (one level of brace nesting from the class).
    const classBody = content.slice(brace + 1, end - 1);
    const methodRe = /(?:^|\n)\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={;]+)?\{/g;
    let mm: RegExpExecArray | null;
    while ((mm = methodRe.exec(classBody)) !== null) {
      const name = mm[1];
      if (["if", "for", "while", "switch", "catch", "return"].includes(name)) continue;
      const localBrace = classBody.indexOf("{", mm.index + mm[0].length - 1);
      if (localBrace === -1) continue;
      const absBrace = brace + 1 + localBrace;
      const absEnd = matchBrace(content, absBrace);
      defs.push({
        name: `${className}.${name}`,
        kind: "method",
        line: lineForIndex(lineStarts, absBrace),
        bodyStart: absBrace,
        bodyEnd: absEnd,
      });
    }
  }

  return defs;
}

// ---------------------------------------------------------------------------
// Python definition + call extraction (indentation based)
// ---------------------------------------------------------------------------

function indentOf(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n++;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
}

// Extract def/class definitions and methods (Python). Body extent is found by
// scanning subsequent lines until a non-blank line dedents to <= the def indent.
function findPyDefinitions(content: string, lineStarts: number[]): Definition[] {
  const defs: Definition[] = [];
  const lines = content.split("\n");
  const defRe = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
  const classRe = /^(\s*)class\s+([A-Za-z_]\w*)/;

  // Track the class whose body we are currently inside so methods get ClassName.method.
  const classStack: Array<{ name: string; indent: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const curIndent = indentOf(line);
    while (classStack.length > 0 && curIndent <= classStack[classStack.length - 1].indent) {
      classStack.pop();
    }

    const cm = line.match(classRe);
    if (cm) {
      const indent = cm[1].length;
      const name = cm[2];
      const [bodyStart, bodyEnd] = pyBody(lines, lineStarts, i, indentOf(line));
      defs.push({ name, kind: "class", line: i + 1, bodyStart, bodyEnd });
      classStack.push({ name, indent });
      continue;
    }

    const dm = line.match(defRe);
    if (dm) {
      const name = dm[2];
      const enclosing = classStack.length > 0 ? classStack[classStack.length - 1] : null;
      const isMethod = enclosing != null && indentOf(line) > enclosing.indent;
      const label = isMethod ? `${enclosing!.name}.${name}` : name;
      const [bodyStart, bodyEnd] = pyBody(lines, lineStarts, i, indentOf(line));
      defs.push({ name: label, kind: isMethod ? "method" : "function", line: i + 1, bodyStart, bodyEnd });
    }
  }

  return defs;
}

// Given the header line index, return [bodyStartIndex, bodyEndIndex] in content
// terms. Body spans from the start of the line after the header to the end of
// the last line before dedent.
function pyBody(lines: string[], lineStarts: number[], headerLine: number, headerIndent: number): [number, number] {
  const bodyStart = headerLine + 1 < lineStarts.length ? lineStarts[headerLine + 1] : (lineStarts[lineStarts.length - 1] ?? 0);
  let lastLine = headerLine;
  for (let j = headerLine + 1; j < lines.length; j++) {
    if (!lines[j].trim()) continue;
    if (indentOf(lines[j]) <= headerIndent) break;
    lastLine = j;
  }
  // bodyEnd = start of the line after lastLine (or end of content).
  const bodyEnd = lastLine + 1 < lineStarts.length ? lineStarts[lastLine + 1] : Number.MAX_SAFE_INTEGER;
  return [bodyStart, bodyEnd];
}

// ---------------------------------------------------------------------------
// Shared symbol/edge assembly
// ---------------------------------------------------------------------------

function stripExt(relPath: string): string {
  return relPath.replace(/\.(ts|tsx|js|mjs|cjs|py)$/, "");
}

export async function extractSymbols(filePath: string, root: string): Promise<SymbolResult> {
  const ext = path.extname(filePath).toLowerCase();
  const isJs = JS_EXTS.has(ext);
  const isPy = PY_EXTS.has(ext);
  if (!isJs && !isPy) return { nodes: [], edges: [], pendingCalls: [] };

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [], pendingCalls: [] };
  }

  const relFile = path.relative(root, filePath);
  const rel = stripExt(relFile);
  const moduleId = `module:${rel}`;
  const lineStarts = buildLineIndex(content);
  const ignored = isPy ? PY_IGNORED_CALLEES : JS_IGNORED_CALLEES;

  const defs = isPy ? findPyDefinitions(content, lineStarts) : findJsDefinitions(content, lineStarts);
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
    const bodyEnd = Math.min(def.bodyEnd, content.length);
    // Skip the definition's own opening delimiter so its name/params aren't read as a call.
    const bodyOffset = Math.min(def.bodyStart + 1, content.length);
    const body = content.slice(bodyOffset, bodyEnd);
    let c: RegExpExecArray | null;
    callRe.lastIndex = 0;
    const seenInThisDef = new Set<string>();
    const bareDefName = def.name.split(".").pop()!;
    while ((c = callRe.exec(body)) !== null) {
      const callee = c[1];
      if (ignored.has(callee)) continue;
      if (callee === def.name || callee === bareDefName) continue; // ignore trivial self-recursion noise
      const line = lineForIndex(lineStarts, bodyOffset + c.index);
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
//
// When `importsByModule` is supplied, resolution is import-constrained: for a
// caller symbol, candidate callees are first filtered to symbols defined in
// modules the caller's module actually imports. If exactly one survives, an
// edge is emitted. This is both more precise (avoids same-named symbols in
// unrelated files) and higher-recall (resolves names that aren't globally
// unique). Falls back to the global-unique rule when the import-constrained
// set is empty or no import map is provided.
export function resolvePendingCalls(
  pendingCalls: PendingCall[],
  globalSymbolsByName: Map<string, string[]>,
  importsByModule?: Map<string, Set<string>>,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const pc of pendingCalls) {
    const candidates = globalSymbolsByName.get(pc.calleeName);
    if (!candidates || candidates.length === 0) continue;

    let to: string | null = null;
    if (importsByModule) {
      const callerModule = symbolToModule(pc.from);
      const imported = importsByModule.get(callerModule);
      if (imported) {
        const constrained = candidates.filter(
          (id) => imported.has(symbolToModule(id)) || symbolToModule(id) === callerModule,
        );
        if (constrained.length === 1) to = constrained[0];
      }
    }
    // Fall back to global-unique resolution.
    if (!to && candidates.length === 1) to = candidates[0];
    if (!to) continue;
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

// symbol:<rel>#<name> -> module:<rel>
function symbolToModule(symbolId: string): string {
  if (!symbolId.startsWith("symbol:")) return symbolId;
  const rel = symbolId.slice("symbol:".length).split("#")[0];
  return `module:${rel}`;
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
