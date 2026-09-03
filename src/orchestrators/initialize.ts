import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveClaims, verifyClaims } from "../claims/index.js";
import { migrateEiConfig, updateProviderConfig, type ProviderPolicy } from "../config/index.js";
import { checkEvidenceHashes, recordEvidenceHashes } from "../evidence/index.js";
import { buildGraph, loadExistingGraph } from "../graph/index.js";
import { collectProjectFiles, ProjectFilePolicy } from "../project-files/index.js";
import { prepareProviders } from "../providers/manager.js";
import { runCceIndex } from "../providers/cce.js";
import { runGraphifyExtraction } from "../providers/graphify.js";
import type { PrepareProvidersResult } from "../providers/types.js";
import type { ProcessRunner } from "../process/index.js";
import { verifyKnowledge } from "../verify/index.js";
import type { IdeId } from "../types.js";
import { runSetup, type SetupResult } from "./setup.js";

export interface InitializeOptions {
  ides?: IdeId[];
  packageVersion: string;
  policy?: ProviderPolicy;
  offline?: boolean;
  requireProviders?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  force?: boolean;
  expertMode?: boolean;
  providerHome?: string;
  runner?: ProcessRunner;
  promptOverwrite?: (filePath: string) => Promise<boolean>;
  onProgress?: (message: string) => void;
}

export interface InitializationEvidence {
  schemaVersion: 1;
  generatedAt: string;
  source: { root: string; commit?: string; approvedFiles: number; languages: Record<string, number>; manifests: string[] };
  authority: { canonical: string; structuralProvider: string; retrievalProvider: string; sourcePrecedence: string[] };
  providers: PrepareProvidersResult;
  graph: { path: string; nodes: number; edges: number; files: number; graphifyCorroboratedEdges: number; providerOnlyEdges: number; contestedEdges: number; unknowns: string[] };
  claims: { total: number; verified: number; conflicts: number };
  knowledge: { status: "ready" | "degraded" | "awaiting-model-synthesis"; citationDrift: number; staleEvidence: number };
  topology: Array<{ id: string; path?: string; dependents: number }>;
  documentSkeletons: Array<{ file: string; sections: string[]; evidenceQuery: string }>;
}

export interface InitializeResult {
  ok: boolean;
  degraded: boolean;
  setup: SetupResult;
  providers: PrepareProvidersResult;
  graphify: Awaited<ReturnType<typeof runGraphifyExtraction>> | { ok: false; degraded: boolean; message: string };
  cce: Awaited<ReturnType<typeof runCceIndex>> | { ok: false; degraded: boolean; message: string };
  evidencePath?: string;
  generationBriefPath?: string;
  evidence?: InitializationEvidence;
  logs: string[];
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".rb", ".java", ".kt", ".sql"]);
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript/React", ".js": "JavaScript", ".jsx": "JavaScript/React", ".mjs": "JavaScript", ".cjs": "JavaScript",
  ".py": "Python", ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".java": "Java", ".kt": "Kotlin", ".sql": "SQL",
};

async function writeAtomic(location: string, content: string): Promise<void> {
  const temporary = `${location}.tmp-${randomUUID()}`;
  await mkdir(path.dirname(location), { recursive: true });
  await writeFile(temporary, content, "utf8");
  await rename(temporary, location);
}

async function gitHead(root: string, runner?: ProcessRunner): Promise<string | undefined> {
  if (!runner) {
    const { runProcess } = await import("../process/index.js");
    runner = runProcess;
  }
  const result = await runner({ command: "git", args: ["rev-parse", "HEAD"], cwd: root, timeoutMs: 10_000 });
  return result.exitCode === 0 ? result.stdout.trim() || undefined : undefined;
}

function renderGenerationBrief(evidence: InitializationEvidence): string {
  const lines = [
    "# EI knowledge generation brief",
    "",
    "EI owns the canonical knowledge base. Graphify supplied structural evidence only; CCE supplies current source spans only.",
    "Do not copy provider prose into canonical documents. Resolve every material statement against current repository source and record a hash-pinned claim.",
    "",
    `Provider state: ${evidence.providers.degraded ? "degraded with native fallback" : "healthy or intentionally native"}.`,
    `Graph: ${evidence.graph.nodes} nodes, ${evidence.graph.edges} edges; ${evidence.graph.graphifyCorroboratedEdges} Graphify-corroborated; ${evidence.graph.contestedEdges} contested.`,
    `Claims: ${evidence.claims.verified}/${evidence.claims.total} verified.`,
    "",
    "## Required documents",
  ];
  for (const document of evidence.documentSkeletons) {
    lines.push(`- ${document.file}: ${document.sections.join(", ")}. Retrieve: ${document.evidenceQuery}`);
  }
  lines.push("", "## Publication gates", "", "- No stale or missing citation may be stated as current.", "- Contested and provider-only graph edges must be labelled, not promoted to facts.", "- Every material statement must be verified, inferred, contested, or unknown.", "- Run claims derive/verify, evidence-record/check, and strict health before publication.", "");
  return lines.join("\n");
}

function renderBootstrapKnowledge(evidence: InitializationEvidence): Record<string, string> {
  const checked = evidence.generatedAt.slice(0, 10);
  const sourcePath = evidence.topology.find((item) => item.path)?.path;
  const exactCitation = sourcePath ? `\`${sourcePath}:1\`` : undefined;
  const sourceAnnotation = sourcePath ? `(evidence: ${sourcePath})` : "";
  const languages = Object.entries(evidence.source.languages).map(([language, count]) => `${language} (${count})`).join(", ") || "unknown";
  const manifests = evidence.source.manifests.length > 0 ? evidence.source.manifests.map((item) => `\`${item}\``).join(", ") : "none detected";
  const topology = evidence.topology.slice(0, 10).map((item) => `- \`${item.path ?? item.id}\`: ${item.dependents} dependent module(s).`).join("\n") || "- No source-module topology was extracted.";
  const providerLines = evidence.providers.statuses.map((provider) => `- ${provider.displayName}: ${provider.health}; required ${provider.requiredVersion}${provider.detectedVersion ? `, detected ${provider.detectedVersion}` : ""}.`).join("\n");
  const evidenceLine = exactCitation ? `\nHash-pinned bootstrap citation: ${exactCitation}.` : "";
  const header = (title: string) => `# ${title}\n<!-- freshness: last_checked=${checked} -->\n\n`;
  const authority = "Repository source, tests, manifests and Git are ground truth. EI owns canonical knowledge, claims, decisions, memory and its normalized graph. Graphify and CCE are non-canonical evidence providers.";
  return {
    "00-project-overview.md": `${header("Project Overview")}${authority}\n\n- Approved files discovered: ${evidence.source.approvedFiles}.\n- Languages: ${languages}.\n- Manifests: ${manifests}.\n- Source commit: ${evidence.source.commit ? `\`${evidence.source.commit}\`` : "unavailable; freshness is source-hash based"}.\n\nThis is a deterministic publishable baseline. The installed initialization workflow may enrich it only with verified current evidence. ${sourceAnnotation}${evidenceLine}\n\n## Unknowns\n\n- Product intent and business terminology require model/user synthesis when they are not explicit in source.\n`,
    "01-repository-structure.md": `${header("Repository Structure")}EI's shared project-file policy selected ${evidence.source.approvedFiles} file(s) and the canonical graph scanned ${evidence.graph.files} source file(s). Generated output, provider caches, secrets, vendored dependencies and path escapes are excluded before graphing or retrieval. ${sourceAnnotation}${evidenceLine}\n\n## Highest-connectivity modules\n\n${topology}\n\n## Unknowns\n\n- Ownership boundaries not encoded in source or Git remain unknown.\n`,
    "02-architecture.md": `${header("Architecture")}The EI-owned normalized dependency graph contains ${evidence.graph.nodes} nodes and ${evidence.graph.edges} edges. ${evidence.graph.graphifyCorroboratedEdges} edge(s) were corroborated by Graphify; ${evidence.graph.providerOnlyEdges} are provider-only evidence; ${evidence.graph.contestedEdges} are contested and must not be promoted to fact. ${sourceAnnotation}${evidenceLine}\n\n## Authority\n\n${authority}\n\n## Structural neighborhood\n\n${topology}\n\n## Unknowns\n\n${evidence.graph.unknowns.length > 0 ? evidence.graph.unknowns.map((item) => `- ${item}`).join("\n") : "- No graph-reported unknowns; runtime-only behavior still requires targeted verification."}\n`,
    "03-runtime-flow.md": `${header("Runtime Flow")}Initialization follows: approved source discovery, provider health/install, Graphify code-only extraction when healthy, native EI graph extraction and reconciliation, CCE indexing inside the approved scope, claim derivation, and publication checks. Graphify failure falls back to EI's native graph; CCE failure falls back to EI's scoped native retrieval. ${sourceAnnotation}${evidenceLine}\n\nRuntime flows specific to the target application are deliberately not invented by the deterministic bootstrap. They must be added from verified source spans and labeled inferred when structural evidence is incomplete.\n`,
    "15-validation-report.md": `${header("Validation Report")}- Claims: ${evidence.claims.verified}/${evidence.claims.total} verified; ${evidence.claims.conflicts} conflicts.\n- Provider mode: ${evidence.providers.policy}; degraded=${evidence.providers.degraded}.\n- Graph: ${evidence.graph.nodes} nodes, ${evidence.graph.edges} edges, ${evidence.graph.contestedEdges} contested.\n- Knowledge authority: EI; provider output is evidence only.\n\n## Provider health\n\n${providerLines}\n\n## Publication rule\n\nOnly verified facts are published as current. Inferences, contested relationships and unknowns retain those labels. ${sourceAnnotation}${evidenceLine}\n`,
  };
}

async function ensureBootstrapKnowledge(root: string, evidence: InitializationEvidence): Promise<string[]> {
  const written: string[] = [];
  for (const [name, markdown] of Object.entries(renderBootstrapKnowledge(evidence))) {
    const relative = path.join(".engineering-intelligence", "knowledge-base", name);
    try {
      await readFile(path.join(root, relative), "utf8");
    } catch {
      await writeAtomic(path.join(root, relative), markdown);
      written.push(relative.replace(/\\/g, "/"));
    }
  }
  return written;
}

async function buildInitializationEvidence(root: string, providers: PrepareProvidersResult, graphResult: Awaited<ReturnType<typeof buildGraph>>, runner?: ProcessRunner): Promise<InitializationEvidence> {
  const policy = await ProjectFilePolicy.load(root);
  const sourceFiles = await collectProjectFiles(policy, { accept: (relative) => SOURCE_EXTENSIONS.has(path.extname(relative).toLowerCase()) });
  const allFiles = await collectProjectFiles(policy);
  const languages: Record<string, number> = {};
  for (const file of sourceFiles) {
    const language = LANGUAGE_BY_EXTENSION[path.extname(file).toLowerCase()] ?? path.extname(file).slice(1);
    languages[language] = (languages[language] ?? 0) + 1;
  }
  const manifestNames = new Set(["package.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml", "Gemfile", "pom.xml", "build.gradle", "build.gradle.kts"]);
  const manifests = allFiles.map((file) => path.relative(root, file).replace(/\\/g, "/")).filter((relative) => manifestNames.has(path.basename(relative)));
  const graph = await loadExistingGraph(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"));
  const incoming = new Map<string, number>();
  for (const edge of graph?.edges ?? []) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  const topology = (graph?.nodes ?? []).filter((node) => node.kind === "module").map((node) => ({ id: node.id, path: node.path, dependents: incoming.get(node.id) ?? 0 })).sort((a, b) => b.dependents - a.dependents || a.id.localeCompare(b.id)).slice(0, 20);
  const corroborated = (graph?.edges ?? []).filter((edge) => edge.metadata.corroborated === true).length;
  const providerOnly = (graph?.edges ?? []).filter((edge) => edge.metadata.provider === "graphify" && edge.metadata.corroborated !== true).length;
  const contested = (graph?.edges ?? []).filter((edge) => edge.metadata.trustState === "contested").length;
  const [claims, knowledge, citationEvidence] = await Promise.all([verifyClaims(root), verifyKnowledge(root), checkEvidenceHashes(root)]);
  let knowledgeStatus: InitializationEvidence["knowledge"]["status"] = "awaiting-model-synthesis";
  if (knowledge.filesScanned > 0) knowledgeStatus = knowledge.drift === 0 && citationEvidence.checked > 0 && citationEvidence.stale === 0 ? "ready" : "degraded";
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: { root: path.resolve(root), commit: await gitHead(root, runner), approvedFiles: allFiles.length, languages, manifests },
    authority: {
      canonical: "EI knowledge base, claims, ADRs, memory, and normalized graph",
      structuralProvider: "Graphify code-only evidence; never canonical prose",
      retrievalProvider: "CCE current source spans inside EI-approved scope; never durable memory",
      sourcePrecedence: ["repository source/tests/manifests/Git", "verified EI knowledge and claims", "fresh corroborated provider evidence", "inferred/contested/unknown"],
    },
    providers,
    graph: { path: graphResult.graphPath, nodes: graph?.nodes.length ?? 0, edges: graph?.edges.length ?? 0, files: graphResult.fileCount, graphifyCorroboratedEdges: corroborated, providerOnlyEdges: providerOnly, contestedEdges: contested, unknowns: graph?.unknowns ?? [] },
    claims: { total: claims.total, verified: claims.verified, conflicts: claims.refuted + claims.stale + claims.missing },
    knowledge: { status: knowledgeStatus, citationDrift: knowledge.drift, staleEvidence: citationEvidence.stale },
    topology,
    documentSkeletons: [
      { file: "00-project-overview.md", sections: ["purpose", "languages", "entry points", "boundaries", "unknowns"], evidenceQuery: "project entry points and primary runtime" },
      { file: "01-repository-structure.md", sections: ["approved roots", "modules", "tests", "generated exclusions"], evidenceQuery: "repository layout and module ownership" },
      { file: "02-architecture.md", sections: ["components", "dependencies", "call paths", "external systems", "contested edges"], evidenceQuery: "architecture components and dependency paths" },
      { file: "03-runtime-flow.md", sections: ["startup", "request flow", "background work", "failure paths"], evidenceQuery: "runtime entry points and major call flows" },
      { file: "15-validation-report.md", sections: ["sources", "claims", "confidence", "unknowns", "freshness"], evidenceQuery: "tests, gates, and evidence health" },
    ],
  };
}

export async function runInitialization(root: string, options: InitializeOptions): Promise<InitializeResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    options.onProgress?.(msg);
  };
  const setup = await runSetup(root, { ides: options.ides, packageVersion: options.packageVersion, dryRun: options.dryRun, force: options.force, promptOverwrite: options.promptOverwrite, deferIntelligenceBuild: true });
  for (const line of setup.logs) log(line);
  if (!options.dryRun) {
    const migration = await migrateEiConfig(root);
    log(migration.changed ? `Configuration migrated to schema ${migration.config.schemaVersion}.` : `Configuration schema ${migration.config.schemaVersion} is current.`);
    const providerPatch = {
      ...(options.policy ? { policy: options.policy } : {}),
      ...(options.offline ? { offline: true } : {}),
      ...(options.requireProviders !== undefined ? { requireProviders: options.requireProviders } : {}),
      ...(options.expertMode ? { exposeRawMcp: true } : {}),
    };
    if (Object.keys(providerPatch).length > 0) {
      await updateProviderConfig(root, providerPatch);
      log("Initialization provider policy persisted in the versioned EI configuration.");
    }
  }
  const providers = await prepareProviders(root, {
    policy: options.policy ?? "full",
    offline: options.offline,
    requireProviders: options.requireProviders ?? (options.policy !== "native"),
    installMissing: true,
    dryRun: options.dryRun,
    expertMode: options.expertMode,
    providerHome: options.providerHome,
    runner: options.runner,
    onProgress: options.onProgress,
  });
  for (const status of providers.statuses) log(`${status.displayName}: ${status.health} — ${status.message}`);
  if (options.dryRun) {
    return { ok: providers.ok && setup.installOp.conflicts === 0, degraded: providers.degraded, setup, providers, graphify: { ok: false, degraded: false, message: "Dry run: Graphify extraction not executed." }, cce: { ok: false, degraded: false, message: "Dry run: CCE indexing not executed." }, logs };
  }

  const graphifyStatus = providers.statuses.find((status) => status.name === "graphify");
  const graphify = graphifyStatus?.health === "healthy"
    ? await runGraphifyExtraction(root, { runner: options.runner, providerHome: options.providerHome, onProgress: options.onProgress })
    : { ok: false as const, degraded: providers.policy !== "native", message: "Graphify unavailable or disabled; native EI graph extraction used." };
  log(graphify.message);
  const graph = await buildGraph(root, { providerEvidence: graphify.ok });
  setup.graph = { nodeCount: graph.nodeCount, edgeCount: graph.edgeCount, fileCount: graph.fileCount };
  log(`Canonical EI graph built: ${graph.nodeCount} nodes, ${graph.edgeCount} edges (${graph.fileCount} files).`);

  const cceStatus = providers.statuses.find((status) => status.name === "cce");
  const cce = cceStatus?.health === "healthy"
    ? await runCceIndex(root, { runner: options.runner, providerHome: options.providerHome, onProgress: options.onProgress })
    : { ok: false as const, degraded: providers.policy !== "native", message: "CCE unavailable or disabled; native EI scoped retrieval used." };
  log(cce.message);
  const derived = await deriveClaims(root);
  log(`Derived claim baseline: ${derived.total} claim(s), ${derived.added} added, ${derived.removed} removed.`);

  let evidence = await buildInitializationEvidence(root, providers, graph, options.runner);
  const bootstrapDocuments = await ensureBootstrapKnowledge(root, evidence);
  if (bootstrapDocuments.length > 0) log(`Published ${bootstrapDocuments.length} deterministic EI knowledge document(s).`);
  const snapshot = await recordEvidenceHashes(root);
  log(`Recorded ${snapshot.hashes.length} hash-pinned knowledge citation(s).`);
  evidence = await buildInitializationEvidence(root, providers, graph, options.runner);
  const evidencePath = ".engineering-intelligence/context/initialization-evidence.json";
  const generationBriefPath = ".engineering-intelligence/context/KNOWLEDGE-GENERATION-BRIEF.md";
  await writeAtomic(path.join(root, evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeAtomic(path.join(root, generationBriefPath), renderGenerationBrief(evidence));
  log(`Initialization evidence: ${evidencePath}`);
  log(`Knowledge generation brief: ${generationBriefPath}`);
  const degraded = providers.degraded || graphify.degraded || cce.degraded || evidence.knowledge.status === "degraded";
  const requiredProviderRunFailed = (options.requireProviders ?? (providers.policy !== "native")) === true && providers.policy !== "native" && (!graphify.ok || !cce.ok);
  return { ok: providers.ok && setup.installOp.conflicts === 0 && !requiredProviderRunFailed, degraded, setup, providers, graphify, cce, evidencePath, generationBriefPath, evidence, logs };
}
