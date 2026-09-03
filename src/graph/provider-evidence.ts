import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProjectFilePolicy } from "../project-files/index.js";
import { GRAPHIFY_GRAPH_PATH, GRAPHIFY_RUN_PATH, graphifyContentHash, type GraphifyRunManifest } from "../providers/graphify.js";
import type { Confidence, DependencyGraph, GraphEdge, GraphNode } from "./schema.js";

export type TrustState = "fresh" | "stale" | "contested" | "unverifiable" | "missing";

interface RawGraphifyNode {
  id?: unknown;
  label?: unknown;
  type?: unknown;
  kind?: unknown;
  file_type?: unknown;
  source_file?: unknown;
  source_location?: unknown;
  [key: string]: unknown;
}

interface RawGraphifyEdge {
  source?: unknown;
  target?: unknown;
  from?: unknown;
  to?: unknown;
  relation?: unknown;
  type?: unknown;
  confidence?: unknown;
  confidence_score?: unknown;
  source_file?: unknown;
  source_location?: unknown;
  [key: string]: unknown;
}

interface RawGraphifyGraph {
  nodes?: unknown;
  edges?: unknown;
  links?: unknown;
}

export interface GraphifyReconciliationResult {
  graph: DependencyGraph;
  acceptedNodes: number;
  acceptedEdges: number;
  corroboratedEdges: number;
  contestedEdges: number;
  staleEvidence: number;
  rejectedEvidence: number;
  available: boolean;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRelation(value: unknown): string {
  const relation = stringValue(value)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "related_to";
  const aliases: Record<string, string> = {
    call: "calls", imports_from: "imports", import: "imports", contains: "defines", defined_in: "defines",
    depends_on: "imports", uses: "uses", inherits_from: "extends", implements_interface: "implements",
  };
  return aliases[relation] ?? relation;
}

function normalizeConfidence(value: unknown): Confidence {
  const normalized = stringValue(value)?.toUpperCase();
  if (normalized === "EXTRACTED" || normalized === "VERIFIED") return "inferred";
  return "unknown";
}

function evidenceFor(sourceFile?: string, sourceLocation?: string): string[] {
  if (!sourceFile) return [];
  if (!sourceLocation) return [sourceFile];
  const location = sourceLocation.match(/\d+/)?.[0];
  return [location ? `${sourceFile}:${location}` : sourceFile];
}

async function normalizeSourcePath(root: string, providerWorkspace: string, input: unknown): Promise<string | undefined> {
  const raw = stringValue(input);
  if (!raw) return undefined;
  const cleaned = raw.replace(/\\/g, "/");
  let candidate: string;
  if (path.isAbsolute(raw)) {
    const absolute = path.resolve(raw);
    if (absolute === providerWorkspace || absolute.startsWith(`${providerWorkspace}${path.sep}`)) candidate = path.relative(providerWorkspace, absolute);
    else if (absolute === root || absolute.startsWith(`${root}${path.sep}`)) candidate = path.relative(root, absolute);
    else return undefined;
  } else {
    candidate = cleaned.replace(/^\.\//, "");
    const workspaceName = path.basename(providerWorkspace);
    if (candidate.startsWith(`${workspaceName}/`)) candidate = candidate.slice(workspaceName.length + 1);
  }
  const absolute = path.resolve(root, candidate);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return undefined;
  return path.relative(root, absolute).replace(/\\/g, "/");
}

async function currentFileHash(root: string, relative: string): Promise<string | undefined> {
  try { return graphifyContentHash(await readFile(path.join(root, relative))); } catch { return undefined; }
}

function candidateNativeNode(nodes: GraphNode[], sourceFile: string | undefined, label: string): GraphNode | undefined {
  if (!sourceFile) return undefined;
  const samePath = nodes.filter((node) => node.path === sourceFile || node.evidence.some((evidence) => evidence.split(":")[0] === sourceFile));
  return samePath.find((node) => node.kind === "symbol" && (node.label === label || node.label.split(".").pop() === label))
    ?? samePath.find((node) => node.kind === "module");
}

function providerMetadata(manifest: GraphifyRunManifest, trustState: TrustState, raw: Record<string, unknown>, sourceHash?: string): Record<string, unknown> {
  return {
    provider: "graphify",
    providerVersion: manifest.providerVersion,
    sourceCommit: manifest.sourceCommit,
    sourceHash,
    extraction: stringValue(raw.confidence)?.toUpperCase() === "INFERRED" ? "inferred" : "extracted",
    confidenceScore: typeof raw.confidence_score === "number" ? raw.confidence_score : undefined,
    freshness: trustState === "fresh" ? "current" : trustState,
    trustState,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mergeProviderMetadata(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const providers = unique([
    ...(Array.isArray(existing.providers) ? existing.providers.filter((value): value is string => typeof value === "string") : ["native"]),
    "graphify",
  ]);
  return { ...existing, ...incoming, providers, trustState: "fresh", corroborated: true };
}

export async function reconcileGraphifyEvidence(root: string, nativeGraph: DependencyGraph): Promise<GraphifyReconciliationResult> {
  let raw: RawGraphifyGraph;
  let manifest: GraphifyRunManifest;
  try {
    [raw, manifest] = await Promise.all([
      readFile(path.join(root, GRAPHIFY_GRAPH_PATH), "utf8").then((content) => JSON.parse(content) as RawGraphifyGraph),
      readFile(path.join(root, GRAPHIFY_RUN_PATH), "utf8").then((content) => JSON.parse(content) as GraphifyRunManifest),
    ]);
  } catch {
    return { graph: nativeGraph, acceptedNodes: 0, acceptedEdges: 0, corroboratedEdges: 0, contestedEdges: 0, staleEvidence: 0, rejectedEvidence: 0, available: false };
  }
  if (manifest.schemaVersion !== 1 || manifest.provider !== "graphify") {
    return { graph: { ...nativeGraph, unknowns: unique([...nativeGraph.unknowns, "Graphify evidence manifest is invalid and was ignored."]) }, acceptedNodes: 0, acceptedEdges: 0, corroboratedEdges: 0, contestedEdges: 0, staleEvidence: 0, rejectedEvidence: 1, available: true };
  }

  const policy = await ProjectFilePolicy.load(root);
  // Keep both paths in the caller's lexical namespace. On macOS `/var` may
  // resolve to `/private/var`; resolving only one side would make a valid
  // provider-mirror path look external and reject all of its evidence.
  const providerWorkspace = path.resolve(root, ".engineering-intelligence", "providers", "workspace");
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes.filter((value): value is RawGraphifyNode => Boolean(value) && typeof value === "object") : [];
  const rawEdgesValue = Array.isArray(raw.edges) ? raw.edges : Array.isArray(raw.links) ? raw.links : [];
  const rawEdges = rawEdgesValue.filter((value): value is RawGraphifyEdge => Boolean(value) && typeof value === "object");
  const nodes = nativeGraph.nodes.map((node) => ({ ...node, metadata: { ...node.metadata }, evidence: [...node.evidence] }));
  const edges = nativeGraph.edges.map((edge) => ({ ...edge, metadata: { ...edge.metadata }, evidence: [...edge.evidence] }));
  const nativeNodeIds = new Set(nodes.map((node) => node.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeByKey = new Map(edges.map((edge) => [`${edge.from}\u0000${edge.to}\u0000${edge.relation}`, edge]));
  const nativeEdgeKeys = new Set(edgeByKey.keys());
  const edgesByEndpoints = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const endpointKey = `${edge.from}\u0000${edge.to}`;
    const list = edgesByEndpoints.get(endpointKey) ?? [];
    list.push(edge);
    edgesByEndpoints.set(endpointKey, list);
  }

  const nodeMap = new Map<string, { id: string; sourceFile?: string; trustState: TrustState; sourceHash?: string }>();
  let acceptedNodes = 0;
  let acceptedEdges = 0;
  let corroboratedEdges = 0;
  let contestedEdges = 0;
  let staleEvidence = 0;
  let rejectedEvidence = 0;

  for (const rawNode of rawNodes) {
    const rawId = stringValue(rawNode.id);
    if (!rawId) { rejectedEvidence += 1; continue; }
    const label = stringValue(rawNode.label) ?? rawId;
    const sourceFile = await normalizeSourcePath(root, providerWorkspace, rawNode.source_file);
    if (stringValue(rawNode.source_file) && !sourceFile) { rejectedEvidence += 1; continue; }
    if (sourceFile) {
      const decision = await policy.explainExisting(sourceFile);
      if (!decision.included) { rejectedEvidence += 1; continue; }
    }
    const sourceHash = sourceFile ? await currentFileHash(root, sourceFile) : undefined;
    const expectedHash = sourceFile ? manifest.sourceHashes[sourceFile] : undefined;
    const trustState: TrustState = sourceFile && sourceHash && expectedHash && sourceHash === expectedHash ? "fresh" : sourceFile ? "stale" : "unverifiable";
    if (trustState === "stale") staleEvidence += 1;
    const candidate = candidateNativeNode(nodes, sourceFile, label);
    const native = candidate && nativeNodeIds.has(candidate.id) ? candidate : undefined;
    if (native) {
      nodeMap.set(rawId, { id: native.id, sourceFile, trustState, sourceHash });
      if (trustState === "fresh") {
        native.metadata = mergeProviderMetadata(native.metadata, providerMetadata(manifest, trustState, rawNode, sourceHash));
        native.evidence = unique([...native.evidence, ...evidenceFor(sourceFile, stringValue(rawNode.source_location))]);
      }
      continue;
    }
    if (trustState !== "fresh") {
      nodeMap.set(rawId, { id: `graphify:${rawId}`, sourceFile, trustState, sourceHash });
      continue;
    }
    let id = `graphify:${rawId}`;
    let suffix = 1;
    while (nodeIds.has(id)) { suffix += 1; id = `graphify:${rawId}:${suffix}`; }
    const node: GraphNode = {
      id,
      kind: stringValue(rawNode.kind) ?? stringValue(rawNode.type) ?? "provider-symbol",
      label,
      ...(sourceFile ? { path: sourceFile } : {}),
      confidence: normalizeConfidence(rawNode.confidence),
      metadata: providerMetadata(manifest, "fresh", rawNode, sourceHash),
      evidence: evidenceFor(sourceFile, stringValue(rawNode.source_location)),
    };
    nodes.push(node);
    nodeIds.add(id);
    nodeMap.set(rawId, { id, sourceFile, trustState, sourceHash });
    acceptedNodes += 1;
  }

  for (const rawEdge of rawEdges) {
    const source = nodeMap.get(stringValue(rawEdge.source) ?? stringValue(rawEdge.from) ?? "");
    const target = nodeMap.get(stringValue(rawEdge.target) ?? stringValue(rawEdge.to) ?? "");
    if (!source || !target) { rejectedEvidence += 1; continue; }
    if (source.trustState !== "fresh" || target.trustState === "stale") { staleEvidence += 1; continue; }
    const relation = normalizeRelation(rawEdge.relation ?? rawEdge.type);
    const key = `${source.id}\u0000${target.id}\u0000${relation}`;
    const sourceFile = await normalizeSourcePath(root, providerWorkspace, rawEdge.source_file) ?? source.sourceFile;
    if (sourceFile) {
      const decision = await policy.explainExisting(sourceFile);
      if (!decision.included) { rejectedEvidence += 1; continue; }
    }
    const currentHash = sourceFile ? await currentFileHash(root, sourceFile) : source.sourceHash;
    const expectedHash = sourceFile ? manifest.sourceHashes[sourceFile] : undefined;
    if (sourceFile && (!currentHash || !expectedHash || currentHash !== expectedHash)) { staleEvidence += 1; continue; }
    const evidence = evidenceFor(sourceFile, stringValue(rawEdge.source_location));
    const metadata = providerMetadata(manifest, "fresh", rawEdge, currentHash);
    const existing = edgeByKey.get(key);
    if (existing) {
      existing.evidence = unique([...existing.evidence, ...evidence]);
      // Only agreement with an EI-native edge is corroboration. A duplicate
      // Graphify row must never upgrade its own contested/unverifiable edge.
      if (nativeEdgeKeys.has(key)) {
        existing.metadata = mergeProviderMetadata(existing.metadata, metadata);
        corroboratedEdges += 1;
      }
      continue;
    }
    const endpointKey = `${source.id}\u0000${target.id}`;
    const conflicting = edgesByEndpoints.get(endpointKey)?.some((edge) => edge.relation !== relation) ?? false;
    const trustState: TrustState = conflicting ? "contested" : "unverifiable";
    if (conflicting) contestedEdges += 1;
    const edge: GraphEdge = {
      from: source.id,
      to: target.id,
      relation,
      confidence: normalizeConfidence(rawEdge.confidence),
      metadata: { ...metadata, trustState, freshness: "current", corroborated: false },
      evidence,
    };
    edges.push(edge);
    edgeByKey.set(key, edge);
    const endpointEdges = edgesByEndpoints.get(endpointKey) ?? [];
    endpointEdges.push(edge);
    edgesByEndpoints.set(endpointKey, endpointEdges);
    acceptedEdges += 1;
  }

  const notes: string[] = [];
  if (staleEvidence > 0) notes.push(`Graphify evidence excluded as stale: ${staleEvidence} item(s).`);
  if (rejectedEvidence > 0) notes.push(`Graphify evidence rejected as malformed or out of scope: ${rejectedEvidence} item(s).`);
  if (contestedEdges > 0) notes.push(`Graphify evidence marked contested: ${contestedEdges} relationship(s); these cannot support claims.`);
  const graph: DependencyGraph = { ...nativeGraph, nodes, edges, unknowns: unique([...nativeGraph.unknowns, ...notes]) };
  return { graph, acceptedNodes, acceptedEdges, corroboratedEdges, contestedEdges, staleEvidence, rejectedEvidence, available: true };
}
