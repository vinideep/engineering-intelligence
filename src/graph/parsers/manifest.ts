import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GraphNode } from "../schema.js";

export interface ManifestResult {
  nodes: GraphNode[];
  devNodeIds: Set<string>;
}

function pkgNode(name: string, manifestPath: string, dev: boolean): GraphNode {
  return {
    id: `pkg:${name}`,
    kind: "package",
    label: name,
    confidence: "verified",
    metadata: { dev },
    evidence: [manifestPath],
  };
}

async function tryRead(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function parsePackageJson(root: string): Promise<ManifestResult> {
  const manifestPath = path.join(root, "package.json");
  const content = await tryRead(manifestPath);
  if (!content) return { nodes: [], devNodeIds: new Set() };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { nodes: [], devNodeIds: new Set() };
  }
  const relPath = "package.json";
  const nodes: GraphNode[] = [];
  const devNodeIds = new Set<string>();
  const deps = parsed.dependencies;
  if (deps && typeof deps === "object" && !Array.isArray(deps)) {
    for (const name of Object.keys(deps)) {
      nodes.push(pkgNode(name, relPath, false));
    }
  }
  const devDeps = parsed.devDependencies;
  if (devDeps && typeof devDeps === "object" && !Array.isArray(devDeps)) {
    for (const name of Object.keys(devDeps)) {
      const id = `pkg:${name}`;
      devNodeIds.add(id);
      if (!nodes.find((n) => n.id === id)) {
        nodes.push(pkgNode(name, relPath, true));
      }
    }
  }
  const peerDeps = parsed.peerDependencies;
  if (peerDeps && typeof peerDeps === "object" && !Array.isArray(peerDeps)) {
    for (const name of Object.keys(peerDeps)) {
      const id = `pkg:${name}`;
      if (!nodes.find((n) => n.id === id)) {
        nodes.push(pkgNode(name, relPath, false));
      }
    }
  }
  return { nodes, devNodeIds };
}

async function parsePyproject(root: string): Promise<ManifestResult> {
  const manifestPath = path.join(root, "pyproject.toml");
  const content = await tryRead(manifestPath);
  if (!content) return { nodes: [], devNodeIds: new Set() };
  const relPath = "pyproject.toml";
  const nodes: GraphNode[] = [];
  // Extract [project.dependencies] array
  const depSection = content.match(/\[project\.dependencies\]([\s\S]*?)(?:\[|$)/);
  if (depSection) {
    const depLines = depSection[1].split("\n").filter((l) => l.trim().startsWith('"') || l.trim().startsWith("'"));
    for (const line of depLines) {
      const match = line.match(/['"]([\w-]+)/);
      if (match) nodes.push(pkgNode(match[1], relPath, false));
    }
  }
  return { nodes, devNodeIds: new Set() };
}

async function parseRequirementsTxt(root: string): Promise<ManifestResult> {
  const manifestPath = path.join(root, "requirements.txt");
  const content = await tryRead(manifestPath);
  if (!content) return { nodes: [], devNodeIds: new Set() };
  const relPath = "requirements.txt";
  const nodes: GraphNode[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const name = trimmed.split(/[>=<!~\[;]/)[0].trim();
    if (name) nodes.push(pkgNode(name, relPath, false));
  }
  return { nodes, devNodeIds: new Set() };
}

async function parseGoMod(root: string): Promise<ManifestResult> {
  const manifestPath = path.join(root, "go.mod");
  const content = await tryRead(manifestPath);
  if (!content) return { nodes: [], devNodeIds: new Set() };
  const relPath = "go.mod";
  const nodes: GraphNode[] = [];
  const inRequire = { value: false };
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "require (") { inRequire.value = true; continue; }
    if (trimmed === ")") { inRequire.value = false; continue; }
    if (trimmed.startsWith("require ") || inRequire.value) {
      const match = trimmed.match(/^(?:require\s+)?([\w.\-/]+)\s+v[\d.]/);
      if (match) nodes.push(pkgNode(match[1], relPath, false));
    }
  }
  return { nodes, devNodeIds: new Set() };
}

async function parseCargoToml(root: string): Promise<ManifestResult> {
  const manifestPath = path.join(root, "Cargo.toml");
  const content = await tryRead(manifestPath);
  if (!content) return { nodes: [], devNodeIds: new Set() };
  const relPath = "Cargo.toml";
  const nodes: GraphNode[] = [];
  let inDeps = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "[dependencies]") { inDeps = true; continue; }
    if (trimmed.startsWith("[") && trimmed !== "[dependencies]") { inDeps = false; continue; }
    if (inDeps) {
      const match = trimmed.match(/^([\w-]+)\s*=/);
      if (match) nodes.push(pkgNode(match[1], relPath, false));
    }
  }
  return { nodes, devNodeIds: new Set() };
}

export async function parseManifests(root: string): Promise<ManifestResult> {
  const results = await Promise.all([
    parsePackageJson(root),
    parsePyproject(root),
    parseRequirementsTxt(root),
    parseGoMod(root),
    parseCargoToml(root),
  ]);
  const nodes: GraphNode[] = [];
  const devNodeIds = new Set<string>();
  const seen = new Set<string>();
  for (const result of results) {
    for (const id of result.devNodeIds) devNodeIds.add(id);
    for (const node of result.nodes) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        nodes.push(node);
      }
    }
  }
  return { nodes, devNodeIds };
}
