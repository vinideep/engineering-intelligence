import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { GraphNode, GraphEdge } from "../schema.js";
import { LITERAL_TOKEN, lineOf, literalAt, maskSource } from "./scan.js";

export interface ImportResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Specifiers we could not resolve to a file on disk, with evidence. */
  unknowns?: string[];
}

// Extensions tried when resolving a relative specifier, in order. `.js` maps to
// `.ts` first because TypeScript ESM writes `./x.js` for a file named `x.ts` —
// treating that literally is why 25 of 48 module nodes carried a `path` that
// does not exist on disk.
const RESOLVE_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

async function isFile(candidate: string): Promise<boolean> {
  try { return (await stat(candidate)).isFile(); } catch { return false; }
}

/**
 * Resolve a relative specifier to a real file, returning the repo-relative path
 * or null. Never guesses: an unresolved specifier becomes an `unknown`, not a
 * confident edge to a file that isn't there.
 */
async function resolveRelative(specifier: string, fromFile: string, root: string): Promise<string | null> {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const withoutExt = base.replace(/\.(tsx?|jsx?|mjs|cjs|mts|cts)$/, "");

  const candidates: string[] = [];
  if (path.extname(base)) candidates.push(base);
  for (const ext of RESOLVE_EXTS) candidates.push(`${withoutExt}${ext}`);
  for (const ext of RESOLVE_EXTS) candidates.push(path.join(withoutExt, `index${ext}`));

  for (const candidate of candidates) {
    if (await isFile(candidate)) return path.relative(root, candidate).replace(/\\/g, "/");
  }
  return null;
}

// Resolve a JS/TS specifier to a stable node id
function resolveSpecifier(specifier: string, sourceFile: string, root: string): { id: string; kind: "module" | "package" | "external"; label: string; filePath?: string } {
  if (specifier.startsWith(".")) {
    // Internal module — resolve relative to source file
    const resolved = path.relative(root, path.resolve(path.dirname(sourceFile), specifier));
    // Normalise: strip extensions for stability
    const base = resolved.replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
    return { id: `module:${base}`, kind: "module", label: path.basename(base), filePath: resolved };
  }
  // External package: strip subpath (lodash/merge → lodash; @scope/pkg/sub → @scope/pkg)
  const parts = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  return { id: `pkg:${parts}`, kind: "package", label: parts };
}

/**
 * A node for a file we are actually reading. The id stays extension-stripped so
 * it is stable across `./x` and `./x.js` references, but `path` carries the REAL
 * file — previously it was the stripped id, so `src/templates` was recorded for a
 * file named `src/templates.ts` and 25 of 48 module nodes pointed at nothing.
 */
function moduleNodeFor(sourceFile: string, root: string): GraphNode {
  const relWithExt = path.relative(root, sourceFile).replace(/\\/g, "/");
  const id = relWithExt.replace(/\.(tsx?|jsx?|mjs|cjs|mts|cts)$/, "");
  return {
    id: `module:${id}`,
    kind: "module",
    label: path.basename(id),
    path: relWithExt,
    confidence: "verified",
    metadata: {},
    evidence: [relWithExt],
  };
}

/**
 * Import/export/require/dynamic-import forms, matched against MASKED source so
 * comments and string bodies cannot contribute edges. `[\s\S]*?` spans newlines,
 * which is what makes multi-line imports visible.
 */
const JS_PATTERN_SOURCES: { source: string; kind: "static" | "reexport" | "require" | "dynamic" }[] = [
  // import ... from "x"  /  import "x"
  { source: String.raw`\bimport\b([\s\S]*?)\bfrom\s*${LITERAL_TOKEN}`, kind: "static" },
  { source: String.raw`\bimport\s*${LITERAL_TOKEN}`, kind: "static" },
  // export ... from "x"
  { source: String.raw`\bexport\b([\s\S]*?)\bfrom\s*${LITERAL_TOKEN}`, kind: "reexport" },
  // require("x")
  { source: String.raw`\brequire\s*\(\s*${LITERAL_TOKEN}\s*\)`, kind: "require" },
  // import("x")
  { source: String.raw`\bimport\s*\(\s*${LITERAL_TOKEN}\s*\)`, kind: "dynamic" },
];

interface RawMatch {
  specifier: string;
  typeOnly: boolean;
  line: number;
  kind: "static" | "reexport" | "require" | "dynamic";
}

/**
 * Collect every import site SYNCHRONOUSLY.
 *
 * Two hazards this shape avoids: `g`-flagged regexes carry a mutable `lastIndex`,
 * so they must never be shared across concurrent calls (the builder parses 50
 * files at once); and awaiting inside an `exec` loop lets another invocation
 * advance that index mid-iteration, silently dropping imports. Fresh regexes per
 * call, and no `await` until matching is finished.
 */
function collectJSMatches(source: ReturnType<typeof maskSource>): RawMatch[] {
  const out: RawMatch[] = [];
  for (const { source: pattern, kind } of JS_PATTERN_SOURCES) {
    const re = new RegExp(pattern, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(source.masked)) !== null) {
      const hasClause = match.length > 2;
      const clause = hasClause ? match[1] : "";
      const specifier = literalAt(source, hasClause ? match[2] : match[1]);
      if (!specifier || specifier.startsWith("node:")) continue;
      out.push({
        specifier,
        typeOnly: /^\s*type\b/.test(clause) || /\bexport\s+type\b/.test(match[0]),
        line: lineOf(source.masked, match.index),
        kind,
      });
    }
  }
  return out;
}

async function extractJSImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }

  const source = maskSource(content);
  const sourceNode = moduleNodeFor(filePath, root);
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];
  const unknowns: string[] = [];
  const relFile = path.relative(root, filePath).replace(/\\/g, "/");

  // from|to|relation -> already emitted, so a type-only import is never also
  // counted as a runtime import (the old `[^'"]*` spanned `type { Foo }`).
  const seen = new Set<string>();

  for (const { specifier, typeOnly, line, kind } of collectJSMatches(source)) {
    {
      const relation = typeOnly ? "imports-type" : "imports";

      let targetId: string;
      let targetNode: GraphNode;

      if (specifier.startsWith(".")) {
        const resolvedPath = await resolveRelative(specifier, filePath, root);
        if (resolvedPath) {
          const idPath = resolvedPath.replace(/\.(tsx?|jsx?|mjs|cjs|mts|cts)$/, "");
          targetId = `module:${idPath}`;
          targetNode = {
            id: targetId,
            kind: "module",
            label: path.basename(idPath),
            path: resolvedPath, // a real file — verified against disk
            confidence: "verified",
            metadata: {},
            evidence: [`${relFile}:${line}`],
          };
        } else {
          // Unresolvable relative import: record it as an unknown rather than
          // inventing a node with a path that does not exist.
          const idPath = path.relative(root, path.resolve(path.dirname(filePath), specifier)).replace(/\\/g, "/");
          targetId = `module:${idPath}`;
          targetNode = {
            id: targetId,
            kind: "module",
            label: path.basename(idPath),
            confidence: "unknown",
            metadata: { unresolved: true },
            evidence: [`${relFile}:${line}`],
          };
          unknowns.push(`unresolved import "${specifier}" at ${relFile}:${line}`);
        }
      } else {
        const pkg = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        targetId = `pkg:${pkg}`;
        targetNode = {
          id: targetId,
          kind: "package",
          label: pkg,
          confidence: "verified",
          metadata: {},
          evidence: [`${relFile}:${line}`],
        };
      }

      const key = `${sourceNode.id}→${targetId}→${relation}`;
      const runtimeKey = `${sourceNode.id}→${targetId}→imports`;
      // A runtime import supersedes a type-only one; never emit both.
      if (seen.has(key) || (typeOnly && seen.has(runtimeKey))) continue;
      seen.add(key);

      nodes.push(targetNode);
      edges.push({
        from: sourceNode.id,
        to: targetId,
        relation,
        confidence: "verified", // the statement itself is verified; node confidence carries resolution
        metadata: kind === "dynamic" || kind === "require" ? { [kind]: true } : {},
        evidence: [`${relFile}:${line}`],
      });
    }
  }

  return { nodes, edges, unknowns };
}

async function extractPythonImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const relWithExt = path.relative(root, filePath).replace(/\\/g, "/");
  const rel = relWithExt.replace(/\.py$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: relWithExt,
    confidence: "verified",
    metadata: {},
    evidence: [relWithExt],
  };
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];
  const lines = content.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();
    let targetName: string | null = null;
    let internal = false;

    // from .foo import bar  (relative)
    const relativeMatch = line.match(/^from\s+(\.+)([\w.]*)\s+import\s+/);
    if (relativeMatch) {
      const dots = relativeMatch[1];
      const mod = relativeMatch[2];
      // relative import — treat as internal module
      const levels = dots.length;
      const parts = rel.split(path.sep);
      const base = parts.slice(0, Math.max(0, parts.length - levels)).join("/");
      targetName = mod ? `${base}/${mod.replace(/\./g, "/")}` : base;
      internal = true;
    }

    if (!internal) {
      // from foo import bar
      const fromMatch = line.match(/^from\s+([\w.]+)\s+import\s+/);
      if (fromMatch) targetName = fromMatch[1].split(".")[0];
    }

    if (!internal) {
      // import foo, bar
      const importMatch = line.match(/^import\s+([\w., ]+)/);
      if (importMatch) {
        for (const part of importMatch[1].split(",")) {
          const name = part.trim().split(".")[0];
          if (name) {
            const id = `pkg:${name}`;
            nodes.push({ id, kind: "package", label: name, confidence: "verified", metadata: {}, evidence: [] });
            edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${lineIdx + 1}`] });
          }
        }
        continue;
      }
    }

    if (targetName) {
      const id = internal ? `module:${targetName}` : `pkg:${targetName}`;
      const kind = internal ? "module" : "package";
      nodes.push({ id, kind, label: path.basename(targetName), confidence: "verified", metadata: {}, evidence: [] });
      edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${lineIdx + 1}`] });
    }
  }
  return { nodes, edges };
}

async function extractGoImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const relWithExt = path.relative(root, filePath).replace(/\\/g, "/");
  const rel = relWithExt.replace(/\.go$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: relWithExt,
    confidence: "verified",
    metadata: {},
    evidence: [relWithExt],
  };
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];

  // Collect all quoted import paths from single and block imports
  const importPaths: { spec: string; line: number }[] = [];
  const lines = content.split("\n");
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      // Single: import "pkg" or import alias "pkg"
      const single = line.match(/^\s*import\s+(?:\w+\s+)?"([^"]+)"/);
      if (single) { importPaths.push({ spec: single[1], line: i + 1 }); continue; }
      if (/^\s*import\s*\(/.test(line)) { inBlock = true; continue; }
    } else {
      if (/^\s*\)/.test(line)) { inBlock = false; continue; }
      const entry = line.match(/^\s*(?:\w+\s+)?"([^"]+)"/);
      if (entry) importPaths.push({ spec: entry[1], line: i + 1 });
    }
  }

  for (const { spec, line } of importPaths) {
    const firstSegment = spec.split("/")[0];
    // Skip stdlib: first segment has no dot (e.g. "fmt", "net", "os")
    if (!firstSegment.includes(".")) continue;
    // External package: use up to 3 path segments as the package id
    const pkgId = `pkg:${spec.split("/").slice(0, 3).join("/")}`;
    const pkgLabel = spec.split("/").slice(0, 3).join("/");
    nodes.push({ id: pkgId, kind: "package", label: pkgLabel, confidence: "verified", metadata: {}, evidence: [] });
    edges.push({ from: sourceId, to: pkgId, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${line}`] });
  }
  return { nodes, edges };
}

async function extractRustImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const relWithExt = path.relative(root, filePath).replace(/\\/g, "/");
  const rel = relWithExt.replace(/\.rs$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: relWithExt,
    confidence: "verified",
    metadata: {},
    evidence: [relWithExt],
  };
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];
  const RUST_INTERNAL = new Set(["crate", "super", "self"]);
  const RUST_STDLIB = new Set(["std", "core", "alloc", "proc_macro", "test"]);
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // extern crate name;
    const extCrate = line.match(/^extern\s+crate\s+(\w+)\s*;/);
    if (extCrate) {
      const name = extCrate[1];
      if (!RUST_STDLIB.has(name)) {
        const id = `pkg:${name}`;
        nodes.push({ id, kind: "package", label: name, confidence: "verified", metadata: {}, evidence: [] });
        edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${i + 1}`] });
      }
      continue;
    }
    // use path::to::thing or use path::to::{a, b}
    const useStmt = line.match(/^(?:pub\s+)?use\s+([\w]+)/);
    if (useStmt) {
      const root_ = useStmt[1];
      if (RUST_INTERNAL.has(root_)) {
        // Internal module — extract path after crate:: / super:: / self::
        const internalPath = line.match(/^(?:pub\s+)?use\s+(?:crate|super|self)::([\w:]+)/);
        if (internalPath) {
          const modPath = internalPath[1].split("::")[0];
          const dir = rel.split("/").slice(0, -1).join("/");
          const id = dir ? `module:${dir}/${modPath}` : `module:${modPath}`;
          nodes.push({ id, kind: "module", label: modPath, confidence: "verified", metadata: {}, evidence: [] });
          edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${i + 1}`] });
        }
      } else if (!RUST_STDLIB.has(root_)) {
        const id = `pkg:${root_}`;
        nodes.push({ id, kind: "package", label: root_, confidence: "verified", metadata: {}, evidence: [] });
        edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${i + 1}`] });
      }
    }
  }
  return { nodes, edges };
}

async function extractRubyImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const relWithExt = path.relative(root, filePath).replace(/\\/g, "/");
  const rel = relWithExt.replace(/\.rb$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: relWithExt,
    confidence: "verified",
    metadata: {},
    evidence: [relWithExt],
  };
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // require_relative './path'
    const relReq = line.match(/^require_relative\s+['"]([^'"]+)['"]/);
    if (relReq) {
      const resolved = path.relative(root, path.resolve(path.dirname(filePath), relReq[1]));
      const id = `module:${resolved}`;
      nodes.push({ id, kind: "module", label: path.basename(resolved), path: resolved, confidence: "verified", metadata: {}, evidence: [] });
      edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${i + 1}`] });
      continue;
    }
    // require 'name'
    const req = line.match(/^require\s+['"]([^'"]+)['"]/);
    if (req) {
      const name = req[1].split("/")[0];
      const id = `pkg:${name}`;
      nodes.push({ id, kind: "package", label: name, confidence: "verified", metadata: {}, evidence: [] });
      edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${i + 1}`] });
    }
  }
  return { nodes, edges };
}

async function extractJavaImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const ext = path.extname(filePath).toLowerCase();
  const relWithExt = path.relative(root, filePath).replace(/\\/g, "/");
  const rel = relWithExt.replace(ext === ".kt" ? /\.kt$/ : /\.java$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: relWithExt,
    confidence: "verified",
    metadata: {},
    evidence: [relWithExt],
  };
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];
  // Skip stdlib/platform prefixes
  const SKIP_PREFIXES = ["java.", "javax.", "kotlin.", "android.", "sun.", "com.sun.", "jdk."];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // import static com.example.Util.method; or import com.example.Class;
    const imp = line.match(/^import\s+(?:static\s+)?([\w.]+)\s*;/);
    if (imp) {
      const fqn = imp[1];
      if (SKIP_PREFIXES.some((p) => fqn.startsWith(p))) continue;
      // Use first 2 segments as package id (e.g. com.example)
      const parts = fqn.split(".");
      const pkgLabel = parts.slice(0, 2).join(".");
      const id = `pkg:${pkgLabel}`;
      nodes.push({ id, kind: "package", label: pkgLabel, confidence: "verified", metadata: {}, evidence: [] });
      edges.push({ from: sourceId, to: id, relation: "imports", confidence: "verified", metadata: {}, evidence: [`${path.relative(root, filePath)}:${i + 1}`] });
    }
  }
  return { nodes, edges };
}

export async function extractImports(filePath: string, root: string): Promise<ImportResult> {
  const ext = path.extname(filePath).toLowerCase();
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(ext)) {
    return extractJSImports(filePath, root);
  }
  if (ext === ".py") {
    return extractPythonImports(filePath, root);
  }
  if (ext === ".go") {
    return extractGoImports(filePath, root);
  }
  if (ext === ".rs") {
    return extractRustImports(filePath, root);
  }
  if (ext === ".rb") {
    return extractRubyImports(filePath, root);
  }
  if (ext === ".java" || ext === ".kt") {
    return extractJavaImports(filePath, root);
  }
  return { nodes: [], edges: [] };
}
