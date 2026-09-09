import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadExistingGraph } from "../graph/builders/dependency.js";
import { analyzeImpact } from "../graph/index.js";
import type { DependencyGraph } from "../graph/schema.js";

function aidlcDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "aidlc");
}

function graphPath(root: string): string {
  return path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json");
}

export function parseTicketTargetNodes(content: string): string[] {
  const nodes: string[] = [];
  const lines = content.split("\n");

  let inTargetSection = false;
  for (const line of lines) {
    const trimmed = line.trim();

    // Check for start of target nodes section
    if (/^-\s*(target\s+graph\s+nodes|target\s+nodes):/i.test(trimmed)) {
      inTargetSection = true;
      // Check for inline array: - Target Graph Nodes: [module:src/a, symbol:src/b#fn]
      const afterColon = trimmed.split(/:(.+)/)[1]?.trim() || "";
      if (afterColon) {
        const cleaned = afterColon.replace(/[\[\]]/g, "");
        for (const item of cleaned.split(",")) {
          const id = item.trim();
          if (id) nodes.push(id);
        }
      }
      continue;
    }

    if (inTargetSection) {
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const id = trimmed.replace(/^[-*]\s*/, "").trim();
        // Stop if this is a different top-level section bullet
        if (id.includes(":") && !id.startsWith("module:") && !id.startsWith("symbol:") && !id.startsWith("pkg:") && !id.startsWith("proposed:")) {
          inTargetSection = false;
        } else if (id) {
          nodes.push(id);
        }
      } else if (trimmed.startsWith("#") || (trimmed.length > 0 && !trimmed.startsWith(" "))) {
        inTargetSection = false;
      }
    }
  }

  return [...new Set(nodes)];
}

export async function validateTicketNodes(
  root: string,
  nodeIds: string[],
): Promise<{ valid: boolean; missingNodes: string[]; existingNodes: string[] }> {
  const gPath = graphPath(root);
  if (!existsSync(gPath)) {
    return {
      valid: false,
      missingNodes: [...nodeIds],
      existingNodes: [],
    };
  }

  const graph = await loadExistingGraph(gPath);
  if (!graph) {
    return {
      valid: false,
      missingNodes: [...nodeIds],
      existingNodes: [],
    };
  }

  const knownNodeIds = new Set(graph.nodes.map((n) => n.id));
  const missingNodes: string[] = [];
  const existingNodes: string[] = [];

  for (const id of nodeIds) {
    // Greenfield / forward entities starting with "proposed:" are allowed
    if (id.startsWith("proposed:")) {
      existingNodes.push(id);
      continue;
    }
    if (knownNodeIds.has(id)) {
      existingNodes.push(id);
    } else {
      missingNodes.push(id);
    }
  }

  return {
    valid: missingNodes.length === 0,
    missingNodes,
    existingNodes,
  };
}

export function extractFilesFromNodeIds(nodeIds: string[]): string[] {
  const files: string[] = [];
  for (const id of nodeIds) {
    if (id.startsWith("module:")) {
      files.push(id.slice("module:".length));
    } else if (id.startsWith("symbol:")) {
      const part = id.slice("symbol:".length).split("#")[0];
      if (part) files.push(part);
    } else if (id.startsWith("proposed:")) {
      const part = id.slice("proposed:".length).split("#")[0];
      if (part) files.push(part);
    }
  }
  return [...new Set(files)];
}

export async function scanBacklogTicketNodes(
  root: string,
): Promise<Map<string, string[]>> {
  const ticketMap = new Map<string, string[]>();
  const ticketsDir = path.join(aidlcDir(root), "agile", "backlog", "tickets");

  if (existsSync(ticketsDir)) {
    try {
      const entries = await readdir(ticketsDir);
      for (const e of entries) {
        if (!e.endsWith(".md")) continue;
        const full = path.join(ticketsDir, e);
        const content = await readFile(full, "utf8");
        const nodes = parseTicketTargetNodes(content);
        if (nodes.length > 0) {
          const ticketId = e.replace(/\.md$/, "");
          ticketMap.set(ticketId, nodes);
        }
      }
    } catch {
      // ignore
    }
  }

  return ticketMap;
}

export async function validateAllBacklogTickets(
  root: string,
): Promise<{ valid: boolean; errors: Array<{ ticket: string; missing: string[] }> }> {
  const ticketMap = await scanBacklogTicketNodes(root);
  const errors: Array<{ ticket: string; missing: string[] }> = [];

  for (const [ticket, nodes] of ticketMap) {
    const res = await validateTicketNodes(root, nodes);
    if (!res.valid) {
      errors.push({ ticket, missing: res.missingNodes });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
