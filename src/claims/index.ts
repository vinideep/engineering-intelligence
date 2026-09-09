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
import { deriveFacts, factKey, renderFact, type DerivedFact } from "./derive.js";

export { deriveFacts, factKey, renderFact, type DerivedFact } from "./derive.js";

export type Confidence = "verified" | "inferred" | "unknown";

/**
 * How a claim earns — or fails to earn — the word "verified".
 *
 * derived  — the statement is RENDERED from a machine-extracted descriptor, so
 *            re-deriving it checks the sentence itself. Only these may be
 *            presented as facts.
 * asserted — free text written by a human or a model. Its evidence can be
 *            hash-checked, but nothing checks whether the sentence is TRUE of
 *            that evidence, so it is never labelled verified.
 */
export type ClaimKind = "derived" | "asserted";

export interface ClaimEvidence {
  path: string;              // repo-relative source path
  lines?: [number, number];  // 1-based inclusive line range; whole file if omitted
  contentHash: string;       // hash of the span content at record time
}

export interface Claim {
  id: string;                // e.g. "CLM-0001"
  kind: ClaimKind;
  statement: string;         // for derived claims this is regenerated, not stored authority
  evidence: ClaimEvidence[];
  confidence: Confidence;
  lastVerified: string;      // ISO timestamp
  /** derived only: the descriptor the statement is rendered from. */
  fact?: DerivedFact;
  /** asserted only: who wrote it. Required, so an unchecked claim always has an owner. */
  author?: string;
}

/**
 * Claims written before the derived/asserted split carried free text and defaulted
 * to confidence "verified". Reading them as `derived` would relabel unchecked prose
 * as fact, so they are treated as asserted — the safe direction.
 */
export function claimKind(claim: Claim): ClaimKind {
  return claim.kind === "derived" && claim.fact ? "derived" : "asserted";
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
  author: string;
}

/**
 * Record an ASSERTED claim — free text with an owner.
 *
 * There is deliberately no way to hand-author a derived claim: derived statements
 * are generated by `deriveClaims` from machine-extracted descriptors, which is the
 * only reason they can be verified at all. Anything typed here is unchecked prose
 * with a hash-pinned anchor, and is recorded as such. `confidence` is forced to
 * "unknown" so nothing downstream can mistake it for a fact.
 */
export async function addClaim(root: string, input: NewClaim): Promise<Claim> {
  if (!input.author?.trim()) {
    throw new Error("An asserted claim needs --author: unchecked statements must have an owner.");
  }
  const store = await loadClaims(root);
  const evidence: ClaimEvidence[] = [];
  for (const ev of input.evidence) {
    const contentHash = await hashSpan(root, ev);
    if (contentHash === null) throw new Error(`Evidence not found or out of range: ${evLabel(ev)}`);
    evidence.push({ path: ev.path.replace(/\\/g, "/"), lines: ev.lines, contentHash });
  }
  const claim: Claim = {
    id: nextId(store),
    kind: "asserted",
    statement: input.statement,
    evidence,
    confidence: "unknown",
    lastVerified: new Date().toISOString(),
    author: input.author.trim(),
  };
  store.claims.push(claim);
  await writeClaims(root, store);
  return claim;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * verified   — derived only: the fact was re-computed from source and still holds.
 * refuted    — derived only: re-computation says this is no longer true.
 * unverified — asserted: evidence is intact, but nothing checked the sentence.
 * stale      — asserted: the cited code changed, so the sentence may no longer hold.
 * missing    — the cited code is gone entirely.
 */
export type ClaimStatus = "verified" | "refuted" | "unverified" | "stale" | "missing";

export interface ClaimVerification {
  id: string;
  kind: ClaimKind;
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
  refuted: number;
  unverified: number;
  stale: number;
  missing: number;
  results: ClaimVerification[];
}

export async function verifyClaims(root: string): Promise<VerifyClaimsReport> {
  const store = await loadClaims(root);
  const results: ClaimVerification[] = [];

  // Re-derive the whole fact set once, only if some claim actually needs it.
  const needsDerivation = store.claims.some((c) => claimKind(c) === "derived");
  const currentFacts = needsDerivation
    ? new Set((await deriveFacts(root)).map(factKey))
    : new Set<string>();

  for (const claim of store.claims) {
    const staleEvidence: string[] = [];
    const missingEvidence: string[] = [];
    for (const ev of claim.evidence) {
      const current = await hashSpan(root, ev);
      if (current === null) missingEvidence.push(evLabel(ev));
      else if (current !== ev.contentHash) staleEvidence.push(evLabel(ev));
    }

    let status: ClaimStatus;
    let statement = claim.statement;

    if (claimKind(claim) === "derived") {
      // The sentence is regenerated from the descriptor and the descriptor is
      // re-computed from source, so this genuinely checks the claim, not the anchor.
      statement = renderFact(claim.fact!);
      status = currentFacts.has(factKey(claim.fact!)) ? "verified" : "refuted";
    } else if (missingEvidence.length > 0) {
      status = "missing";
    } else if (staleEvidence.length > 0) {
      status = "stale";
    } else {
      // Evidence intact — but nothing has checked that the sentence is true of it.
      status = "unverified";
    }

    results.push({ id: claim.id, kind: claimKind(claim), statement, status, staleEvidence, missingEvidence });
  }

  const count = (s: ClaimStatus) => results.filter((r) => r.status === s).length;
  return {
    generatedAt: new Date().toISOString(),
    root,
    total: results.length,
    verified: count("verified"),
    refuted: count("refuted"),
    unverified: count("unverified"),
    stale: count("stale"),
    missing: count("missing"),
    results,
  };
}

/**
 * Regenerate the derived claim set from source. Asserted claims are left alone —
 * they are the user's, and this must never silently delete their notes.
 */
export async function deriveClaims(root: string): Promise<{ added: number; removed: number; total: number }> {
  const store = await loadClaims(root);
  const asserted = store.claims.filter((c) => claimKind(c) === "asserted");
  const previousDerived = new Set(store.claims.filter((c) => claimKind(c) === "derived").map((c) => factKey(c.fact!)));

  const facts = await deriveFacts(root);
  const now = new Date().toISOString();
  const derived: Claim[] = [];
  let counter = 0;

  for (const fact of facts) {
    const ev = { path: fact.evidence.split(":")[0] };
    const contentHash = await hashSpan(root, ev);
    if (contentHash === null) continue; // cannot anchor it, so do not state it
    counter += 1;
    derived.push({
      id: `CLM-D${String(counter).padStart(4, "0")}`,
      kind: "derived",
      fact,
      statement: renderFact(fact),
      evidence: [{ path: ev.path, contentHash }],
      confidence: "verified",
      lastVerified: now,
    });
  }

  const currentKeys = new Set(facts.map(factKey));
  const added = [...currentKeys].filter((k) => !previousDerived.has(k)).length;
  const removed = [...previousDerived].filter((k) => !currentKeys.has(k)).length;

  await writeClaims(root, { ...store, claims: [...derived, ...asserted] });
  return { added, removed, total: derived.length };
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

const ICON: Record<ClaimStatus, string> = {
  verified: "✅", refuted: "❗", unverified: "◻️", stale: "🔄", missing: "❌",
};

export function renderVerifyReport(report: VerifyClaimsReport): string {
  const lines = [
    `Claims: ${report.verified} verified (re-derived), ${report.refuted} refuted, ` +
    `${report.unverified} unverified assertions, ${report.stale} stale, ${report.missing} missing — of ${report.total}.`,
  ];
  for (const r of report.results) {
    if (r.status === "verified") continue;
    const detail = [
      ...r.missingEvidence.map((e) => `missing ${e}`),
      ...r.staleEvidence.map((e) => `changed ${e}`),
    ].join("; ");
    const why = r.status === "refuted"
      ? "no longer true when re-derived from source"
      : r.status === "unverified"
        ? "asserted, never machine-checked"
        : detail;
    lines.push(`  ${ICON[r.status]} ${r.id} ${r.statement} — ${why}`);
  }
  if (report.total === 0) {
    lines.push("  No claims recorded yet. Run `engineering-intelligence claims derive` to compute the baseline.");
  } else if (report.refuted === 0 && report.stale === 0 && report.missing === 0) {
    lines.push("  ✅ Every derived fact still holds against the current source.");
  }
  if (report.unverified > 0) {
    lines.push(`  Note: ${report.unverified} asserted claim(s) carry an anchor but no machine check — treat as unproven.`);
  }
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
