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

// Route registration on a server-ish receiver. `api`, `route` and bare `r` were
// removed deliberately: `api.get('/users')` in an axios wrapper and
// `r.get('/x')` in a test helper are HTTP CLIENT calls, and treating them as
// endpoints made this gate unsafe to block on.
const ROUTE_CALL = new RegExp(
  `\\b(?:app|router|server|fastify)\\.(${METHODS})\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]`,
  "gi",
);
// NestJS / decorator style: @Get('/x'), @Post()
const ROUTE_DECORATOR = new RegExp(`@(${METHODS})\\s*\\(\\s*(?:['"\\\`]([^'"\\\`]*)['"\\\`])?`, "gi");

/**
 * Only trust route-call syntax in a file that actually constructs or imports a
 * server framework. Without this anchor, any object with `.get()` reads as a
 * router.
 */
const FRAMEWORK_MARKER =
  /\b(express|fastify|koa|hapi|@nestjs\/|next\/server)\b|\b(?:express|Fastify|Router|createServer)\s*\(/;

function isOpenApiFile(rel: string): boolean {
  return /(^|\/)(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(rel);
}
function isCodeFile(rel: string): boolean {
  return /\.(tsx?|jsx?|mjs|cjs)$/.test(rel);
}

function withoutComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n\r]*/gm, "$1");
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
    const executable = withoutComments(content);
    let m: RegExpExecArray | null;
    // Fresh regexes per call: `g` regexes carry a mutable lastIndex and this is
    // invoked repeatedly (base and head, per file).
    if (FRAMEWORK_MARKER.test(executable)) {
      const routeCall = new RegExp(ROUTE_CALL.source, "gi");
      while ((m = routeCall.exec(executable)) !== null) surface.add(`${m[1].toUpperCase()} ${m[2]}`);
    }
    const decorator = new RegExp(ROUTE_DECORATOR.source, "gi");
    while ((m = decorator.exec(executable)) !== null) surface.add(`${m[1].toUpperCase()} ${m[2] ?? ""}`.trim());
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

  // Union the surface across ALL changed files before comparing. Comparing per
  // file reports a false breaking change whenever a route simply moves between
  // files — fatal for a gate that is meant to block a merge.
  const baseSurface = new Map<string, string>(); // endpoint -> file it was found in
  const headSurface = new Map<string, string>();

  for (const rel of changed) {
    const baseContent = await gitShow(root, base, rel);
    if (baseContent) {
      for (const ep of extractApiSurface(baseContent, rel)) if (!baseSurface.has(ep)) baseSurface.set(ep, rel);
    }
    let headContent: string | null = null;
    try { headContent = await readFile(path.join(root, rel), "utf8"); } catch { headContent = null; }
    if (headContent) {
      for (const ep of extractApiSurface(headContent, rel)) if (!headSurface.has(ep)) headSurface.set(ep, rel);
    }
  }

  let removed = 0;
  let added = 0;
  for (const [ep, rel] of baseSurface) {
    if (!headSurface.has(ep)) {
      removed++;
      findings.push({
        severity: "error",
        message: `Endpoint removed or changed: ${ep} (was in ${rel}). This is a breaking change — version the API or restore compatibility.`,
        file: rel,
        evidence: `${base}:${rel}`,
      });
    }
  }
  for (const [ep, rel] of headSurface) {
    if (!baseSurface.has(ep)) {
      added++;
      findings.push({ severity: "info", message: `Endpoint added: ${ep} (in ${rel}).`, file: rel });
    }
  }

  const summary = removed > 0
    ? `${removed} endpoint(s) removed/changed (breaking), ${added} added vs ${base}.`
    : `No breaking API changes vs ${base} (${added} endpoint(s) added).`;
  return { gate: "api-diff", status: statusFromFindings(findings), summary, findings };
}
