#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildGraph, analyzeImpact, loadExistingGraph, ensureFreshGraph, findSymbol, whoCalls } from "../graph/index.js";
import { preflight, postflight } from "../flight/index.js";
import { generateBrief, readBrief } from "../brief/index.js";
import { shape, terseNode, terseEdge, packRows } from "./shaper.js";
import { readFile as readFileFn } from "node:fs/promises";

// Resolve the token budget for a tool call. Precedence:
//   explicit args.budget (0 = unlimited) → project config → built-in fallback.
// Answer fields are never truncated regardless (see mustKeep hints); the budget
// only bounds exploration fields.
function budgetOf(args: Record<string, unknown>, config: Record<string, number>, tool: string, fallback: number): number {
  if (typeof args.budget === "number") return args.budget; // includes 0 = unlimited
  if (typeof config[tool] === "number") return config[tool];
  return fallback;
}

// Optional per-project budget overrides: .engineering-intelligence/config.json
// { "tokenBudgets": { "analyze_impact": 3000, ... } }
async function loadBudgetConfig(root: string): Promise<Record<string, number>> {
  try {
    const raw = await readFileFn(path.join(root, ".engineering-intelligence", "config.json"), "utf8");
    const parsed = JSON.parse(raw) as { tokenBudgets?: Record<string, number> };
    return parsed.tokenBudgets && typeof parsed.tokenBudgets === "object" ? parsed.tokenBudgets : {};
  } catch {
    return {};
  }
}

const budgetProp = { budget: { type: "number", description: "Optional token budget for the response. Exploration fields are capped to fit (answer fields are never truncated); pass 0 for unlimited." } };

const TOOLS = [
  {
    name: "get_brief",
    description:
      "Get a ~500-token orientation digest of the repo (languages, entry points, most-depended-on modules, hotspots, test layout) — computed from the graph, not an LLM. Read this FIRST instead of opening many files to understand the codebase; it's the cheapest way to orient.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
      },
    },
  },
  {
    name: "map_dependencies",
    description:
      "Build/refresh the deterministic dependency + call graph on disk. Returns a small SUMMARY only (counts + path) — the full graph is queried lazily via get_graph, analyze_impact, find_symbol, and who_calls, so it never floods the context.",
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
      "Query the dependency graph with filters — returns a COMPACT, capped view, not the whole file. Filter with `pattern` (regex over node ids/labels or edge endpoints), `kind` (module/symbol/package), `relation` (imports/defines/calls), and `limit`. Over-budget results are truncated with a `truncated` marker telling you how to expand. Use `full:true` only when you truly need the raw graph.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        type: { type: "string", enum: ["dependency", "service", "runtime", "business-flow", "data-flow"], description: "Graph type. Defaults to 'dependency'." },
        pattern: { type: "string", description: "Regex to match node id/label or edge from/to. Omit to match all." },
        kind: { type: "string", description: "Filter nodes by kind (module, symbol, package)." },
        relation: { type: "string", description: "Filter edges by relation (imports, defines, calls)." },
        limit: { type: "number", description: "Max nodes and max edges to return (default 100)." },
        full: { type: "boolean", description: "Return the raw, unfiltered graph (large). Default false." },
        ...budgetProp,
      },
    },
  },
  {
    name: "analyze_impact",
    description:
      "What breaks if I change these files? Traverses the dependency + call graph and returns impacted modules/functions (`direct`/`indirect`), `details`, `testsToRun`, and `riskNotes`. The ANSWER fields (`direct`, `testsToRun`, `riskNotes`) are never truncated; only exploration (`indirect`, `details`) is capped, ranked most-relevant-first, with a `truncated` marker. `details` is packed as `{cols,rows}` (lossless: each row aligns to cols). Auto-refreshes the graph first.",
    inputSchema: {
      type: "object" as const,
      required: ["changedFiles"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        changedFiles: { type: "array", items: { type: "string" }, description: "Changed file paths (relative or absolute)." },
        ...budgetProp,
      },
    },
  },
  {
    name: "find_symbol",
    description:
      "Locate function/class/method definitions by name. Returns matching symbol nodes with file:line evidence. Use when you know a name but not where it lives.",
    inputSchema: {
      type: "object" as const,
      required: ["name"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        name: { type: "string", description: "Symbol name (e.g. \"buildGraph\" or \"ClassName.method\")." },
        ...budgetProp,
      },
    },
  },
  {
    name: "who_calls",
    description:
      "What calls this function? Reverse-walks the call graph to find every caller of the named symbol, with call-site file:line evidence and confidence. The `callers` list is the answer and is never truncated; it is packed as `{cols,rows}` (lossless). transitive=true includes indirect callers. Auto-refreshes first.",
    inputSchema: {
      type: "object" as const,
      required: ["name"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        name: { type: "string", description: "Symbol name whose callers to find." },
        transitive: { type: "boolean", description: "If true, include indirect (transitive) callers." },
        ...budgetProp,
      },
    },
  },
  {
    name: "preflight",
    description:
      "Before editing: declare intent + target files. Returns a flight id and the predicted blast radius from the graph. Call postflight afterwards to audit that your changes stayed in scope.",
    inputSchema: {
      type: "object" as const,
      required: ["intent"],
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        intent: { type: "string", description: "One-line summary of the change you are about to make." },
        files: { type: "array", items: { type: "string" }, description: "The files you intend to modify." },
        ...budgetProp,
      },
    },
  },
  {
    name: "postflight",
    description:
      "After editing: audit actual changes vs. the preflight declaration. Flags files changed that were neither declared nor in the predicted radius (out-of-bounds), with a clean/flagged verdict. Omit id to close the latest open flight.",
    inputSchema: {
      type: "object" as const,
      properties: {
        root: { type: "string", description: "Absolute path to the repository root. Defaults to cwd." },
        id: { type: "string", description: "Flight id from preflight. Omit to use the latest open flight." },
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
      "List or read files from the knowledge-base/ directory. Omit 'file' to list all knowledge files (the repo brief is listed first). Provide 'file' to read its contents.",
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
    const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });
    const cfg = await loadBudgetConfig(root);

    try {
      if (name === "get_brief") {
        await ensureFreshGraph(root);
        let brief = await readBrief(root);
        if (!brief) brief = (await generateBrief(root)).markdown;
        return text(brief);
      }

      if (name === "map_dependencies") {
        const update = args.update === true;
        const files = Array.isArray(args.files) ? (args.files as string[]) : undefined;
        const result = await buildGraph(root, { update, files, write: true });
        return text(shape({
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          fileCount: result.fileCount,
          wasIncremental: result.wasIncremental,
          graphPath: result.graphPath,
          note: "Graph written to disk. Query it with get_graph / analyze_impact / who_calls / find_symbol.",
        }));
      }

      if (name === "get_graph") {
        const type = typeof args.type === "string" ? args.type : "dependency";
        if (type === "dependency") await ensureFreshGraph(root);
        const graphPath = path.join(root, ".engineering-intelligence", "graph", `${type}-graph.json`);
        const graph = await loadExistingGraph(graphPath);
        if (!graph) return text(JSON.stringify({ error: `No ${type}-graph.json found. Run map_dependencies first.` }), true);

        if (args.full === true) {
          return text(shape({ scope: graph.scope, nodes: graph.nodes, edges: graph.edges, unknowns: graph.unknowns }, { budget: budgetOf(args, cfg, "get_graph_full", 100_000) }));
        }

        const re = safeRegex(typeof args.pattern === "string" ? args.pattern : undefined);
        const kind = typeof args.kind === "string" ? args.kind : undefined;
        const relation = typeof args.relation === "string" ? args.relation : undefined;
        const limit = typeof args.limit === "number" && args.limit > 0 ? args.limit : 100;

        const nodes = graph.nodes
          .filter((n) => (kind ? n.kind === kind : true) && (re ? re.test(n.id) || re.test(n.label) : true))
          .slice(0, limit)
          .map(terseNode);
        const edges = graph.edges
          .filter((e) => (relation ? e.relation === relation : true) && (re ? re.test(e.from) || re.test(e.to) : true))
          .slice(0, limit)
          .map(terseEdge);

        return text(shape(
          { scope: graph.scope, nodeCount: graph.nodes.length, edgeCount: graph.edges.length, nodes, edges },
          { budget: budgetOf(args, cfg, "get_graph", 2500), hints: { nodes: { hint: "get_graph pattern=<id> kind=<kind>", priority: 6 }, edges: { hint: "get_graph relation=<rel> pattern=<id>", priority: 4 } } },
        ));
      }

      if (name === "analyze_impact") {
        const changedFiles = Array.isArray(args.changedFiles) ? (args.changedFiles as string[]) : [];
        if (changedFiles.length === 0) return text(JSON.stringify({ error: "changedFiles is required and must be non-empty" }), true);
        const fresh = await ensureFreshGraph(root);
        const result = await analyzeImpact(root, changedFiles);
        // Pack `details` losslessly (cols/rows) — same data, ~40% fewer tokens.
        const detailsPacked = packRows(
          result.details as unknown as Array<Record<string, unknown>>,
          ["id", "kind", "label", "hop", "evidence", "churn", "isTest"],
        );
        return text(shape(
          { ...result, details: detailsPacked, ...(fresh.staleWarning ? { staleWarning: fresh.staleWarning } : {}) },
          {
            budget: budgetOf(args, cfg, "analyze_impact", 1500),
            hints: {
              // Answer fields — NEVER truncated. A missing dependent is a wrong answer.
              direct: { hint: "get_graph pattern=<id>", mustKeep: true },
              testsToRun: { hint: "run these test files", mustKeep: true },
              riskNotes: { mustKeep: true },
              // Exploration fields — trimmable, ranked most-relevant-first upstream.
              details: { hint: "get_graph pattern=<id> (packed: {cols,rows})", priority: 7 },
              indirect: { hint: "get_graph pattern=<id>", priority: 3 },
              unknowns: { priority: 2 },
            },
          },
        ));
      }

      if (name === "find_symbol") {
        const symName = typeof args.name === "string" ? args.name : "";
        if (!symName) return text(JSON.stringify({ error: "name is required" }), true);
        const fresh = await ensureFreshGraph(root);
        const matches = await findSymbol(root, symName);
        return text(shape(
          { matches, ...(fresh.staleWarning ? { staleWarning: fresh.staleWarning } : {}) },
          { budget: budgetOf(args, cfg, "find_symbol", 1500), hints: { matches: { hint: "who_calls <name>", mustKeep: true } } },
        ));
      }

      if (name === "who_calls") {
        const symName = typeof args.name === "string" ? args.name : "";
        if (!symName) return text(JSON.stringify({ error: "name is required" }), true);
        const transitive = args.transitive === true;
        const fresh = await ensureFreshGraph(root);
        const result = await whoCalls(root, symName, { transitive });
        // Pack callers losslessly. callers/matched are the ANSWER — never truncated.
        const callersPacked = packRows(
          result.callers as unknown as Array<Record<string, unknown>>,
          ["id", "label", "kind", "confidence", "evidence", "path"],
        );
        return text(shape(
          { ...result, callers: callersPacked, ...(fresh.staleWarning ? { staleWarning: fresh.staleWarning } : {}) },
          { budget: budgetOf(args, cfg, "who_calls", 1500), hints: { callers: { hint: "who_calls <caller> transitive=true (packed: {cols,rows})", mustKeep: true }, matched: { hint: "find_symbol <name>", mustKeep: true } } },
        ));
      }

      if (name === "preflight") {
        const intent = typeof args.intent === "string" ? args.intent : "";
        if (!intent) return text(JSON.stringify({ error: "intent is required" }), true);
        const files = Array.isArray(args.files) ? (args.files as string[]) : undefined;
        await ensureFreshGraph(root);
        const record = await preflight(root, { intent, files });
        return text(shape(record as unknown as Record<string, unknown>, {
          budget: budgetOf(args, cfg, "preflight", 1500),
          hints: { declaredFiles: { mustKeep: true } },
        }));
      }

      if (name === "postflight") {
        const id = typeof args.id === "string" ? args.id : undefined;
        const result = await postflight(root, { id });
        if ("error" in result) return text(JSON.stringify(result), true);
        // The audit verdict + out-of-bounds list is the answer — never truncate.
        return text(shape(
          { id: result.record.id, verdict: result.report.verdict, report: result.report },
          { budget: budgetOf(args, cfg, "postflight", 1500), hints: { report: { mustKeep: true } } },
        ));
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
            return text(await readFileFn(filePath, "utf8"));
          } catch {
            return text(JSON.stringify({ error: `.engineering-intelligence/knowledge-base/${args.file} not found` }), true);
          }
        }
        try {
          const entries = await readdir(kbDir, { recursive: true });
          const files = (entries as string[]).filter((e) => e.endsWith(".md") || e.endsWith(".json"));
          return text(shape({ brief: "call get_brief for a ~500-token repo orientation", files }));
        } catch {
          return text(JSON.stringify({ files: [], note: "knowledge-base/ not found. Run setup or /initialize-engineering-intelligence first." }));
        }
      }

      return text(JSON.stringify({ error: `Unknown tool: ${name}` }), true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return text(JSON.stringify({ error: message }), true);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
