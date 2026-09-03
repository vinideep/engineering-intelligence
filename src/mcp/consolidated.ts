import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEiConfig } from "../config/index.js";
import { getEngineeringContext } from "../context/orchestrator.js";
import { analyzeImpact, ensureFreshGraph } from "../graph/index.js";
import { validateChange, syncEngineeringKnowledge } from "../orchestrators/change.js";
import { GRAPHIFY_GRAPH_PATH } from "../providers/graphify.js";
import { providerStatus } from "../providers/manager.js";
import { searchCodeContext } from "../providers/cce.js";
import { inspectProjectProviderRuns } from "../providers/project-status.js";
import { PROVIDER_NAMES } from "../providers/types.js";
import { McpToolRegistry } from "./registry.js";

const rootProperty = { type: "string" as const };
const filesProperty = { type: "array" as const, items: { type: "string" as const } };

function rootOf(args: Record<string, unknown>, projectRoot: string): string {
  return typeof args.root === "string" ? path.resolve(args.root) : projectRoot;
}

export async function createConsolidatedRegistry(projectRoot: string): Promise<McpToolRegistry> {
  const registry = new McpToolRegistry();
  registry.register({
    name: "get_engineering_context",
    description: "Build ContextPackV2 from verified EI knowledge, the canonical normalized graph, and current scoped code evidence. Use this before direct file exploration.",
    inputSchema: { type: "object", required: ["task"], additionalProperties: false, properties: { root: rootProperty, task: { type: "string" }, files: filesProperty, budget: { type: "number", minimum: 1 } } },
    handler: async (args) => getEngineeringContext(rootOf(args, projectRoot), { task: args.task as string, files: args.files as string[] | undefined, budget: args.budget as number | undefined }),
  });
  registry.register({
    name: "analyze_change_impact",
    description: "Refresh EI's canonical graph and deterministically analyze direct/indirect impact, tests, risks, and unknowns for changed files.",
    inputSchema: { type: "object", required: ["changedFiles"], additionalProperties: false, properties: { root: rootProperty, changedFiles: filesProperty } },
    handler: async (args) => {
      const root = rootOf(args, projectRoot);
      const freshness = await ensureFreshGraph(root);
      return { freshness, ...(await analyzeImpact(root, args.changedFiles as string[])) };
    },
  });
  registry.register({
    name: "validate_change",
    description: "Run deterministic change validation: impact, all built-in safety gates, claims, knowledge references, and citation freshness.",
    inputSchema: { type: "object", additionalProperties: false, properties: { root: rootProperty, files: filesProperty, base: { type: "string" } } },
    handler: async (args) => validateChange(rootOf(args, projectRoot), args.files as string[] | undefined, typeof args.base === "string" ? args.base : "HEAD"),
  });
  registry.register({
    name: "sync_engineering_knowledge",
    description: "Post-edit synchronization for EI's graph, provider indexes, derived claims, and knowledge health. Canonical prose is flagged for model synthesis rather than silently rewritten.",
    inputSchema: { type: "object", additionalProperties: false, properties: { root: rootProperty, files: filesProperty } },
    handler: async (args) => syncEngineeringKnowledge(rootOf(args, projectRoot), args.files as string[] | undefined),
  });
  registry.register({
    name: "provider_status",
    description: "Report pinned Graphify/CCE health, policy, versions, fallbacks, and remediation without installing anything.",
    inputSchema: { type: "object", additionalProperties: false, properties: { root: rootProperty } },
    handler: async (args) => {
      const root = rootOf(args, projectRoot);
      const providerConfig = await loadEiConfig(root);
      const disabled = providerConfig.providers.policy === "native";
      const [binaries, projectRuns] = await Promise.all([
        Promise.all(PROVIDER_NAMES.map((name) => providerStatus(name, { disabled }))),
        inspectProjectProviderRuns(root, { disabled }),
      ]);
      return { policy: providerConfig.providers.policy, requireProviders: providerConfig.providers.requireProviders, binaries, projectRuns };
    },
  });

  const config = await loadEiConfig(projectRoot);
  if (config.providers.exposeRawMcp === true) {
    registry.register({
      name: "provider_graphify_evidence",
      description: "Expert mode: inspect capped raw Graphify provider evidence. EI does not treat this output as canonical knowledge.",
      inputSchema: { type: "object", additionalProperties: false, properties: { root: rootProperty, limit: { type: "number", minimum: 1 } } },
      handler: async (args) => {
        const root = rootOf(args, projectRoot);
        const limit = typeof args.limit === "number" ? Math.min(1000, args.limit) : 100;
        const raw = JSON.parse(await readFile(path.join(root, GRAPHIFY_GRAPH_PATH), "utf8")) as { nodes?: unknown[]; edges?: unknown[]; links?: unknown[] };
        return { canonical: false, nodes: (raw.nodes ?? []).slice(0, limit), edges: (raw.edges ?? raw.links ?? []).slice(0, limit) };
      },
    });
    registry.register({
      name: "provider_cce_retrieval",
      description: "Expert mode: request CCE-backed retrieval through EI's mandatory scope and freshness filters.",
      inputSchema: { type: "object", required: ["query"], additionalProperties: false, properties: { root: rootProperty, query: { type: "string" }, scope: filesProperty, topK: { type: "number", minimum: 1 } } },
      handler: async (args) => searchCodeContext(rootOf(args, projectRoot), args.query as string, args.scope as string[] | undefined ?? [], { topK: args.topK as number | undefined }),
    });
  }
  return registry;
}
