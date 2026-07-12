/**
 * migration-lint gate — scans database migration files for operations that are
 * destructive (data loss), locking (production outage risk), or breaking. This is
 * the deterministic core of the database-migration-safety skill.
 *
 * Scope: when a git base ref is supplied it lints only migrations changed vs that
 * ref (pre-merge mode); otherwise it audits every migration in the tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  gitAvailable,
  gitChangedFiles,
  type GateFinding,
  type GateOptions,
  type GateResult,
  statusFromFindings,
  walkFiles,
} from "./index.js";

const MIGRATION_EXTS = new Set([".sql", ".rb", ".py", ".js", ".ts"]);

function isMigrationFile(rel: string): boolean {
  const ext = path.extname(rel).toLowerCase();
  if (ext === ".sql") return true;
  return /migrat/i.test(rel) && MIGRATION_EXTS.has(ext);
}

interface Rule {
  re: RegExp;
  severity: GateFinding["severity"];
  message: string;
}

// Ordered rules; each matched line yields at most the first matching finding per rule.
const RULES: Rule[] = [
  { re: /\bdrop\s+(table|database|schema)\b/i, severity: "error", message: "Destructive: DROP {table|database|schema} — irreversible data loss. Ensure a backup + rollback plan and explicit approval." },
  { re: /\btruncate\b/i, severity: "error", message: "Destructive: TRUNCATE removes all rows irreversibly." },
  { re: /\balter\s+table\b[^;]*\bdrop\s+(column|constraint)\b/i, severity: "error", message: "Destructive: dropping a column/constraint loses data and can break dependents." },
  { re: /\b(drop_table|drop_column|remove_column|op\.drop_table|op\.drop_column|dropTable|dropColumn)\b/, severity: "error", message: "Destructive ORM operation removes a table/column — irreversible data loss." },
  { re: /\bdelete\s+from\b(?![^;]*\bwhere\b)[^;]*;/i, severity: "error", message: "Mass DELETE without WHERE clause — deletes every row." },
  { re: /\bupdate\b(?![^;]*\bwhere\b)[^;]*\bset\b[^;]*;/i, severity: "warning", message: "UPDATE without WHERE clause — rewrites every row; confirm this is intended." },
  { re: /\brename\s+(column|to)\b|\balter\s+table\b[^;]*\brename\b|\brename_column\b/i, severity: "warning", message: "Rename is breaking for anything referencing the old name — coordinate a two-step migration." },
  { re: /\badd\s+column\b[^;]*\bnot\s+null\b(?![^;]*\bdefault\b)/i, severity: "warning", message: "ADD COLUMN NOT NULL without DEFAULT locks the table and fails on existing rows — add a default or backfill first." },
  { re: /\bcreate\s+(unique\s+)?index\b(?![^;]*\bconcurrently\b)/i, severity: "warning", message: "CREATE INDEX without CONCURRENTLY takes a write lock (Postgres) — prefer CONCURRENTLY on large tables." },
  { re: /\balter\s+table\b[^;]*\badd\s+(constraint|foreign\s+key)\b/i, severity: "warning", message: "Adding a constraint/foreign key validates existing rows under lock — consider NOT VALID + VALIDATE." },
];

function stripLineComment(line: string): string {
  const idx = line.indexOf("--");
  return idx >= 0 ? line.slice(0, idx) : line;
}

function lintContent(content: string, rel: string): GateFinding[] {
  const findings: GateFinding[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]);
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        findings.push({ severity: rule.severity, message: rule.message, file: rel, line: i + 1, evidence: `${rel}:${i + 1}` });
      }
    }
  }
  return findings;
}

export async function migrationLintGate(root: string, options: GateOptions = {}): Promise<GateResult> {
  let relFiles: string[];
  if (options.base && (await gitAvailable(root))) {
    relFiles = (await gitChangedFiles(root, options.base)).filter(isMigrationFile);
  } else {
    const abs = await walkFiles(root, isMigrationFile);
    relFiles = abs.map((f) => path.relative(root, f).replace(/\\/g, "/"));
  }

  if (relFiles.length === 0) {
    return { gate: "migration-lint", status: "pass", summary: "No migration files to lint.", findings: [] };
  }

  const findings: GateFinding[] = [];
  for (const rel of relFiles) {
    let content = "";
    try { content = await readFile(path.join(root, rel), "utf8"); } catch { continue; }
    findings.push(...lintContent(content, rel));
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const summary = findings.length === 0
    ? `Linted ${relFiles.length} migration file(s); no risky operations found.`
    : `${errors} destructive and ${warnings} risky operation(s) across ${relFiles.length} migration file(s).`;
  return { gate: "migration-lint", status: statusFromFindings(findings), summary, findings };
}
