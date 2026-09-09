import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { loadEiConfig, type ProjectFilesConfig } from "../config/index.js";

export type PolicySource = "explicit-include" | "explicit-exclude" | "eiignore" | "gitignore" | "built-in" | "default" | "safety";

export interface FileDecision {
  path: string;
  included: boolean;
  source: PolicySource;
  pattern?: string;
  reason: string;
}

interface IgnoreRule {
  source: "eiignore" | "gitignore";
  pattern: string;
  include: boolean;
  regex: RegExp;
}

export interface CollectProjectFilesOptions {
  accept?: (relativePath: string) => boolean;
  roots?: string[];
}

// These paths are never part of the source universe, even when an ignore file
// re-includes them. Generated adapter instructions are retained on disk, but
// indexing them as application source causes provider output to outrank the
// repository it is meant to describe.
const SAFETY_EXCLUDES = [
  "node_modules/", ".git/", ".engineering-intelligence/", "dist/", "build/", "coverage/",
  "__pycache__/", ".venv/", "venv/", "vendor/", "target/", ".gradle/", ".next/", ".cache/",
  ".agent/", ".agents/", ".claude/", ".cursor/", ".codex/", ".gemini/", ".commandcode/",
  ".github/skills/", ".github/agents/", ".github/prompts/",
];

const SECRET_PATTERNS = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:id_rsa|id_ed25519|credentials)(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i,
];

function slash(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globRegex(rawPattern: string): RegExp {
  let pattern = slash(rawPattern.trim());
  const directory = pattern.endsWith("/");
  if (directory) pattern = pattern.slice(0, -1);
  const anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        while (pattern[i + 1] === "*") i += 1;
        if (pattern[i + 1] === "/") {
          i += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (ch === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(ch);
    }
  }
  const prefix = anchored || pattern.includes("/") ? "^" : "(?:^|/)";
  const suffix = directory ? "(?:/.*)?$" : "$";
  return new RegExp(`${prefix}${source}${suffix}`);
}

function matches(pattern: string, relativePath: string): boolean {
  try { return globRegex(pattern).test(slash(relativePath)); } catch { return false; }
}

async function readRules(root: string, file: string, source: IgnoreRule["source"]): Promise<IgnoreRule[]> {
  try {
    const text = await readFile(path.join(root, file), "utf8");
    const rules: IgnoreRule[] = [];
    for (const raw of text.split("\n")) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const include = trimmed.startsWith("!");
      const pattern = include ? trimmed.slice(1) : trimmed;
      if (!pattern) continue;
      rules.push({ source, pattern, include, regex: globRegex(pattern) });
    }
    return rules;
  } catch {
    return [];
  }
}

function lastRule(rules: IgnoreRule[], relativePath: string): IgnoreRule | undefined {
  let result: IgnoreRule | undefined;
  for (const rule of rules) if (rule.regex.test(relativePath)) result = rule;
  return result;
}

export class ProjectFilePolicy {
  readonly root: string;
  readonly config: ProjectFilesConfig;
  private readonly eiRules: IgnoreRule[];
  private readonly gitRules: IgnoreRule[];
  private readonly realRoot: string;

  private constructor(root: string, realRoot: string, config: ProjectFilesConfig, eiRules: IgnoreRule[], gitRules: IgnoreRule[]) {
    this.root = root;
    this.realRoot = realRoot;
    this.config = config;
    this.eiRules = eiRules;
    this.gitRules = gitRules;
  }

  static async load(root: string): Promise<ProjectFilePolicy> {
    const resolved = path.resolve(root);
    const [realRoot, config, eiRules, gitRules] = await Promise.all([
      realpath(resolved).catch(() => resolved),
      loadEiConfig(resolved),
      readRules(resolved, ".eiignore", "eiignore"),
      readRules(resolved, ".gitignore", "gitignore"),
    ]);
    return new ProjectFilePolicy(resolved, realRoot, config.projectFiles, eiRules, gitRules);
  }

  explain(inputPath: string, options: { directory?: boolean; realPath?: string } = {}): FileDecision {
    const absolute = path.resolve(this.root, inputPath);
    const relative = slash(path.relative(this.root, absolute));
    if (!relative || relative === ".") {
      return { path: relative, included: true, source: "default", reason: "repository root" };
    }
    if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
      return { path: relative, included: false, source: "safety", reason: "path escapes repository root" };
    }
    if (options.realPath) {
      const normalizedReal = path.resolve(options.realPath);
      if (normalizedReal !== this.realRoot && !normalizedReal.startsWith(`${this.realRoot}${path.sep}`)) {
        return { path: relative, included: false, source: "safety", reason: "symlink target escapes repository root" };
      }
    }
    if (SECRET_PATTERNS.some((pattern) => pattern.test(relative))) {
      return { path: relative, included: false, source: "safety", reason: "secret-bearing file pattern" };
    }

    const pathForRules = options.directory && !relative.endsWith("/") ? `${relative}/` : relative;
    const safetyExclusion = SAFETY_EXCLUDES.find((pattern) => matches(pattern, pathForRules));
    if (safetyExclusion) {
      return { path: relative, included: false, source: "safety", pattern: safetyExclusion, reason: "generated, vendored, cache, or EI provider path" };
    }
    const explicitInclude = [...(this.config.include ?? [])].reverse().find((pattern) => matches(pattern, pathForRules));
    if (explicitInclude) {
      return { path: relative, included: true, source: "explicit-include", pattern: explicitInclude, reason: "matched projectFiles.include" };
    }
    const explicitExclude = [...(this.config.exclude ?? [])].reverse().find((pattern) => matches(pattern, pathForRules));
    if (explicitExclude) {
      return { path: relative, included: false, source: "explicit-exclude", pattern: explicitExclude, reason: "matched projectFiles.exclude" };
    }

    const ei = lastRule(this.eiRules, pathForRules);
    if (ei) {
      return { path: relative, included: ei.include, source: "eiignore", pattern: ei.pattern, reason: ei.include ? "re-included by .eiignore" : "excluded by .eiignore" };
    }
    const git = lastRule(this.gitRules, pathForRules);
    if (git) {
      return { path: relative, included: git.include, source: "gitignore", pattern: git.pattern, reason: git.include ? "re-included by .gitignore" : "excluded by .gitignore" };
    }
    return { path: relative, included: true, source: "default", reason: "no exclusion rule matched" };
  }

  async explainExisting(inputPath: string): Promise<FileDecision> {
    const absolute = path.resolve(this.root, inputPath);
    try {
      const [info, real] = await Promise.all([lstat(absolute), realpath(absolute)]);
      return this.explain(inputPath, { directory: info.isDirectory(), realPath: real });
    } catch {
      return this.explain(inputPath);
    }
  }

  configuredRoots(override?: string[]): string[] {
    const roots = override ?? this.config.roots;
    return roots && roots.length > 0 ? roots : ["."];
  }
}

export async function collectProjectFiles(
  policy: ProjectFilePolicy,
  options: CollectProjectFilesOptions = {},
): Promise<string[]> {
  const files: string[] = [];
  const seenDirs = new Set<string>();
  const walk = async (directory: string): Promise<void> => {
    let realDirectory: string;
    try { realDirectory = await realpath(directory); } catch { return; }
    if (seenDirs.has(realDirectory)) return;
    seenDirs.add(realDirectory);
    const dirDecision = policy.explain(directory, { directory: true, realPath: realDirectory });
    if (!dirDecision.included && path.resolve(directory) !== policy.root) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      let real: string;
      try { real = await realpath(absolute); } catch { continue; }
      const decision = policy.explain(absolute, { directory: entry.isDirectory(), realPath: real });
      if (!decision.included) continue;
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && (!options.accept || options.accept(decision.path))) files.push(absolute);
    }
  };

  for (const root of policy.configuredRoots(options.roots)) {
    const decision = await policy.explainExisting(root);
    if (!decision.included) continue;
    const absolute = path.resolve(policy.root, root);
    let info;
    try { info = await lstat(absolute); } catch { continue; }
    if (info.isDirectory()) await walk(absolute);
    else if (info.isFile() && (!options.accept || options.accept(decision.path))) files.push(absolute);
  }
  return [...new Set(files)].sort();
}
