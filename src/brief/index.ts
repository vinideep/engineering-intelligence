import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { DependencyGraph } from "../graph/schema.js";

// Load the graph file directly (no import from graph/index.js) to keep this
// module free of a circular dependency — buildGraph calls generateBrief.
async function loadGraphFile(root: string): Promise<DependencyGraph | null> {
  try {
    const content = await readFile(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"), "utf8");
    return JSON.parse(content) as DependencyGraph;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Repo Brief — a deterministic ~500-token orientation digest.
//
// The biggest token cost of "just typing the requirement into chat" is the
// agent's orientation phase: it opens 10-15 files to learn the shape of the repo
// before it can act. This digest replaces that with one cheap read — computed
// from the graph + manifests, no LLM. It answers: what languages, where are the
// entry points, what does everything depend on, where are the tests, what's hot.
// ---------------------------------------------------------------------------

const EXT_LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", mjs: "JavaScript",
  cjs: "JavaScript", py: "Python", go: "Go", rs: "Rust", rb: "Ruby",
  java: "Java", kt: "Kotlin",
};

function briefPath(root: string): string {
  return path.join(root, ".engineering-intelligence", "context", "repo-brief.md");
}

function extOf(evidenceFile: string | undefined): string | null {
  if (!evidenceFile) return null;
  const m = evidenceFile.split(":")[0].match(/\.([a-z]+)$/i);
  return m ? m[1].toLowerCase() : null;
}

async function readPackageJson(root: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface BriefResult {
  path: string;
  markdown: string;
}

// Generate the brief from the on-disk graph. If no graph exists yet, returns a
// minimal placeholder so callers never crash.
export async function generateBrief(root: string): Promise<BriefResult> {
  const graph = await loadGraphFile(root);
  const pkg = await readPackageJson(root);
  const markdown = renderBrief(root, graph, pkg);

  const outPath = briefPath(root);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, "utf8");
  return { path: path.relative(root, outPath), markdown };
}

export async function readBrief(root: string): Promise<string | null> {
  try {
    return await readFile(briefPath(root), "utf8");
  } catch {
    return null;
  }
}

function renderBrief(root: string, graph: DependencyGraph | null, pkg: Record<string, unknown> | null): string {
  const scope = graph?.scope ?? path.basename(root);
  if (!graph) {
    return `# Repo Brief — ${scope}\n\n_No dependency graph yet. Run \`engineering-intelligence setup\` (or \`map\`) to generate one._\n`;
  }

  const modules = graph.nodes.filter((n) => n.kind === "module");
  const symbols = graph.nodes.filter((n) => n.kind === "symbol");
  const packages = graph.nodes.filter((n) => n.kind === "package");

  // Languages by module file extension (from evidence).
  const langCount = new Map<string, number>();
  for (const m of modules) {
    const ext = extOf(m.evidence[0]) ?? extOf(m.path);
    const lang = ext ? EXT_LANG[ext] : undefined;
    if (lang) langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
  }
  const langs = [...langCount.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} (${n})`);

  // Most depended-on modules (in-degree over `imports` edges).
  const inDegree = new Map<string, number>();
  for (const e of graph.edges) {
    if (e.relation !== "imports") continue;
    if (!e.to.startsWith("module:")) continue;
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }
  const topModules = [...inDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, deg]) => `\`${id.replace(/^module:/, "")}\` (${deg} importers)`);

  // Hotspots by churn.
  const hotspots = modules
    .filter((m) => typeof m.metadata.churn === "number")
    .sort((a, b) => (b.metadata.churn as number) - (a.metadata.churn as number))
    .slice(0, 8)
    .map((m) => `\`${m.path ?? m.id.replace(/^module:/, "")}\` (${m.metadata.churn} changes/90d)`);

  // Test layout.
  const testNodes = graph.nodes.filter((n) => n.metadata.isTest === true && n.kind === "module");
  const testDirs = new Map<string, number>();
  for (const t of testNodes) {
    const dir = (t.path ?? t.id.replace(/^module:/, "")).split("/").slice(0, -1).join("/") || ".";
    testDirs.set(dir, (testDirs.get(dir) ?? 0) + 1);
  }
  const testLayout = [...testDirs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, n]) => `\`${d}/\` (${n})`);

  // Entry points from package.json bin/main.
  const entries: string[] = [];
  if (pkg) {
    if (typeof pkg.main === "string") entries.push(`main: \`${pkg.main}\``);
    if (pkg.bin && typeof pkg.bin === "object") {
      for (const [name, p] of Object.entries(pkg.bin as Record<string, string>)) entries.push(`bin \`${name}\`: \`${p}\``);
    } else if (typeof pkg.bin === "string") {
      entries.push(`bin: \`${pkg.bin}\``);
    }
  }

  const lines: string[] = [];
  lines.push(`# Repo Brief — ${scope}`);
  lines.push("");
  lines.push("<!-- Generated deterministically from the dependency graph. ~500-token orientation digest. -->");
  lines.push("");
  lines.push(`- **Scale**: ${modules.length} source modules, ${symbols.length} symbols, ${packages.length} external packages, ${graph.edges.length} edges.`);
  if (langs.length) lines.push(`- **Languages**: ${langs.join(", ")}.`);
  if (entries.length) lines.push(`- **Entry points**: ${entries.join("; ")}.`);
  lines.push("");
  if (topModules.length) {
    lines.push("## Most depended-on modules");
    lines.push("These are the load-bearing files — changes here ripple widest.");
    for (const m of topModules) lines.push(`- ${m}`);
    lines.push("");
  }
  if (hotspots.length) {
    lines.push("## Hotspots (highest churn, last 90 days)");
    for (const h of hotspots) lines.push(`- ${h}`);
    lines.push("");
  }
  if (testLayout.length) {
    lines.push(`## Tests`);
    lines.push(`${testNodes.length} test module(s), concentrated in: ${testLayout.join(", ")}.`);
    lines.push("");
  }
  lines.push("---");
  lines.push("_Query deeper: `analyze_impact <file>` (what breaks), `who_calls <fn>` (callers), `find_symbol <name>` (locate). Graph auto-refreshes before each query._");
  lines.push("");
  return lines.join("\n");
}
