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

export async function extractImports(filePath: string, root: string): Promise<ImportResult> {
  const ext = path.extname(filePath).toLowerCase();
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(ext)) {
    return extractJSImports(filePath, root);
  }
  if (ext === ".py") {
    return extractPythonImports(filePath, root);
  }
  return { nodes: [], edges: [] };
}
