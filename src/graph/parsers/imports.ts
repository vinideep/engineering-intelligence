import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GraphNode, GraphEdge } from "../schema.js";

export interface ImportResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
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

function moduleNodeFor(sourceFile: string, root: string): GraphNode {
  const rel = path.relative(root, sourceFile).replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
  return {
    id: `module:${rel}`,
    kind: "module",
    label: path.basename(rel),
    path: rel,
    confidence: "verified",
    metadata: {},
    evidence: [path.relative(root, sourceFile)],
  };
}

async function extractJSImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const sourceNode = moduleNodeFor(filePath, root);
  const nodes: GraphNode[] = [sourceNode];
  const edges: GraphEdge[] = [];
  const lines = content.split("\n");

  // Patterns to match
  const patterns: { re: RegExp; typeOnly: boolean }[] = [
    // import type ... from '...'
    { re: /\bimport\s+type\b[^'"]*from\s+['"]([^'"]+)['"]/g, typeOnly: true },
    // import ... from '...'
    { re: /\bimport\b[^'"]*from\s+['"]([^'"]+)['"]/g, typeOnly: false },
    // require('...')
    { re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, typeOnly: false },
    // export ... from '...'
    { re: /\bexport\b[^'"]*from\s+['"]([^'"]+)['"]/g, typeOnly: false },
  ];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (const { re, typeOnly } of patterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(line)) !== null) {
        const specifier = match[1];
        // skip node: builtins
        if (specifier.startsWith("node:")) continue;
        const resolved = resolveSpecifier(specifier, filePath, root);
        const targetNode: GraphNode = {
          id: resolved.id,
          kind: resolved.kind,
          label: resolved.label,
          path: resolved.filePath,
          confidence: "verified",
          metadata: {},
          evidence: [],
        };
        nodes.push(targetNode);
        const edgeKey = `${sourceNode.id}→${resolved.id}→${typeOnly ? "imports-type" : "imports"}`;
        const evidence = `${path.relative(root, filePath)}:${lineIdx + 1}`;
        edges.push({
          from: sourceNode.id,
          to: resolved.id,
          relation: typeOnly ? "imports-type" : "imports",
          confidence: "verified",
          metadata: {},
          evidence: [evidence],
        });
        // Avoid duplicate edges (same from/to/relation from multiple lines — merge evidence later)
        void edgeKey;
      }
    }
  }
  return { nodes, edges };
}

async function extractPythonImports(filePath: string, root: string): Promise<ImportResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return { nodes: [], edges: [] };
  }
  const rel = path.relative(root, filePath).replace(/\.py$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: rel,
    confidence: "verified",
    metadata: {},
    evidence: [path.relative(root, filePath)],
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
  const rel = path.relative(root, filePath).replace(/\.go$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: rel,
    confidence: "verified",
    metadata: {},
    evidence: [path.relative(root, filePath)],
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
  const rel = path.relative(root, filePath).replace(/\.rs$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: rel,
    confidence: "verified",
    metadata: {},
    evidence: [path.relative(root, filePath)],
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
          const id = `module:${rel.split("/").slice(0, -1).join("/")}/${modPath}`.replace(/^\//, "");
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
  const rel = path.relative(root, filePath).replace(/\.rb$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: rel,
    confidence: "verified",
    metadata: {},
    evidence: [path.relative(root, filePath)],
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
  const rel = path.relative(root, filePath).replace(ext === ".kt" ? /\.kt$/ : /\.java$/, "");
  const sourceId = `module:${rel}`;
  const sourceNode: GraphNode = {
    id: sourceId,
    kind: "module",
    label: path.basename(rel),
    path: rel,
    confidence: "verified",
    metadata: {},
    evidence: [path.relative(root, filePath)],
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
