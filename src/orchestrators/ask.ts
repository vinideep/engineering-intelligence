import { existsSync } from "node:fs";
import path from "node:path";
import { ensureFreshGraph, analyzeImpact, findSymbol, whoCalls } from "../graph/index.js";

// ---------------------------------------------------------------------------
// `ask` — one command to question the codebase. Deterministic routing (no LLM):
// we look at the query shape and dispatch to the right graph query, then render
// a compact human answer. The heavy commands (impact/who-calls/find) still
// exist; this just removes the "which command do I need?" burden.
// ---------------------------------------------------------------------------

export interface AskResult {
  kind: "impact" | "who-calls" | "find" | "empty";
  text: string;
  json: unknown;
}

const SOURCE_EXT_RE = /\.(ts|tsx|js|mjs|cjs|py|go|rs|rb|java|kt)$/;

function looksLikeFile(token: string, root: string): boolean {
  if (SOURCE_EXT_RE.test(token)) return true;
  if (token.includes("/") && existsSync(path.resolve(root, token))) return true;
  return false;
}

// Pull the identifier a natural-language query is asking about (last word-ish token).
function lastIdentifier(query: string): string {
  const tokens = query.trim().split(/\s+/);
  return tokens[tokens.length - 1].replace(/[?.,]+$/, "");
}

export async function runAsk(root: string, rawQuery: string, tokens: string[]): Promise<AskResult> {
  const query = rawQuery.trim();
  const lower = query.toLowerCase();

  // 1. Explicit file argument(s) → impact analysis.
  const fileArgs = tokens.filter((t) => looksLikeFile(t, root));
  const wantsImpact = /\b(impact|breaks?|affect|affected|depend)/.test(lower);
  if (fileArgs.length > 0 && (wantsImpact || tokens.every((t) => looksLikeFile(t, root)))) {
    return impactAnswer(root, fileArgs);
  }

  // 2. "who calls X" / "callers of X" / "who uses X" → who_calls.
  if (/\b(who calls|callers? of|who uses|what calls|called by)\b/.test(lower)) {
    return whoCallsAnswer(root, lastIdentifier(query));
  }

  // 3. "where is X" / "find X" / "locate X" / "definition of X" → find_symbol.
  if (/\b(where is|where's|find|locate|definition of|defined)\b/.test(lower)) {
    return findAnswer(root, lastIdentifier(query));
  }

  // 4. A lone file path with no verb → impact.
  if (fileArgs.length > 0) return impactAnswer(root, fileArgs);

  // 5. A single bare identifier → combined "locate + who calls".
  if (tokens.length === 1 && /^[A-Za-z_$][\w$.]*$/.test(tokens[0])) {
    return symbolAnswer(root, tokens[0]);
  }

  // 6. Fallback: try it as a symbol name.
  return symbolAnswer(root, lastIdentifier(query));
}

async function impactAnswer(root: string, files: string[]): Promise<AskResult> {
  await ensureFreshGraph(root);
  const result = await analyzeImpact(root, files);
  const lines: string[] = [];
  lines.push(`Impact of changing: ${files.join(", ")}`);
  lines.push(`  Direct dependents (${result.direct.length}): ${result.direct.slice(0, 15).join(", ") || "none"}`);
  lines.push(`  Indirect dependents (${result.indirect.length}): ${result.indirect.slice(0, 15).join(", ") || "none"}`);
  if (result.testsToRun.length) lines.push(`  ▶ Tests to run (${result.testsToRun.length}): ${result.testsToRun.join(", ")}`);
  for (const note of result.riskNotes) lines.push(`  ⚠ ${note}`);
  if (result.direct.length === 0 && result.indirect.length === 0) lines.push("  No dependents found (or graph not built — run `setup`).");
  return { kind: "impact", text: lines.join("\n") + "\n", json: result };
}

async function whoCallsAnswer(root: string, name: string): Promise<AskResult> {
  await ensureFreshGraph(root);
  const result = await whoCalls(root, name);
  const lines: string[] = [];
  if (result.unresolved) {
    lines.push(result.unresolved);
  } else {
    lines.push(`Callers of ${name} (${result.matched.length} def, ${result.callers.length} caller(s)):`);
    for (const c of result.callers.slice(0, 20)) lines.push(`  ${c.label}  [${c.confidence}]  ${c.evidence[0] ?? ""}`);
    if (result.callers.length === 0) lines.push("  No callers found.");
  }
  return { kind: "who-calls", text: lines.join("\n") + "\n", json: result };
}

async function findAnswer(root: string, name: string): Promise<AskResult> {
  await ensureFreshGraph(root);
  const matches = await findSymbol(root, name);
  const lines: string[] = [];
  if (matches.length === 0) lines.push(`No symbol named "${name}" found.`);
  else {
    lines.push(`${name} — ${matches.length} definition(s):`);
    for (const m of matches.slice(0, 20)) lines.push(`  ${m.label} <${m.symbolKind ?? "symbol"}>  ${m.evidence[0] ?? ""}`);
  }
  return { kind: "find", text: lines.join("\n") + "\n", json: matches };
}

// Combined answer for a bare identifier: where it's defined + who calls it.
async function symbolAnswer(root: string, name: string): Promise<AskResult> {
  await ensureFreshGraph(root);
  const matches = await findSymbol(root, name);
  if (matches.length === 0) {
    return { kind: "empty", text: `No symbol named "${name}" in the graph. Try \`get_brief\` for orientation, or pass a file path to see its impact.\n`, json: { matches: [] } };
  }
  const who = await whoCalls(root, name);
  const lines: string[] = [];
  lines.push(`${name} — ${matches.length} definition(s):`);
  for (const m of matches.slice(0, 10)) lines.push(`  defined: ${m.label} <${m.symbolKind ?? "symbol"}>  ${m.evidence[0] ?? ""}`);
  lines.push(`  called by ${who.callers.length} site(s):`);
  for (const c of who.callers.slice(0, 15)) lines.push(`    ${c.label}  [${c.confidence}]  ${c.evidence[0] ?? ""}`);
  return { kind: "find", text: lines.join("\n") + "\n", json: { matches, callers: who.callers } };
}
