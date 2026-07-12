/**
 * dead-exports gate (JS/TS) — flags named exports that are never imported anywhere
 * in the repository. Deliberately conservative: it matches imported names globally
 * and exempts entry points, tests, and any module consumed via namespace / wildcard
 * / dynamic import. It therefore under-reports rather than over-reports — a dead
 * export it misses is safer than a live export it wrongly condemns.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  type GateFinding,
  type GateResult,
  isTestFile,
  JS_TS_EXTS,
  statusFromFindings,
  walkFiles,
} from "./index.js";

interface ExportSite {
  name: string;
  moduleId: string;
  file: string;
  line: number;
}

function moduleId(root: string, absFile: string): string {
  const rel = path.relative(root, absFile).replace(/\\/g, "/").replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  return `module:${rel}`;
}

function resolveModuleId(root: string, fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null; // external package — not our module
  const resolved = path.relative(root, path.resolve(path.dirname(fromFile), specifier))
    .replace(/\\/g, "/")
    .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "")
    .replace(/\/index$/, "");
  return `module:${resolved}`;
}

const EXPORT_DECL = /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_LIST = /^\s*export\s+(?:type\s+)?\{([^}]*)\}(?!\s*from)/;                // export { a }, export type { a }
const REEXPORT_LIST = /^\s*export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/; // export { a } from './m'
const REEXPORT_STAR = /^\s*export\s+\*\s+from\s+['"]([^'"]+)['"]/;                     // export * from './m'
const IMPORT_NAMED = /import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g; // import [type] [Def,] { a, b as c }
const IMPORT_STAR = /import\s+\*\s+as\s+[\w$]+\s+from\s+['"]([^'"]+)['"]/g; // import * as ns
const DYNAMIC = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;         // import('x') / require('x')

/** From an `{ a, b as c }` clause, the names that must match a source export are the
 *  ORIGINAL names (`a`, `b`) — the local alias is irrelevant to the source module. */
function originalNames(clause: string): string[] {
  return clause
    .split(",")
    .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
    .filter((n) => n && n !== "type" && /^[A-Za-z_$][\w$]*$/.test(n));
}

/** Exported alias names from `export { a, b as c }` are the AS-names (`a`, `c`). */
function exportedNames(clause: string): string[] {
  return clause
    .split(",")
    .map((part) => {
      const bits = part.trim().split(/\s+as\s+/);
      return (bits[1] ?? bits[0]).trim();
    })
    .filter((n) => n && n !== "type" && /^[A-Za-z_$][\w$]*$/.test(n));
}

export async function deadExportsGate(root: string): Promise<GateResult> {
  const files = await walkFiles(root, (rel) => JS_TS_EXTS.has(path.extname(rel).toLowerCase()));

  // Entry points are exempt: their exports are the public API by definition.
  const entryModules = new Set<string>();
  try {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      main?: string; bin?: string | Record<string, string>; exports?: unknown;
    };
    const entryPaths: string[] = [];
    if (typeof pkg.main === "string") entryPaths.push(pkg.main);
    if (typeof pkg.bin === "string") entryPaths.push(pkg.bin);
    else if (pkg.bin && typeof pkg.bin === "object") entryPaths.push(...Object.values(pkg.bin));
    for (const p of entryPaths) {
      entryModules.add(moduleId(root, path.resolve(root, p.replace(/^\.\//, "").replace(/^dist\//, "src/"))));
      entryModules.add(`module:${p.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "").replace(/^\.\//, "")}`);
    }
  } catch { /* no package.json */ }

  const exportSites: ExportSite[] = [];
  const importedNames = new Set<string>();
  const fullyUsedModules = new Set<string>();

  for (const file of files) {
    let content = "";
    try { content = await readFile(file, "utf8"); } catch { continue; }
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const mod = moduleId(root, file);
    const isRootIndex = /^(src\/)?index\.(tsx?|jsx?|mjs|cjs)$/.test(rel);
    const isDts = rel.endsWith(".d.ts");

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Collect this file's exports (skip test files, entry points, declaration files).
      if (!isTestFile(rel) && !isRootIndex && !isDts && !entryModules.has(mod)) {
        const decl = line.match(EXPORT_DECL);
        if (decl) exportSites.push({ name: decl[1], moduleId: mod, file: rel, line: i + 1 });
        const list = line.match(EXPORT_LIST);
        if (list) for (const n of exportedNames(list[1])) exportSites.push({ name: n, moduleId: mod, file: rel, line: i + 1 });
      }

      // Re-exports consume names from, and fully use, the target module.
      const reList = line.match(REEXPORT_LIST);
      if (reList) {
        for (const n of originalNames(reList[1])) importedNames.add(n);
        const t = resolveModuleId(root, file, reList[2]); if (t) fullyUsedModules.add(t);
      }
      const reStar = line.match(REEXPORT_STAR);
      if (reStar) { const t = resolveModuleId(root, file, reStar[1]); if (t) fullyUsedModules.add(t); }
    }

    // File-wide (multi-line-tolerant) import scans.
    let m: RegExpExecArray | null;
    IMPORT_NAMED.lastIndex = 0;
    while ((m = IMPORT_NAMED.exec(content)) !== null) for (const n of originalNames(m[1])) importedNames.add(n);
    IMPORT_STAR.lastIndex = 0;
    while ((m = IMPORT_STAR.exec(content)) !== null) { const t = resolveModuleId(root, file, m[1]); if (t) fullyUsedModules.add(t); }
    DYNAMIC.lastIndex = 0;
    while ((m = DYNAMIC.exec(content)) !== null) { const t = resolveModuleId(root, file, m[1]); if (t) fullyUsedModules.add(t); }
  }

  const findings: GateFinding[] = [];
  const seen = new Set<string>();
  for (const site of exportSites) {
    if (fullyUsedModules.has(site.moduleId)) continue; // consumed wholesale elsewhere
    if (importedNames.has(site.name)) continue;        // imported by name somewhere
    const key = `${site.moduleId}#${site.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      severity: "warning",
      message: `Exported '${site.name}' in ${site.file} is never imported anywhere. Remove it or wire it up.`,
      file: site.file,
      line: site.line,
      evidence: `${site.file}:${site.line}`,
    });
  }

  const summary = findings.length > 0
    ? `${findings.length} export(s) appear unused (conservative — namespace/dynamic imports are treated as usage).`
    : "No unused exports detected.";
  return { gate: "dead-exports", status: statusFromFindings(findings), summary, findings };
}
