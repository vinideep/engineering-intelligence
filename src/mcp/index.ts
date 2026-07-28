#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildGraph, analyzeImpact, loadExistingGraph } from "../graph/index.js";
import { readFile as readFileFn } from "node:fs/promises";

const TOOLS = [
  {
    name: "map_dependencies",
    description:
      "Run the deterministic dependency graph builder on a repository. Parses package manifests (package.json, pyproject.toml, go.mod, Cargo.toml) and source-file imports (JS/TS/Python) to produce a validated dependency-graph.json. Returns the graph as JSON.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        update: { type: "boolean", description: "If true, run in incremental mode using the files list." },
        files: { type: "array", items: { type: "string" }, description: "Changed files for incremental update." },
      },
    },
  },
  {
    name: "get_graph",
    description:
      "Read an existing graph file from .engineering-intelligence/graph/ and return it as JSON. Use map_dependencies first if no graph exists yet.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        type: {
          type: "string",
          enum: ["dependency", "service", "runtime", "business-flow", "data-flow"],
          description: "Graph type to read. Defaults to 'dependency'.",
        },
      },
    },
  },
  {
    name: "analyze_impact",
    description:
      "Given a list of changed files, traverse the dependency graph and return which modules directly or indirectly import them. Requires a graph built by map_dependencies.",
    inputSchema: {
      type: "object" as const,
      required: ["changedFiles"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        changedFiles: {
          type: "array",
          items: { type: "string" },
          description: "List of changed file paths (relative to root or absolute).",
        },
      },
    },
  },
  {
    name: "run_gate",
    description:
      "Run a deterministic safety gate and return structured findings (severity error/warning/info). Gates: 'env-vars' (code env references vs .env.example), 'dead-exports' (JS/TS exports never imported), 'api-diff' (routes/contracts removed vs a git base ref), 'migration-lint' (destructive/locking DB migration ops). Prefer this over reviewing the code by hand for these checks.",
    inputSchema: {
      type: "object" as const,
      required: ["gate"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        gate: {
          type: "string",
          enum: ["env-vars", "dead-exports", "api-diff", "migration-lint"],
          description: "Which gate to run.",
        },
        base: { type: "string", description: "Git base ref for api-diff/migration-lint. Defaults to HEAD." },
        failOn: {
          type: "string",
          enum: ["error", "warning", "info"],
          description: "Minimum severity that fails the gate. Defaults to 'error'. Use 'warning' to make advisory gates (env-vars, dead-exports) blocking.",
        },
      },
    },
  },
  {
    name: "get_context",
    description:
      "Assemble a compact, token-budgeted context pack for a task instead of reading many files. Returns the graph neighborhood of the touched files (what they depend on and what depends on them), the DERIVED facts about that code (re-computed from source, so refuted or stale ones are excluded), any asserted claims under a separate clearly-unverified heading, plus project conventions and dangerous areas. Read this FIRST to orient before editing; it is cheaper and more trustworthy than re-reading source.",
    inputSchema: {
      type: "object" as const,
      required: ["task"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        task: { type: "string", description: "What you are about to do, in a sentence." },
        files: { type: "array", items: { type: "string" }, description: "Files the task will touch (drives the graph neighborhood and claim relevance)." },
        budget: { type: "number", description: "Max tokens for the pack. Defaults to 2000; sections are trimmed lowest-value first." },
      },
    },
  },
  {
    name: "verify_claims",
    description:
      "Check recorded claims against the current source. DERIVED claims are re-computed from source, so 'verified' means the statement itself still holds and 'refuted' means it no longer does. ASSERTED claims are free text: their evidence is hash-checked, but the sentence is never machine-checked, so they report 'unverified' and must not be treated as fact. Deterministic, no LLM.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
      },
    },
  },
  {
    name: "derive_claims",
    description:
      "Recompute the derived-fact baseline (module imports, package dependencies, HTTP routes) from source and store it as verifiable claims. Asserted claims written by humans are left untouched. Run after significant changes so `verify_claims` and `get_context` reflect reality.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
      },
    },
  },
  {
    name: "read_knowledge",
    description:
      "List or read files from the knowledge-base/ directory. Omit 'file' to list all knowledge files. Provide 'file' (relative path within knowledge-base/) to read its contents.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        file: { type: "string", description: "Relative path within knowledge-base/ to read. Omit to list all files." },
      },
    },
  },
];

/** Tool names and one-line purposes, for the installed instructions. */
export const MCP_TOOL_SUMMARY: ReadonlyArray<readonly [string, string]> = [
  ["map_dependencies", "build/refresh the computed dependency graph from source imports"],
  ["get_graph", "read an existing graph as JSON"],
  ["analyze_impact", "given changed files, list the modules that import them (direct + indirect)"],
  ["run_gate", "run a deterministic safety gate: env-vars, dead-exports, api-diff, migration-lint"],
  ["get_context", "assemble a token-budgeted context pack for a task"],
  ["verify_claims", "check claims: derived facts are re-computed; asserted prose is never called verified"],
  ["derive_claims", "recompute the derived-fact baseline (imports, dependencies, routes) from source"],
  ["read_knowledge", "list or read knowledge-base documents"],
];

/**
 * Project-scoped MCP server registration. Hosts that read a project `.mcp.json`
 * (Claude Code) or `.cursor/mcp.json` (Cursor) will start the server themselves,
 * so the tools are actually reachable instead of requiring the user to register
 * the server by hand and then somehow know the tool names.
 */
export function mcpServerRegistration(): string {
  return JSON.stringify(
    {
      mcpServers: {
        "engineering-intelligence": {
          command: "npx",
          args: ["-y", "engineering-intelligence", "mcp"],
        },
      },
    },
    null,
    2,
  ) + "\n";
}

export async function startMcpServer(projectRoot: string): Promise<void> {
  const server = new Server(
    { name: "engineering-intelligence", version: "2.3.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const root = (typeof args.root === "string" ? args.root : projectRoot);

    try {
      if (name === "map_dependencies") {
        const update = args.update === true;
        const files = Array.isArray(args.files) ? (args.files as string[]) : undefined;
        const result = await buildGraph(root, { update, files, write: true });
        const graph = await loadExistingGraph(
          path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"),
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: {
                  nodeCount: result.nodeCount,
                  edgeCount: result.edgeCount,
                  fileCount: result.fileCount,
                  wasIncremental: result.wasIncremental,
                  graphPath: result.graphPath,
                },
                graph,
              }, null, 2),
            },
          ],
        };
      }

      if (name === "get_graph") {
        const type = typeof args.type === "string" ? args.type : "dependency";
        const graphPath = path.join(root, ".engineering-intelligence", "graph", `${type}-graph.json`);
        const graph = await loadExistingGraph(graphPath);
        if (!graph) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: `No ${type}-graph.json found. Run map_dependencies first.` }) }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
      }

      if (name === "analyze_impact") {
        const changedFiles = Array.isArray(args.changedFiles) ? (args.changedFiles as string[]) : [];
        if (changedFiles.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "changedFiles is required and must be non-empty" }) }],
            isError: true,
          };
        }
        const result = await analyzeImpact(root, changedFiles);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      if (name === "run_gate") {
        const { runGate, isGateName } = await import("../gates/index.js");
        const gate = typeof args.gate === "string" ? args.gate : "";
        if (!isGateName(gate)) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: `Unknown gate: ${gate}` }) }],
            isError: true,
          };
        }
        const base = typeof args.base === "string" ? args.base : undefined;
        const failOn = typeof args.failOn === "string" ? args.failOn as "error" | "warning" | "info" : undefined;
        const result = await runGate(gate, root, { base, failOn });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      if (name === "get_context") {
        const task = typeof args.task === "string" ? args.task : "";
        if (!task) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "task is required" }) }], isError: true };
        }
        const { getContext } = await import("../context/index.js");
        const files = Array.isArray(args.files) ? (args.files as string[]) : undefined;
        const budget = typeof args.budget === "number" ? args.budget : undefined;
        const pack = await getContext(root, { task, files, budget });
        return { content: [{ type: "text", text: pack.markdown }] };
      }

      if (name === "verify_claims") {
        const { verifyClaims } = await import("../claims/index.js");
        const report = await verifyClaims(root);
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      if (name === "derive_claims") {
        const { deriveClaims } = await import("../claims/index.js");
        const result = await deriveClaims(root);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      if (name === "read_knowledge") {
        const kbDir = path.join(root, ".engineering-intelligence", "knowledge-base");
        if (typeof args.file === "string" && args.file) {
          const filePath = path.join(kbDir, args.file);
          try {
            const content = await readFileFn(filePath, "utf8");
            return { content: [{ type: "text", text: content }] };
          } catch {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: `.engineering-intelligence/knowledge-base/${args.file} not found` }) }],
              isError: true,
            };
          }
        }
        // List files
        try {
          const entries = await readdir(kbDir, { recursive: true });
          const files = (entries as string[]).filter((e) => e.endsWith(".md") || e.endsWith(".json"));
          return { content: [{ type: "text", text: JSON.stringify({ files }) }] };
        } catch {
          return { content: [{ type: "text", text: JSON.stringify({ files: [], note: ".engineering-intelligence/knowledge-base/ not found. Run /initialize-engineering-intelligence first." }) }] };
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
