/**
 * api-diff gate — extracts the HTTP API surface (framework route registrations,
 * NestJS-style method decorators, and OpenAPI path/method pairs) from the working
 * tree and from a git base ref, then flags endpoints that were REMOVED or whose
 * method changed. Removing or renaming a public endpoint is the canonical breaking
 * change; catching it before merge is the api-backward-compatibility promise made real.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  gitAvailable,
  gitChangedFiles,
  gitShow,
  type GateFinding,
  type GateResult,
  statusFromFindings,
} from "./index.js";

const METHODS = "get|post|put|patch|delete|options|head|all";

// app.get('/x') / router.post("/y") / api.delete(`/z`)
const ROUTE_CALL = new RegExp(
  `\\b(?:app|router|server|fastify|api|route|r)\\.(${METHODS})\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]`,
  "gi",
);
// NestJS / decorator style: @Get('/x'), @Post()
const ROUTE_DECORATOR = new RegExp(`@(${METHODS})\\s*\\(\\s*(?:['"\\\`]([^'"\\\`]*)['"\\\`])?`, "gi");

function isOpenApiFile(rel: string): boolean {
  return /(^|\/)(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(rel);
}
function isCodeFile(rel: string): boolean {
  return /\.(tsx?|jsx?|mjs|cjs)$/.test(rel);
}

/** Extract a normalized set of `METHOD path` endpoints from one file's contents. */
export function extractApiSurface(content: string, relPath: string): Set<string> {
  const surface = new Set<string>();
  if (isOpenApiFile(relPath)) {
    if (relPath.toLowerCase().endsWith(".json")) {
      try {
        const doc = JSON.parse(content) as { paths?: Record<string, Record<string, unknown>> };
        for (const [p, ops] of Object.entries(doc.paths ?? {})) {
          for (const method of Object.keys(ops ?? {})) {
            if (new RegExp(`^(${METHODS})$`, "i").test(method)) surface.add(`${method.toUpperCase()} ${p}`);
          }
        }
      } catch { /* malformed JSON — nothing to compare */ }
      return surface;
    }
    // YAML: best-effort — a path key line, then indented method keys beneath it.
    let currentPath: string | null = null;
    for (const raw of content.split("\n")) {
      const pathMatch = raw.match(/^\s{0,4}(\/[^\s:]*)\s*:\s*$/);
      if (pathMatch) { currentPath = pathMatch[1]; continue; }
      const methodMatch = raw.match(new RegExp(`^\\s{2,}(${METHODS})\\s*:`, "i"));
      if (methodMatch && currentPath) surface.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
    return surface;
  }

  if (isCodeFile(relPath)) {
    let m: RegExpExecArray | null;
    ROUTE_CALL.lastIndex = 0;
    while ((m = ROUTE_CALL.exec(content)) !== null) surface.add(`${m[1].toUpperCase()} ${m[2]}`);
    ROUTE_DECORATOR.lastIndex = 0;
    while ((m = ROUTE_DECORATOR.exec(content)) !== null) surface.add(`${m[1].toUpperCase()} ${m[2] ?? ""}`.trim());
  }
  return surface;
}

export async function apiDiffGate(root: string, base: string): Promise<GateResult> {
  if (!(await gitAvailable(root))) {
    return { gate: "api-diff", status: "pass", summary: "git unavailable — cannot diff API surface.", findings: [{ severity: "info", message: "Not a git repository; api-diff needs a base ref to compare against." }] };
  }

  const changed = (await gitChangedFiles(root, base)).filter((f) => isCodeFile(f) || isOpenApiFile(f));
  if (changed.length === 0) {
    return { gate: "api-diff", status: "pass", summary: `No API-bearing files changed vs ${base}.`, findings: [] };
  }

  const findings: GateFinding[] = [];
  let removed = 0;
  let added = 0;

  for (const rel of changed) {
    const baseContent = await gitShow(root, base, rel);
    let headContent: string | null = null;
    try { headContent = await readFile(path.join(root, rel), "utf8"); } catch { headContent = null; }

    const baseSurface = baseContent ? extractApiSurface(baseContent, rel) : new Set<string>();
    const headSurface = headContent ? extractApiSurface(headContent, rel) : new Set<string>();

    for (const ep of baseSurface) {
      if (!headSurface.has(ep)) {
        removed++;
        findings.push({
          severity: "error",
          message: `Endpoint removed or changed: ${ep} (in ${rel}). This is a breaking change — version the API or restore compatibility.`,
          file: rel,
          evidence: `${base}:${rel}`,
        });
      }
    }
    for (const ep of headSurface) {
      if (!baseSurface.has(ep)) {
        added++;
        findings.push({ severity: "info", message: `Endpoint added: ${ep} (in ${rel}).`, file: rel });
      }
    }
  }

  const summary = removed > 0
    ? `${removed} endpoint(s) removed/changed (breaking), ${added} added vs ${base}.`
    : `No breaking API changes vs ${base} (${added} endpoint(s) added).`;
  return { gate: "api-diff", status: statusFromFindings(findings), summary, findings };
}
