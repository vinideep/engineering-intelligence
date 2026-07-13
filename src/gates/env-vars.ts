/**
 * env-vars gate — cross-checks environment variables referenced in source against
 * those declared in `.env.example` (and siblings). Undocumented variables are the
 * classic "works on my machine / breaks in prod" failure; this makes the
 * environment-variable-auditor skill's core check deterministic.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  type GateFinding,
  type GateResult,
  statusFromFindings,
  walkFiles,
} from "./index.js";

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rb"]);

// Per-language patterns capturing the variable name in group 1.
const REFERENCE_PATTERNS: RegExp[] = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,               // JS/TS: process.env.FOO
  /process\.env\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g, // JS/TS: process.env['FOO']
  /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,          // Vite: import.meta.env.FOO
  /os\.environ(?:\.get)?\[?\(?\s*['"]([A-Z_][A-Z0-9_]*)['"]/g, // Python: os.environ[/get(
  /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,      // Python: os.getenv('FOO')
  /os\.Getenv\(\s*"([A-Z_][A-Z0-9_]*)"/g,            // Go: os.Getenv("FOO")
  /ENV\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,        // Ruby: ENV['FOO']
];

const ENV_FILES = [".env.example", ".env.sample", ".env.template", ".env.dist", ".env.defaults"];

interface Reference {
  name: string;
  file: string;
  line: number;
}

function extractReferences(content: string, relPath: string): Reference[] {
  const refs: Reference[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of REFERENCE_PATTERNS) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(lines[i])) !== null) {
        refs.push({ name: m[1], file: relPath, line: i + 1 });
      }
    }
  }
  return refs;
}

function parseDeclared(content: string): Set<string> {
  const declared = new Set<string>();
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) declared.add(m[1]);
  }
  return declared;
}

export async function envVarsGate(root: string): Promise<GateResult> {
  const files = await walkFiles(root, (rel) => SOURCE_EXTS.has(path.extname(rel).toLowerCase()));

  const references = new Map<string, Reference>(); // name → first reference site
  for (const file of files) {
    let content = "";
    try { content = await readFile(file, "utf8"); } catch { continue; }
    const rel = path.relative(root, file).replace(/\\/g, "/");
    for (const ref of extractReferences(content, rel)) {
      if (!references.has(ref.name)) references.set(ref.name, ref);
    }
  }

  // Gather declared vars across any present env example file.
  const declared = new Set<string>();
  let foundEnvFile: string | undefined;
  for (const name of ENV_FILES) {
    try {
      const content = await readFile(path.join(root, name), "utf8");
      foundEnvFile = foundEnvFile ?? name;
      for (const v of parseDeclared(content)) declared.add(v);
    } catch { /* absent */ }
  }

  const findings: GateFinding[] = [];

  if (references.size === 0) {
    return { gate: "env-vars", status: "pass", summary: "No environment variables referenced in source.", findings };
  }

  if (!foundEnvFile) {
    findings.push({
      severity: "info",
      message: `${references.size} environment variable(s) referenced but no .env.example found. Add one so required config is discoverable.`,
    });
  }

  for (const [name, ref] of references) {
    if (foundEnvFile && !declared.has(name)) {
      findings.push({
        severity: "warning",
        message: `Environment variable ${name} is used in code but not declared in ${foundEnvFile}.`,
        file: ref.file,
        line: ref.line,
        evidence: `${ref.file}:${ref.line}`,
      });
    }
  }

  // Declared but never referenced — low severity, helps prune dead config.
  for (const name of declared) {
    if (!references.has(name)) {
      findings.push({
        severity: "info",
        message: `Environment variable ${name} is declared in ${foundEnvFile} but never referenced in source.`,
      });
    }
  }

  const undocumented = findings.filter((f) => f.severity === "warning").length;
  let summary: string;
  if (!foundEnvFile) {
    summary = `${references.size} environment variable(s) referenced; no .env.example present to check them against.`;
  } else if (undocumented > 0) {
    summary = `${undocumented} environment variable(s) used in code but undocumented in ${foundEnvFile}.`;
  } else {
    summary = `All ${references.size} referenced environment variable(s) are documented in ${foundEnvFile}.`;
  }

  return { gate: "env-vars", status: statusFromFindings(findings), summary, findings };
}
