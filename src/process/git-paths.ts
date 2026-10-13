/**
 * Git path helpers shared by every caller that turns git output into project
 * file paths.
 *
 * Two traps make naive parsing wrong:
 *  - `git status --porcelain` ALWAYS prints paths relative to the repository top
 *    level, even when run from a subdirectory. When the analysed root is a
 *    package inside a monorepo (`repo/packages/api`), those paths must be mapped
 *    back to the root or every downstream `path.join(root, p)` misses.
 *  - The porcelain status column is fixed-width (`XY path`); trimming the whole
 *    output strips the leading space of the first line and shifts its path by one
 *    character (` M src/a.ts` → `rc/a.ts`).
 *
 * `git diff` / `git log` accept `--relative`, which both scopes output to the
 * current directory and makes paths relative to it, so they need no mapping.
 */

import { runProcess, runProcessSync } from "./index.js";

/** Unquote a C-style quoted git path (`"a b.ts"`, `"caf\303\251.ts"`). */
function unquote(p: string): string {
  if (!(p.startsWith('"') && p.endsWith('"'))) return p;
  const body = p.slice(1, -1);
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") { bytes.push(...Buffer.from(ch, "utf8")); continue; }
    const next = body[++i];
    if (next === undefined) break;
    if (/[0-7]/.test(next)) {
      const oct = body.slice(i, i + 3);
      bytes.push(parseInt(oct, 8));
      i += oct.length - 1;
      continue;
    }
    const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", a: "\x07", b: "\b", f: "\f", v: "\v" };
    bytes.push(...Buffer.from(map[next] ?? next, "utf8"));
  }
  return Buffer.from(bytes).toString("utf8");
}

/**
 * Parse `git status --porcelain` (v1) output into paths relative to the analysed
 * root. `prefix` is `git rev-parse --show-prefix` for that root ("" at top level).
 * Renames contribute BOTH sides so callers can evict the old path; entries
 * outside the prefix are dropped.
 */
export function parsePorcelainPaths(stdout: string, prefix = ""): string[] {
  const out: string[] = [];
  const pre = prefix.replace(/\\/g, "/");
  for (const line of stdout.split("\n")) {
    if (line.length < 4 || !line.replace(/\r$/, "").trim()) continue;
    const raw = line.replace(/\r$/, "").slice(3);
    const parts = raw.includes(" -> ") ? raw.split(" -> ") : [raw];
    for (const part of parts) {
      const p = unquote(part.trim()).replace(/\\/g, "/");
      if (!p) continue;
      if (pre) {
        if (!p.startsWith(pre)) continue;
        out.push(p.slice(pre.length));
      } else {
        out.push(p);
      }
    }
  }
  return out;
}

/** Parse `--name-only` output (diff/log) — one path per line, possibly quoted. */
export function parseNameOnly(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => unquote(line.replace(/\r$/, "").trim()).replace(/\\/g, "/"))
    .filter(Boolean);
}

/** `git rev-parse --show-prefix` for `root`, or "" when unavailable. */
export function gitPrefixSync(root: string): string {
  const result = runProcessSync({ command: "git", args: ["rev-parse", "--show-prefix"], cwd: root, timeoutMs: 10_000 });
  return result.exitCode === 0 ? result.stdout.trim() : "";
}

export async function gitPrefix(root: string): Promise<string> {
  const result = await runProcess({ command: "git", args: ["rev-parse", "--show-prefix"], cwd: root });
  return result.exitCode === 0 ? result.stdout.trim() : "";
}

/** Uncommitted (staged, unstaged, untracked) paths relative to `root`. */
export function gitStatusPathsSync(root: string): string[] | null {
  const status = runProcessSync({ command: "git", args: ["status", "--porcelain", "--untracked-files=all", "--", "."], cwd: root, timeoutMs: 15_000 });
  if (status.exitCode !== 0) return null;
  return parsePorcelainPaths(status.stdout, gitPrefixSync(root));
}

export async function gitStatusPaths(root: string): Promise<string[] | null> {
  const status = await runProcess({ command: "git", args: ["status", "--porcelain", "--untracked-files=all", "--", "."], cwd: root, maxBuffer: 10 * 1024 * 1024 });
  if (status.exitCode !== 0) return null;
  return parsePorcelainPaths(status.stdout, await gitPrefix(root));
}
