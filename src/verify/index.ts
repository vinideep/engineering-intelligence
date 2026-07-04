import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

// Deterministic knowledge-base drift verification.
//
// The intelligence layer's honesty claim is only credible if we can mechanically
// prove its prose still matches the code. This module scans generated markdown
// for concrete references — file paths and `file:line` evidence citations — and
// checks each against the current working tree. No LLM involved.

export type ReferenceStatus = "ok" | "missing" | "line-out-of-range";

export interface ReferenceCheck {
  source: string; // the markdown file the reference was found in (repo-relative)
  reference: string; // the raw path or path:line token
  target: string; // resolved repo-relative target path
  line?: number; // line number if a file:line citation
  status: ReferenceStatus;
}

export interface VerifyReport {
  generatedAt: string;
  roots: string[]; // directories scanned (repo-relative)
  filesScanned: number;
  referencesChecked: number;
  ok: number;
  drift: number; // count of missing + line-out-of-range
  results: ReferenceCheck[];
}

// Directories under .engineering-intelligence/ whose markdown we verify.
// Scoped to knowledge-base: it asserts facts about the *current* code, so its
// references must resolve. The aidlc/ backlog is forward-looking (it references
// planned, not-yet-created files) and is intentionally excluded.
const SCAN_DIRS = ["knowledge-base"];

// Extensions we treat as verifiable file references. Conservative on purpose:
// a false "missing" would undermine trust in the trust feature.
const REF_EXT = "(?:ts|tsx|js|mjs|cjs|py|go|rs|rb|java|kt|json|md|yml|yaml)";
// Backtick-quoted `path.ext` or `path.ext:line`.
const REF_RE = new RegExp("`([\\w./\\-]+\\." + REF_EXT + ")(?::(\\d+))?`", "g");

async function walkMarkdown(dir: string, out: string[] = []): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let s;
    try { s = await stat(full); } catch { continue; }
    if (s.isDirectory()) {
      await walkMarkdown(full, out);
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function isSkippable(ref: string): boolean {
  // URLs, globs, placeholders, and path-alias templates are not concrete refs.
  if (/^https?:/i.test(ref)) return true;
  if (/[*?<>]/.test(ref)) return true;
  if (ref.includes("$")) return true;
  if (ref.startsWith("node_modules/")) return true;
  return false;
}

async function fileLineCount(absPath: string): Promise<number | null> {
  try {
    const content = await readFile(absPath, "utf8");
    // A trailing newline shouldn't count as an extra addressable line.
    const n = content.length === 0 ? 0 : content.split("\n").length;
    return content.endsWith("\n") ? n - 1 : n;
  } catch {
    return null;
  }
}

export async function verifyKnowledge(root: string): Promise<VerifyReport> {
  const base = path.join(root, ".engineering-intelligence");
  const scanned: string[] = [];
  const rootsPresent: string[] = [];
  for (const d of SCAN_DIRS) {
    const dir = path.join(base, d);
    const before = scanned.length;
    await walkMarkdown(dir, scanned);
    if (scanned.length > before) rootsPresent.push(path.posix.join(".engineering-intelligence", d));
  }

  const results: ReferenceCheck[] = [];
  const lineCountCache = new Map<string, number | null>();

  for (const mdFile of scanned) {
    let content: string;
    try {
      content = await readFile(mdFile, "utf8");
    } catch {
      continue;
    }
    const source = path.relative(root, mdFile).replace(/\\/g, "/");
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(content)) !== null) {
      const ref = m[1];
      const line = m[2] ? parseInt(m[2], 10) : undefined;
      const token = m[0];
      if (seen.has(token)) continue;
      seen.add(token);
      if (isSkippable(ref)) continue;

      const target = ref.replace(/\\/g, "/");
      const absPath = path.resolve(root, target);
      // Guard against path traversal outside the repo.
      if (!absPath.startsWith(path.resolve(root))) continue;

      let count = lineCountCache.get(absPath);
      if (count === undefined) {
        count = await fileLineCount(absPath);
        lineCountCache.set(absPath, count);
      }

      // Conservative: a bare filename with no directory and no line citation is
      // almost always prose (e.g. "see engineering-intelligence.md"), not a
      // location assertion — only flag it when it actually resolves. References
      // with a path separator OR a line number ARE assertions and get checked.
      const isAssertion = target.includes("/") || line !== undefined;
      if (!isAssertion && count === null) continue;

      let status: ReferenceStatus;
      if (count === null) {
        status = "missing";
      } else if (line !== undefined && line > count) {
        status = "line-out-of-range";
      } else {
        status = "ok";
      }
      results.push({ source, reference: token.replace(/`/g, ""), target, line, status });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const drift = results.length - ok;

  return {
    generatedAt: new Date().toISOString(),
    roots: rootsPresent,
    filesScanned: scanned.length,
    referencesChecked: results.length,
    ok,
    drift,
    results,
  };
}

export function renderVerifyReport(report: VerifyReport): string {
  const lines: string[] = [];
  lines.push("Knowledge-base drift verification");
  if (report.filesScanned === 0) {
    lines.push("  No knowledge-base markdown found under .engineering-intelligence/ (run initialize first).");
    return lines.join("\n") + "\n";
  }
  lines.push(`  Scanned ${report.filesScanned} file(s), checked ${report.referencesChecked} reference(s).`);
  lines.push(`  OK: ${report.ok}   Drift: ${report.drift}`);
  if (report.drift > 0) {
    lines.push("");
    lines.push("  Drift detected:");
    for (const r of report.results) {
      if (r.status === "ok") continue;
      const label = r.status === "missing" ? "missing file" : `line ${r.line} out of range`;
      lines.push(`    ✗ ${r.source} → \`${r.reference}\` (${label})`);
    }
  } else {
    lines.push("  ✓ All references resolve to existing code.");
  }
  return lines.join("\n") + "\n";
}
