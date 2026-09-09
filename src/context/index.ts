/**
 * get_context — the queryable context pack.
 *
 * Instead of a model reading 10-15 files (and re-reasoning about them) to orient
 * before a change, it asks one deterministic question: "assemble what I need to
 * work on <task> touching <files>, within <budget> tokens." We return a compact,
 * evidence-backed pack: the graph neighborhood of the touched files, the VERIFIED
 * claims about that code, the project conventions, and the known dangerous areas —
 * sliced to a token budget, highest-value first. This is what makes small models
 * viable: they retrieve trustworthy facts rather than infer them from raw source.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { estimateTokens } from "../token-optimizer.js";
import { loadExistingGraph, analyzeImpact } from "../graph/index.js";
import { verifyClaims, loadClaims } from "../claims/index.js";

export * from "./orchestrator.js";

export interface ContextRequest {
  task: string;
  files?: string[];
  budget?: number;
}

export interface ContextPack {
  task: string;
  markdown: string;
  tokensEstimated: number;
  budget: number;
  included: string[];
  omitted: string[];
}

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|py|go|rs|rb|java|kt)$/;

function toModuleId(root: string, file: string): string {
  const rel = path.relative(root, path.resolve(root, file)).replace(/\\/g, "/").replace(SOURCE_EXT, "");
  return `module:${rel}`;
}

interface Section {
  name: string;
  priority: number;   // higher = kept first
  header: string;
  // Full body, and optionally a bounded item list so we can partially include.
  items?: string[];
  body?: string;
}

async function readIfExists(root: string, rel: string): Promise<string | null> {
  try { return await readFile(path.join(root, rel), "utf8"); } catch { return null; }
}

function tokenizeWords(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
}

export async function getContext(root: string, request: ContextRequest): Promise<ContextPack> {
  const budget = request.budget && request.budget > 0 ? request.budget : 2000;
  const files = (request.files ?? []).map((f) => f.replace(/\\/g, "/"));
  const fileModuleIds = new Set(files.map((f) => toModuleId(root, f)));

  // --- Graph neighborhood ---------------------------------------------------
  const graph = await loadExistingGraph(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"));
  const dependents = new Set<string>();
  const dependencies = new Set<string>();
  if (graph && files.length > 0) {
    const impact = await analyzeImpact(root, files);
    for (const id of [...impact.direct, ...impact.indirect]) dependents.add(id);
    for (const edge of graph.edges) {
      if (fileModuleIds.has(edge.from) && (edge.relation === "imports" || edge.relation === "imports-type")) {
        dependencies.add(edge.to);
      }
    }
  }
  const relevantModules = new Set<string>([...fileModuleIds, ...dependents, ...dependencies]);

  // --- Claims, split by what actually verified them -------------------------
  // Derived claims were RE-COMPUTED from source, so they may be served as facts.
  // Asserted claims have an intact anchor but nothing checked the sentence, so
  // they are served separately and explicitly labelled unproven — presenting them
  // as facts is the failure this split exists to prevent.
  const claimStore = await loadClaims(root);
  const verifyReport = await verifyClaims(root);
  const statusById = new Map(verifyReport.results.map((r) => [r.id, r]));
  const taskWords = tokenizeWords(request.task);
  const claimItems: string[] = [];
  const assertedItems: string[] = [];
  for (const claim of claimStore.claims) {
    const result = statusById.get(claim.id);
    if (!result) continue;
    if (result.status !== "verified" && result.status !== "unverified") continue; // refuted/stale/missing are never served
    const evPaths = claim.evidence.map((e) => e.path);
    const moduleRelevant = files.length > 0 && evPaths.some((p) => relevantModules.has(toModuleId(root, p)));
    const wordRelevant = files.length === 0 && [...tokenizeWords(result.statement)].some((w) => taskWords.has(w) && w.length > 3);
    if (!(moduleRelevant || wordRelevant || (files.length === 0 && taskWords.size === 0))) continue;
    const line = `- ${result.statement} _(evidence: ${evPaths.join(", ")})_`;
    if (result.status === "verified") claimItems.push(line);
    else assertedItems.push(`${line}${claim.author ? ` — asserted by ${claim.author}` : ""}`);
  }

  // --- Conventions & dangerous areas (prose intelligence, if present) -------
  const conventions = await readIfExists(root, ".engineering-intelligence/memory/coding-patterns.md");
  const dangerous = await readIfExists(root, ".engineering-intelligence/context/dangerous-areas.md");

  function summarize(md: string, maxLines: number): string {
    return md.split("\n").filter((l) => l.trim()).slice(0, maxLines).join("\n");
  }

  // --- Assemble candidate sections -----------------------------------------
  const sections: Section[] = [];

  if (relevantModules.size > 0) {
    const items: string[] = [];
    if (fileModuleIds.size) items.push(`Touched: ${[...fileModuleIds].map((m) => m.replace(/^module:/, "")).join(", ")}`);
    if (dependents.size) items.push(`Depended on by (impact if changed): ${[...dependents].slice(0, 30).map((m) => m.replace(/^module:/, "")).join(", ")}`);
    if (dependencies.size) items.push(`Depends on: ${[...dependencies].slice(0, 30).map((m) => m.replace(/^(module:|pkg:)/, "")).join(", ")}`);
    sections.push({ name: "graph-neighborhood", priority: 80, header: "## Graph neighborhood", items });
  }
  if (claimItems.length > 0) {
    sections.push({ name: "verified-claims", priority: 100, header: "## Verified facts (re-derived from current source)", items: claimItems });
  }
  if (assertedItems.length > 0) {
    // Lower priority than facts: if the budget is tight, unproven statements are
    // the first thing to drop.
    sections.push({ name: "asserted-claims", priority: 40, header: "## Unverified assertions (anchored, but NOT machine-checked — do not treat as fact)", items: assertedItems });
  }
  if (dangerous) {
    sections.push({ name: "dangerous-areas", priority: 75, header: "## Dangerous areas", body: summarize(dangerous, 20) });
  }
  if (conventions) {
    sections.push({ name: "conventions", priority: 50, header: "## Conventions", body: summarize(conventions, 25) });
  }

  // --- Budget assembly: header always; then by priority, partial for lists --
  const included: string[] = [];
  const omitted: string[] = [];
  const parts: string[] = [`# Context for: ${request.task}`, ""];
  let used = estimateTokens(parts.join("\n"));

  for (const section of sections.sort((a, b) => b.priority - a.priority)) {
    const headerCost = estimateTokens(section.header) + 2;
    if (section.items) {
      const kept: string[] = [];
      let sectionUsed = headerCost;
      for (const item of section.items) {
        const cost = estimateTokens(item) + 1;
        if (used + sectionUsed + cost > budget) break;
        kept.push(item);
        sectionUsed += cost;
      }
      if (kept.length > 0) {
        parts.push(section.header, ...kept, "");
        used += sectionUsed;
        included.push(section.name + (kept.length < section.items.length ? ` (${kept.length}/${section.items.length})` : ""));
      } else {
        omitted.push(section.name);
      }
    } else if (section.body) {
      const cost = headerCost + estimateTokens(section.body);
      if (used + cost <= budget) {
        parts.push(section.header, section.body, "");
        used += cost;
        included.push(section.name);
      } else {
        omitted.push(section.name);
      }
    }
  }

  if (included.length === 0) {
    parts.push("_No persisted intelligence available for this task. Run `initialize-engineering-intelligence` (and `map`) so future context queries are answered from evidence instead of re-exploration._", "");
  }

  const markdown = parts.join("\n").replace(/\n{3,}/g, "\n\n");
  return {
    task: request.task,
    markdown,
    tokensEstimated: estimateTokens(markdown),
    budget,
    included,
    omitted,
  };
}
