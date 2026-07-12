/**
 * Claim-level knowledge — self-verifying facts about the codebase.
 *
 * Prose knowledge docs rot silently, and the freshness scorer can only guess from
 * file modification times. A *claim* is a single factual statement bound to the
 * exact evidence spans that justify it, each pinned by a content hash. Re-hashing
 * the spans tells us — deterministically, with no LLM — whether the claim still
 * holds, is stale (the cited code changed), or is missing (the code is gone).
 *
 * This is what lets a small model trust the knowledge base: `get_context` serves
 * only claims that still verify against the current source.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export type Confidence = "verified" | "inferred" | "unknown";

export interface ClaimEvidence {
  path: string;              // repo-relative source path
  lines?: [number, number];  // 1-based inclusive line range; whole file if omitted
  contentHash: string;       // hash of the span content at record time
}

export interface Claim {
  id: string;                // e.g. "CLM-0001"
  statement: string;         // the factual assertion
  evidence: ClaimEvidence[];
  confidence: Confidence;
  lastVerified: string;      // ISO timestamp
}

export interface ClaimStore {
  schemaVersion: 1;
  generatedAt: string;
  claims: Claim[];
}

const CLAIMS_PATH = ".engineering-intelligence/claims/claims.json";

export function claimsPath(root: string): string {
  return path.join(root, CLAIMS_PATH);
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function normalizeSpan(text: string): string {
  // Trailing-whitespace and final-newline insensitive so cosmetic edits do not
  // flip a claim stale, but any substantive change to the cited lines does.
  return text.replace(/[ \t]+$/gm, "").replace(/\n+$/,"");
}

function hashText(text: string): string {
  return createHash("sha256").update(normalizeSpan(text)).digest("hex").slice(0, 16);
}

/** Hash an evidence span at the current working-tree state, or null if absent. */
export async function hashSpan(root: string, ev: { path: string; lines?: [number, number] }): Promise<string | null> {
  let content: string;
  try {
    content = await readFile(path.resolve(root, ev.path), "utf8");
  } catch {
    return null;
  }
  if (!ev.lines) return hashText(content);
  const [start, end] = ev.lines;
  const lines = content.split("\n");
  if (start < 1 || end < start || start > lines.length) return null;
  return hashText(lines.slice(start - 1, Math.min(end, lines.length)).join("\n"));
}

function evLabel(ev: { path: string; lines?: [number, number] }): string {
  return ev.lines ? `${ev.path}:${ev.lines[0]}-${ev.lines[1]}` : ev.path;
}

// ---------------------------------------------------------------------------
// Load / write
// ---------------------------------------------------------------------------

export async function loadClaims(root: string): Promise<ClaimStore> {
  try {
    const parsed = JSON.parse(await readFile(claimsPath(root), "utf8")) as ClaimStore;
    if (!Array.isArray(parsed.claims)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function emptyStore(): ClaimStore {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), claims: [] };
}

export async function writeClaims(root: string, store: ClaimStore): Promise<void> {
  const p = claimsPath(root);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify({ ...store, generatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function nextId(store: ClaimStore): string {
  let max = 0;
  for (const c of store.claims) {
    const m = c.id.match(/CLM-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `CLM-${String(max + 1).padStart(4, "0")}`;
}

export interface NewClaim {
  statement: string;
  evidence: Array<{ path: string; lines?: [number, number] }>;
  confidence?: Confidence;
}

/** Add a claim, computing evidence hashes from the current source. Persists the store. */
export async function addClaim(root: string, input: NewClaim): Promise<Claim> {
  const store = await loadClaims(root);
  const evidence: ClaimEvidence[] = [];
  for (const ev of input.evidence) {
    const contentHash = await hashSpan(root, ev);
    if (contentHash === null) throw new Error(`Evidence not found or out of range: ${evLabel(ev)}`);
    evidence.push({ path: ev.path.replace(/\\/g, "/"), lines: ev.lines, contentHash });
  }
  const claim: Claim = {
    id: nextId(store),
    statement: input.statement,
    evidence,
    confidence: input.confidence ?? "verified",
    lastVerified: new Date().toISOString(),
  };
  store.claims.push(claim);
  await writeClaims(root, store);
  return claim;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type ClaimStatus = "verified" | "stale" | "missing";

export interface ClaimVerification {
  id: string;
  statement: string;
  status: ClaimStatus;
  staleEvidence: string[];
  missingEvidence: string[];
}

export interface VerifyClaimsReport {
  generatedAt: string;
  root: string;
  total: number;
  verified: number;
  stale: number;
  missing: number;
  results: ClaimVerification[];
}

export async function verifyClaims(root: string): Promise<VerifyClaimsReport> {
  const store = await loadClaims(root);
  const results: ClaimVerification[] = [];

  for (const claim of store.claims) {
    const staleEvidence: string[] = [];
    const missingEvidence: string[] = [];
    for (const ev of claim.evidence) {
      const current = await hashSpan(root, ev);
      if (current === null) missingEvidence.push(evLabel(ev));
      else if (current !== ev.contentHash) staleEvidence.push(evLabel(ev));
    }
    const status: ClaimStatus =
      missingEvidence.length > 0 ? "missing" : staleEvidence.length > 0 ? "stale" : "verified";
    results.push({ id: claim.id, statement: claim.statement, status, staleEvidence, missingEvidence });
  }

  return {
    generatedAt: new Date().toISOString(),
    root,
    total: results.length,
    verified: results.filter((r) => r.status === "verified").length,
    stale: results.filter((r) => r.status === "stale").length,
    missing: results.filter((r) => r.status === "missing").length,
    results,
  };
}

/** Re-hash every claim's evidence and update the store so verified claims stay current. */
export async function refreshClaims(root: string): Promise<number> {
  const store = await loadClaims(root);
  let updated = 0;
  for (const claim of store.claims) {
    let changed = false;
    for (const ev of claim.evidence) {
      const current = await hashSpan(root, ev);
      if (current !== null && current !== ev.contentHash) { ev.contentHash = current; changed = true; }
    }
    if (changed) { claim.lastVerified = new Date().toISOString(); updated++; }
  }
  if (updated > 0) await writeClaims(root, store);
  return updated;
}

const ICON: Record<ClaimStatus, string> = { verified: "✅", stale: "🔄", missing: "❌" };

export function renderVerifyReport(report: VerifyClaimsReport): string {
  const lines = [`Claims: ${report.verified} verified, ${report.stale} stale, ${report.missing} missing (of ${report.total}).`];
  for (const r of report.results) {
    if (r.status === "verified") continue;
    const detail = [...r.missingEvidence.map((e) => `missing ${e}`), ...r.staleEvidence.map((e) => `changed ${e}`)].join("; ");
    lines.push(`  ${ICON[r.status]} ${r.id} ${r.statement} — ${detail}`);
  }
  if (report.stale === 0 && report.missing === 0 && report.total > 0) lines.push("  ✅ All claims still hold against the current source.");
  if (report.total === 0) lines.push("  No claims recorded yet. The initialize/sync workflows author them, or use `claims add`.");
  return lines.join("\n") + "\n";
}

/** Parse a CLI evidence spec: "src/a.ts:10-25,src/b.ts" → structured evidence. */
export function parseEvidenceSpec(spec: string): Array<{ path: string; lines?: [number, number] }> {
  const out: Array<{ path: string; lines?: [number, number] }> = [];
  for (const raw of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const range = raw.match(/^(.*):(\d+)-(\d+)$/);
    const single = raw.match(/^(.*):(\d+)$/);
    if (range) out.push({ path: range[1], lines: [parseInt(range[2], 10), parseInt(range[3], 10)] });
    else if (single) out.push({ path: single[1], lines: [parseInt(single[2], 10), parseInt(single[2], 10)] });
    else out.push({ path: raw });
  }
  return out;
}
