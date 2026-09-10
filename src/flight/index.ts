import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { analyzeImpact } from "../graph/index.js";
import { runProcessSync } from "../process/index.js";

// ---------------------------------------------------------------------------
// The Agent Flight Recorder — accountability for AI code changes.
//
// Before an agent edits, it declares intent + target files (`preflight`). We
// compute the predicted blast radius from the dependency + call graph and take
// a baseline snapshot of the working tree. After the edit (`postflight`), we
// diff what actually changed against that prediction and flag anything that
// landed outside the declared scope. Deterministic — the graph does the
// reasoning, not an LLM judging an LLM.
// ---------------------------------------------------------------------------

export interface PredictedRadius {
  direct: string[]; // impacted node ids (first hop)
  indirect: string[]; // impacted node ids (transitive)
  files: string[]; // declared files + dependent files expected to be in scope
}

export interface FlightReport {
  actualChanged: string[]; // files changed since preflight (attributable to this flight)
  declaredUntouched: string[]; // declared files that were NOT changed
  inBounds: string[]; // changed files that were declared or predicted
  outOfBounds: string[]; // changed files that were neither
  verdict: "clean" | "flagged";
}

export interface FlightFileSnapshot {
  path: string;
  exists: boolean;
  content?: string;
}

export interface FlightRecord {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  closedAt?: string;
  intent: string;
  declaredFiles: string[];
  baselineCommit: string | null;
  baselineDirty: string[]; // files already modified at preflight (excluded from attribution)
  predictedRadius: PredictedRadius;
  status: "open" | "closed";
  report?: FlightReport;
  snapshots?: Record<string, FlightFileSnapshot>;
}

const SOURCE_EXT_RE = /\.(ts|tsx|js|mjs|cjs|py|go|rs|rb|java|kt)$/;

function flightDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "flight");
}

function git(root: string, args: string[]): string | null {
  const result = runProcessSync({ command: "git", args, cwd: root, timeoutMs: 15_000 });
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

// Raw (untrimmed) git output — required for `status --porcelain`, whose fixed
// 2-char status column would be corrupted by trimming the leading space.
function gitRaw(root: string, args: string[]): string | null {
  const result = runProcessSync({ command: "git", args, cwd: root, timeoutMs: 15_000 });
  return result.exitCode === 0 ? result.stdout : null;
}

function head(root: string): string | null {
  return git(root, ["rev-parse", "HEAD"]) || null;
}

// Files with uncommitted (working tree + staged) modifications, source only.
function dirtyFiles(root: string): string[] {
  const porcelain = gitRaw(root, ["status", "--porcelain", "-uall"]);
  if (porcelain === null) return [];
  const out: string[] = [];
  for (const line of porcelain.split("\n")) {
    const raw = line.slice(3).trim();
    if (!raw) continue;
    const f = raw.includes(" -> ") ? raw.split(" -> ")[1] : raw;
    if (SOURCE_EXT_RE.test(f)) out.push(f);
  }
  return out;
}

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function fileFromEvidence(ev: string | undefined): string | null {
  if (!ev) return null;
  const f = ev.split(":")[0];
  return f && SOURCE_EXT_RE.test(f) ? norm(f) : null;
}

export interface PreflightOptions {
  intent: string;
  files?: string[];
}

export async function preflight(root: string, options: PreflightOptions): Promise<FlightRecord> {
  const declaredFiles = (options.files ?? []).map(norm);

  // Predict the blast radius from the graph for the declared files.
  const predicted: PredictedRadius = { direct: [], indirect: [], files: [...declaredFiles] };
  if (declaredFiles.length > 0) {
    const impact = await analyzeImpact(root, declaredFiles);
    predicted.direct = impact.direct;
    predicted.indirect = impact.indirect;
    const files = new Set(declaredFiles);
    for (const d of impact.details) {
      const f = fileFromEvidence(d.evidence[0]);
      if (f) files.add(f);
    }
    predicted.files = [...files];
  }

  const baselineDirtyList = dirtyFiles(root);
  const snapshots: Record<string, FlightFileSnapshot> = {};
  const filesToCapture = new Set<string>([...declaredFiles, ...baselineDirtyList]);
  for (const rel of filesToCapture) {
    const full = path.resolve(root, rel);
    if (existsSync(full)) {
      try {
        const content = await readFile(full, "utf8");
        snapshots[rel] = { path: rel, exists: true, content };
      } catch {
        // ignore unreadable/binary
      }
    } else {
      snapshots[rel] = { path: rel, exists: false };
    }
  }

  const id = `flt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const record: FlightRecord = {
    schemaVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    intent: options.intent,
    declaredFiles,
    baselineCommit: head(root),
    baselineDirty: baselineDirtyList,
    predictedRadius: predicted,
    status: "open",
    snapshots,
  };

  const dir = flightDir(root);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export async function restoreFlightSnapshots(
  root: string,
  record: FlightRecord,
  targetFiles?: string[],
): Promise<void> {
  const files = targetFiles ?? Object.keys(record.snapshots ?? {});
  for (const rel of files) {
    const normRel = norm(rel);
    const snap = record.snapshots?.[normRel] ?? record.snapshots?.[rel];
    const full = path.resolve(root, rel);
    if (snap) {
      if (snap.exists && snap.content !== undefined) {
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, snap.content, "utf8");
      } else if (!snap.exists) {
        if (existsSync(full)) {
          try {
            await unlink(full);
          } catch {
            // best effort
          }
        }
      }
    } else {
      const isDirtyAtBaseline = record.baselineDirty.some((b) => norm(b) === normRel);
      if (!isDirtyAtBaseline) {
        const check = runProcessSync({
          command: "git",
          args: ["ls-files", "--error-unmatch", rel],
          cwd: root,
          timeoutMs: 10_000,
        });
        if (check.exitCode === 0) {
          runProcessSync({
            command: "git",
            args: ["checkout", "HEAD", "--", rel],
            cwd: root,
            timeoutMs: 10_000,
          });
        } else if (existsSync(full)) {
          try {
            await unlink(full);
          } catch {
            // best effort
          }
        }
      }
    }
  }
}

export async function loadFlight(root: string, id: string): Promise<FlightRecord | null> {
  try {
    const content = await readFile(path.join(flightDir(root), `${id}.json`), "utf8");
    return JSON.parse(content) as FlightRecord;
  } catch {
    return null;
  }
}

// Most recently created open flight, for `postflight` with no id.
export async function latestOpenFlight(root: string): Promise<FlightRecord | null> {
  let entries: string[];
  try {
    entries = await readdir(flightDir(root));
  } catch {
    return null;
  }
  const records: FlightRecord[] = [];
  for (const e of entries) {
    if (!e.endsWith(".json")) continue;
    const rec = await loadFlight(root, e.replace(/\.json$/, ""));
    if (rec && rec.status === "open") records.push(rec);
  }
  records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return records[records.length - 1] ?? null;
}

// Files actually changed since the flight's baseline: new working-tree changes
// plus anything committed after the baseline commit.
function actualChangesSince(root: string, record: FlightRecord): string[] {
  const baselineDirty = new Set(record.baselineDirty.map(norm));
  const changed = new Set<string>();

  for (const f of dirtyFiles(root)) {
    if (!baselineDirty.has(norm(f))) changed.add(norm(f));
  }

  const current = head(root);
  if (record.baselineCommit && current && current !== record.baselineCommit) {
    const diff = git(root, ["diff", "--name-only", record.baselineCommit, current]);
    if (diff) {
      for (const f of diff.split("\n")) {
        const t = f.trim();
        if (t && SOURCE_EXT_RE.test(t)) changed.add(norm(t));
      }
    }
  }
  return [...changed];
}

export interface PostflightOptions {
  id?: string;
}

export async function postflight(root: string, options: PostflightOptions = {}): Promise<{ record: FlightRecord; report: FlightReport } | { error: string }> {
  const record = options.id ? await loadFlight(root, options.id) : await latestOpenFlight(root);
  if (!record) return { error: options.id ? `no flight record "${options.id}"` : "no open flight to close" };

  const declared = new Set(record.declaredFiles.map(norm));
  const predicted = new Set(record.predictedRadius.files.map(norm));
  const actualChanged = actualChangesSince(root, record);

  const inBounds: string[] = [];
  const outOfBounds: string[] = [];
  for (const f of actualChanged) {
    if (declared.has(f) || predicted.has(f)) inBounds.push(f);
    else outOfBounds.push(f);
  }
  const changedSet = new Set(actualChanged);
  const declaredUntouched = [...declared].filter((f) => !changedSet.has(f));

  const report: FlightReport = {
    actualChanged,
    declaredUntouched,
    inBounds,
    outOfBounds,
    verdict: outOfBounds.length === 0 ? "clean" : "flagged",
  };

  record.report = report;
  record.status = "closed";
  record.closedAt = new Date().toISOString();
  await writeFile(path.join(flightDir(root), `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  return { record, report };
}

export function renderFlightReport(record: FlightRecord, report: FlightReport): string {
  const lines: string[] = [];
  lines.push(`Flight ${record.id} — ${report.verdict === "clean" ? "✓ CLEAN" : "⚠ FLAGGED"}`);
  lines.push(`  Intent: ${record.intent}`);
  lines.push(`  Declared files (${record.declaredFiles.length}): ${record.declaredFiles.join(", ") || "none"}`);
  lines.push(`  Actually changed (${report.actualChanged.length}): ${report.actualChanged.join(", ") || "none"}`);
  if (report.outOfBounds.length > 0) {
    lines.push(`  ⚠ Out-of-bounds changes (${report.outOfBounds.length}) — not declared and not in predicted radius:`);
    for (const f of report.outOfBounds) lines.push(`      ✗ ${f}`);
  } else {
    lines.push("  ✓ All changes were within the declared scope / predicted radius.");
  }
  if (report.declaredUntouched.length > 0) {
    lines.push(`  Note: declared but not changed: ${report.declaredUntouched.join(", ")}`);
  }
  return lines.join("\n") + "\n";
}

export interface SessionHandoffInput {
  sessionId?: string;
  sourceIde?: string;
  targetIde?: string;
  note?: string;
  intent?: string;
  files?: string[];
}

export interface SessionHandoffPacket {
  schemaVersion: 1;
  sessionId: string;
  createdAt: string;
  sourceIde?: string;
  targetIde?: string;
  note?: string;
  intent?: string;
  dirtyFiles: string[];
  activeFlight?: {
    id: string;
    intent: string;
    declaredFiles: string[];
    createdAt: string;
  } | null;
  validationSummary?: {
    receiptCount: number;
    lastVerdict?: string;
  };
  aidlcSummary?: {
    phase?: string;
    stage?: string;
  };
}

export interface ActiveFlightSummary {
  id: string;
  intent: string;
  declaredFiles: string[];
  createdAt: string;
  status: "open";
}

export async function createSessionHandoff(
  root: string,
  data: SessionHandoffInput = {},
): Promise<SessionHandoffPacket> {
  const dir = flightDir(root);
  await mkdir(dir, { recursive: true });

  const sessionId = data.sessionId || `session-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const dirty = dirtyFiles(root);
  const openFlight = await latestOpenFlight(root);

  let validationSummary: { receiptCount: number; lastVerdict?: string } | undefined;
  try {
    const receiptsPath = path.join(root, ".engineering-intelligence", ".verify", "receipts.json");
    if (existsSync(receiptsPath)) {
      const receiptsContent = await readFile(receiptsPath, "utf8");
      const receipts = JSON.parse(receiptsContent);
      if (Array.isArray(receipts) && receipts.length > 0) {
        validationSummary = {
          receiptCount: receipts.length,
          lastVerdict: receipts[receipts.length - 1]?.verdict,
        };
      }
    }
  } catch {
    // best effort
  }

  let aidlcSummary: { phase?: string; stage?: string } | undefined;
  try {
    const aidlcStatePath = path.join(root, ".engineering-intelligence", "aidlc", "aidlc-state.json");
    if (existsSync(aidlcStatePath)) {
      const aidlcContent = await readFile(aidlcStatePath, "utf8");
      const aidlc = JSON.parse(aidlcContent);
      aidlcSummary = {
        phase: aidlc.currentPhase,
        stage: aidlc.currentStage,
      };
    }
  } catch {
    // best effort
  }

  const packet: SessionHandoffPacket = {
    schemaVersion: 1,
    sessionId,
    createdAt: new Date().toISOString(),
    sourceIde: data.sourceIde,
    targetIde: data.targetIde,
    note: data.note,
    intent: data.intent || openFlight?.intent,
    dirtyFiles: dirty,
    activeFlight: openFlight
      ? {
          id: openFlight.id,
          intent: openFlight.intent,
          declaredFiles: openFlight.declaredFiles,
          createdAt: openFlight.createdAt,
        }
      : null,
    validationSummary,
    aidlcSummary,
  };

  const handoffPath = path.join(dir, "session-handoff.json");
  await writeFile(handoffPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  const specificPath = path.join(dir, `handoff-${sessionId}.json`);
  await writeFile(specificPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  return packet;
}

export async function getSessionHandoff(
  root: string,
  sessionId?: string,
): Promise<SessionHandoffPacket | null> {
  const dir = flightDir(root);
  const targetFile = sessionId ? path.join(dir, `handoff-${sessionId}.json`) : path.join(dir, "session-handoff.json");
  try {
    const content = await readFile(targetFile, "utf8");
    return JSON.parse(content) as SessionHandoffPacket;
  } catch {
    if (sessionId) {
      try {
        const defaultContent = await readFile(path.join(dir, "session-handoff.json"), "utf8");
        const defaultPacket = JSON.parse(defaultContent) as SessionHandoffPacket;
        if (defaultPacket.sessionId === sessionId) return defaultPacket;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function listActiveFlights(root: string): Promise<ActiveFlightSummary[]> {
  let entries: string[];
  try {
    entries = await readdir(flightDir(root));
  } catch {
    return [];
  }
  const active: ActiveFlightSummary[] = [];
  for (const e of entries) {
    if (!e.startsWith("flt-") || !e.endsWith(".json")) continue;
    const rec = await loadFlight(root, e.replace(/\.json$/, ""));
    if (rec && rec.status === "open") {
      active.push({
        id: rec.id,
        intent: rec.intent,
        declaredFiles: rec.declaredFiles,
        createdAt: rec.createdAt,
        status: "open",
      });
    }
  }
  active.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return active;
}

