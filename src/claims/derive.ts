/**
 * Derived facts — statements the tool can RE-COMPUTE, and therefore actually verify.
 *
 * The distinction this module exists to enforce:
 *
 *   An anchor proves a symbol still EXISTS. It does not prove the sentence bound
 *   to it is TRUE. A claim like "the auth endpoint is rate-limited", anchored to a
 *   handler with no rate limiting, resolves fine, hashes cleanly, and would report
 *   `verified` forever. That is an expensive mtime wearing a green checkmark, and
 *   it is worse than no claim at all because it is trusted.
 *
 * A *derived* fact is a structured descriptor plus a rendering function. Its
 * statement is not authored — it is generated from the descriptor. Verification
 * re-derives the whole fact set from source and asks whether this fact is still
 * in it. So "verified" means the sentence itself was recomputed and still holds.
 *
 * Anything a human or a model writes freehand is an *asserted* claim (see
 * index.ts) and can never earn that label.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildDependencyGraph } from "../graph/builders/dependency.js";
import { extractApiSurface } from "../gates/api-diff.js";
import { walkFiles } from "../gates/index.js";

export type DerivedFact =
  | { type: "source-file"; path: string; evidence: string }
  | { type: "module-imports"; from: string; to: string; evidence: string }
  | { type: "package-dependency"; name: string; evidence: string }
  | { type: "http-route"; method: string; route: string; file: string; evidence: string };

/** Stable identity for a fact, used to compare a recorded claim against a fresh derivation. */
export function factKey(fact: DerivedFact): string {
  switch (fact.type) {
    case "source-file":         return `source-file|${fact.path}`;
    case "module-imports":      return `module-imports|${fact.from}|${fact.to}`;
    case "package-dependency":  return `package-dependency|${fact.name}`;
    case "http-route":          return `http-route|${fact.method}|${fact.route}|${fact.file}`;
  }
}

/**
 * The human-readable statement. Generated, never authored — which is exactly
 * what makes it checkable: re-deriving the fact regenerates this sentence.
 */
export function renderFact(fact: DerivedFact): string {
  switch (fact.type) {
    case "source-file":        return `Source module \`${fact.path}\` is in EI's approved project scope.`;
    case "module-imports":     return `Module \`${fact.from}\` imports \`${fact.to}\`.`;
    case "package-dependency": return `\`${fact.name}\` is a declared package dependency.`;
    case "http-route":         return `HTTP route \`${fact.method} ${fact.route}\` is defined in \`${fact.file}\`.`;
  }
}

const CODE_FILE = /\.(tsx?|jsx?|mjs|cjs)$/;

/**
 * Compute every fact currently true of the repository.
 *
 * Sources are the deterministic engines only — the dependency graph (which after
 * the graph-honesty work resolves specifiers against disk and reports what it
 * cannot resolve) and the route extractor. Nothing here consults an LLM, so the
 * output is reproducible and a disagreement between two runs is a real change.
 */
export async function deriveFacts(root: string): Promise<DerivedFact[]> {
  const facts: DerivedFact[] = [];

  // Claims must be checked against source, not against a previously persisted
  // graph that may have been incrementally refreshed or enriched by a provider.
  // Build an in-memory native graph for every derivation; provider evidence is
  // deliberately absent from this authority path.
  const { graph } = await buildDependencyGraph(root);

  {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const node of graph.nodes) {
      if (node.kind !== "module" || !node.path || node.confidence !== "verified") continue;
      facts.push({ type: "source-file", path: node.path, evidence: node.path });
    }
    for (const edge of graph.edges) {
      // Only runtime module→module coupling. Type-only edges are compile-time and
      // package edges are covered by package-dependency below.
      if (edge.relation !== "imports") continue;
      // Provider-only and contested relationships are useful exploration
      // evidence, but they are not canonical facts. Only native relationships
      // (which have no provider trust marker) or source-corroborated fresh
      // relationships may be promoted into EI's derived claim registry.
      const trustState = edge.metadata?.trustState;
      if (trustState && trustState !== "fresh") continue;
      if (edge.metadata?.provider === "graphify" && edge.metadata?.corroborated !== true) continue;
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from?.path || !to?.path) continue;          // unresolved — not a fact we can state
      if (to.confidence !== "verified") continue;      // the graph itself is unsure
      facts.push({
        type: "module-imports",
        from: from.path,
        to: to.path,
        evidence: edge.evidence[0] ?? from.path,
      });
    }
    for (const node of graph.nodes) {
      if (node.kind !== "package") continue;
      if (node.metadata?.declared !== true) continue;
      if (node.metadata && (node.metadata as Record<string, unknown>).dev === true) continue;
      facts.push({
        type: "package-dependency",
        name: node.label,
        evidence: node.evidence[0] ?? "package.json",
      });
    }
  }

  // HTTP surface — the same extractor the api-diff gate uses, so the two can
  // never disagree about what an endpoint is.
  const codeFiles = await walkFiles(root, (rel) => CODE_FILE.test(rel));
  for (const abs of codeFiles) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (/(^|\/)(?:test|tests|__tests__|fixtures)(\/|$)/i.test(rel)) continue;
    let content = "";
    try { content = await readFile(abs, "utf8"); } catch { continue; }
    for (const endpoint of extractApiSurface(content, rel)) {
      const [method, ...routeParts] = endpoint.split(" ");
      const route = routeParts.join(" ");
      if (!route) continue;
      facts.push({ type: "http-route", method, route, file: rel, evidence: rel });
    }
  }

  // Deduplicate — a fact stated twice is still one fact.
  const seen = new Set<string>();
  return facts.filter((f) => {
    const key = factKey(f);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
