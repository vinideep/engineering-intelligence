#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildGraph, analyzeImpact, loadExistingGraph, ensureFreshGraph, findSymbol, whoCalls } from "../graph/index.js";
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
      "Given a list of changed files, traverse the dependency + call graph and return what breaks: modules and functions that directly or indirectly depend on them. Returns `direct`/`indirect` node ids, `details` (each impacted node with kind/label/evidence file:line/churn), `testsToRun` (test files that should be re-run), and `riskNotes` (high-churn warnings). The graph is auto-refreshed against the working tree before answering.",
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
    name: "find_symbol",
    description:
      "Locate function/class/method definitions by name. Returns matching symbol nodes with their file:line evidence. Use when you know a function name but not where it lives.",
    inputSchema: {
      type: "object" as const,
      required: ["name"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        name: { type: "string", description: "Symbol name to find (e.g. \"buildGraph\" or \"ClassName.method\")." },
      },
    },
  },
  {
    name: "who_calls",
    description:
      "Answer \"what calls this function?\" — reverse-walks the call graph to find every caller of the named symbol, with call-site file:line evidence and confidence. Set transitive=true to include indirect callers. The graph is auto-refreshed before answering.",
    inputSchema: {
      type: "object" as const,
      required: ["name"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        name: { type: "string", description: "Symbol name whose callers to find." },
        transitive: { type: "boolean", description: "If true, include indirect (transitive) callers." },
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

export async function startMcpServer(projectRoot: string): Promise<void> {
  const server = new Server(
    { name: "engineering-intelligence", version: "2.2.0" },
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
        if (type === "dependency") await ensureFreshGraph(root);
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
        const fresh = await ensureFreshGraph(root);
        const result = await analyzeImpact(root, changedFiles);
        const payload = fresh.staleWarning ? { ...result, staleWarning: fresh.staleWarning } : result;
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      }

      if (name === "find_symbol") {
        const symName = typeof args.name === "string" ? args.name : "";
        if (!symName) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "name is required" }) }], isError: true };
        }
        const fresh = await ensureFreshGraph(root);
        const matches = await findSymbol(root, symName);
        const payload = { matches, ...(fresh.staleWarning ? { staleWarning: fresh.staleWarning } : {}) };
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      }

      if (name === "who_calls") {
        const symName = typeof args.name === "string" ? args.name : "";
        if (!symName) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "name is required" }) }], isError: true };
        }
        const transitive = args.transitive === true;
        const fresh = await ensureFreshGraph(root);
        const result = await whoCalls(root, symName, { transitive });
        const payload = fresh.staleWarning ? { ...result, staleWarning: fresh.staleWarning } : result;
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
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
