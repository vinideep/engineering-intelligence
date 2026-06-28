import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserIdentity {
  email: string;
  name: string;
  slug: string;
  isCI: boolean;
  gitHubUsername?: string;
  ideInUse: string[];
}

export interface GitHistorySignals {
  totalCommits: number;
  testCommitRatio: number;       // 0–1: fraction of commits that include a test file
  primaryDirs: string[];         // top-3 dirs by commit frequency
  primaryLanguage: string;       // most frequent file extension in commits
  usesConventionalCommits: boolean;
  avgLinesChanged: number;       // mean (additions + deletions) per commit
}

export interface EngPrefs {
  tests: string;                 // always | on-request | inferred-rarely
  implementationDepth: string;   // spike | standard | production-hardened
  typeStrictness: string;        // strict | moderate | pragmatic | unknown
  architectureBias: string;      // functional | oop | mixed | unknown
}

export interface UserProfile {
  identity: UserIdentity;
  gitSignals: GitHistorySignals;
  communicationStyle: {
    requestStyle: string;        // imperative | exploratory | question-driven | unknown
    responseDepth: string;       // terse | standard | detailed | unknown
    reasoningPreference: string; // show-diff-first | explain-then-diff | unknown
  };
  engineeringPreferences: EngPrefs;
  signalLog: Array<{ date: string; requestPattern: string; behavior: string; signal: string }>;
  generatedAt: string;
  sessionsObserved: number;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function tryGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15_000,
    }).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Identity resolution
// ---------------------------------------------------------------------------

function emailToSlug(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "local_user";
}

function detectCI(): boolean {
  const vars = ["CI", "GITHUB_ACTIONS", "GITLAB_CI", "JENKINS_URL", "CI_SERVER", "TRAVIS", "CIRCLECI", "TEAMCITY_VERSION", "BUILDKITE"];
  return vars.some((v) => Boolean(process.env[v]));
}

function extractGitHubUsername(remoteUrl: string): string | undefined {
  const https = remoteUrl.match(/github\.com[/:]([\w-]+)\//);
  const ssh = remoteUrl.match(/github\.com:([\w-]+)\//);
  return (https ?? ssh)?.[1];
}

function detectIdesInUse(root: string): string[] {
  const candidates: Array<[string, string]> = [
    ["claude-code", ".claude"],
    ["cursor", ".cursor"],
    ["github-copilot", ".github/copilot-instructions.md"],
    ["gemini-cli", ".gemini"],
    ["commandcode", ".commandcode"],
    ["codex", ".codex"],
    ["antigravity", ".agent"],
  ];
  return candidates
    .filter(([, p]) => {
      try {
        require("node:fs").accessSync(path.join(root, p));
        return true;
      } catch {
        return false;
      }
    })
    .map(([ide]) => ide);
}

export function resolveIdentity(root: string): UserIdentity {
  const email = tryGit("config user.email", root) || `${process.env["USER"] ?? "user"}@local`;
  const name = tryGit("config user.name", root) || email.split("@")[0];
  const remoteUrl = tryGit("remote get-url origin", root);
  const gitHubUsername = remoteUrl ? extractGitHubUsername(remoteUrl) : undefined;

  let ideInUse: string[] = [];
  try { ideInUse = detectIdesInUse(root); } catch { /* non-fatal */ }

  return {
    email,
    name,
    slug: emailToSlug(email),
    isCI: detectCI(),
    gitHubUsername,
    ideInUse,
  };
}

// ---------------------------------------------------------------------------
// Git history signals
// ---------------------------------------------------------------------------

const TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|py|go|rs|rb|java|kt)$|_test\.(go|py|rs)$|Test\.(java|kt)$/;
const CONVENTIONAL_PATTERN = /^(feat|fix|chore|docs|style|refactor|test|build|ci|perf|revert)(\(.+\))?(!)?:/;

export function seedFromGitHistory(root: string, email: string): GitHistorySignals {
  // Limit to last 200 commits by this author to keep it fast
  const log = tryGit(
    `log --author=${JSON.stringify(email)} --name-only --format="COMMIT:%s" -200`,
    root,
  );

  if (!log) {
    return {
      totalCommits: 0,
      testCommitRatio: 0,
      primaryDirs: [],
      primaryLanguage: "unknown",
      usesConventionalCommits: false,
      avgLinesChanged: 0,
    };
  }

  // Parse into commits: [{subject, files[]}]
  const commits: Array<{ subject: string; files: string[] }> = [];
  let current: { subject: string; files: string[] } | null = null;
  for (const line of log.split("\n")) {
    if (line.startsWith("COMMIT:")) {
      if (current) commits.push(current);
      current = { subject: line.slice("COMMIT:".length).trim(), files: [] };
    } else if (current && line.trim()) {
      current.files.push(line.trim());
    }
  }
  if (current) commits.push(current);

  const totalCommits = commits.length;
  if (totalCommits === 0) {
    return { totalCommits: 0, testCommitRatio: 0, primaryDirs: [], primaryLanguage: "unknown", usesConventionalCommits: false, avgLinesChanged: 0 };
  }

  // Test commit ratio
  const testCommits = commits.filter((c) => c.files.some((f) => TEST_PATTERN.test(f))).length;
  const testCommitRatio = testCommits / totalCommits;

  // Primary directories (top 3 by file frequency)
  const dirCount = new Map<string, number>();
  const extCount = new Map<string, number>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const dir = file.split("/")[0] ?? file;
      dirCount.set(dir, (dirCount.get(dir) ?? 0) + 1);
      const ext = path.extname(file).slice(1);
      if (ext) extCount.set(ext, (extCount.get(ext) ?? 0) + 1);
    }
  }
  const primaryDirs = [...dirCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dir]) => dir);

  // Primary language
  const langMap: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
    mjs: "JavaScript", py: "Python", go: "Go", rs: "Rust", rb: "Ruby",
    java: "Java", kt: "Kotlin", swift: "Swift", cs: "C#", cpp: "C++", c: "C",
  };
  const topExt = [...extCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const primaryLanguage = langMap[topExt] ?? (topExt ? topExt.toUpperCase() : "unknown");

  // Conventional commits ratio
  const conventionalCount = commits.filter((c) => CONVENTIONAL_PATTERN.test(c.subject)).length;
  const usesConventionalCommits = conventionalCount / totalCommits > 0.6;

  // Avg lines changed (numstat — separate call, skip on timeout)
  let avgLinesChanged = 0;
  const numstat = tryGit(
    `log --author=${JSON.stringify(email)} --numstat --format="" -100`,
    root,
  );
  if (numstat) {
    let totalLines = 0;
    let lineCount = 0;
    for (const line of numstat.split("\n")) {
      const parts = line.trim().split("\t");
      if (parts.length >= 2) {
        const adds = parseInt(parts[0] ?? "0", 10);
        const dels = parseInt(parts[1] ?? "0", 10);
        if (!isNaN(adds) && !isNaN(dels)) {
          totalLines += adds + dels;
          lineCount++;
        }
      }
    }
    avgLinesChanged = lineCount > 0 ? Math.round(totalLines / lineCount) : 0;
  }

  return { totalCommits, testCommitRatio, primaryDirs, primaryLanguage, usesConventionalCommits, avgLinesChanged };
}

// ---------------------------------------------------------------------------
// Profile inference
// ---------------------------------------------------------------------------

function inferEngPrefs(signals: GitHistorySignals): EngPrefs {
  const tests =
    signals.testCommitRatio > 0.6 ? "always" :
    signals.testCommitRatio > 0.2 ? "on-request" : "inferred-rarely";

  const implementationDepth =
    signals.avgLinesChanged > 300 ? "production-hardened" :
    signals.avgLinesChanged > 80  ? "standard" : "spike";

  return {
    tests,
    implementationDepth,
    typeStrictness: "unknown",
    architectureBias: "unknown",
  };
}

// ---------------------------------------------------------------------------
// Profile serialisation
// ---------------------------------------------------------------------------

function renderProfile(profile: UserProfile): string {
  const { identity, gitSignals, communicationStyle, engineeringPreferences, signalLog } = profile;

  const testRatioPct = Math.round(gitSignals.testCommitRatio * 100);
  const commitStyle = gitSignals.usesConventionalCommits ? "conventional commits" : "freeform";
  const sizeLabel =
    gitSignals.avgLinesChanged > 300 ? "large (>300 lines avg)" :
    gitSignals.avgLinesChanged > 80  ? "medium (80-300 lines avg)" :
    gitSignals.avgLinesChanged > 0   ? "small (<80 lines avg)" : "unknown";

  const signalRows = signalLog.length > 0
    ? signalLog.map((e) => `| ${e.date} | ${e.requestPattern} | ${e.behavior} | ${e.signal} |`).join("\n")
    : "| — | — | — | — |";

  return `# User Intelligence Profile
<!-- generated: ${profile.generatedAt} | sessions: ${profile.sessionsObserved} | identity: ${identity.email} -->

## Identity

| Field | Value |
|---|---|
| Email | ${identity.email} |
| Name | ${identity.name} |
| GitHub | ${identity.gitHubUsername ?? "—"} |
| CI session | ${identity.isCI ? "yes — personal profile skipped" : "no"} |
| IDEs detected | ${identity.ideInUse.length > 0 ? identity.ideInUse.join(", ") : "—"} |

## Git-Derived Signals
<!-- auto-computed from git history — no LLM needed -->

| Signal | Value | Confidence | Evidence |
|---|---|---|---|
| Total commits (last 200) | ${gitSignals.totalCommits} | verified | git log |
| Test file inclusion | ${testRatioPct}% of commits | verified | ${testRatioPct}% include *.test.* / *.spec.* |
| Primary working areas | ${gitSignals.primaryDirs.join(", ") || "—"} | verified | git log file paths |
| Primary language | ${gitSignals.primaryLanguage} | verified | file extension frequency |
| Commit message style | ${commitStyle} | verified | ${gitSignals.usesConventionalCommits ? ">60%" : "<60%"} match conventional format |
| Avg commit size | ${sizeLabel} | verified | git numstat |

## Engineering Preferences
<!-- seeds from git signals; refined by user-intelligence-engine after each session -->

| Dimension | Value | Confidence | Source |
|---|---|---|---|
| Tests | ${engineeringPreferences.tests} | ${gitSignals.testCommitRatio > 0 ? "git" : "default"} | ${testRatioPct}% test commit ratio |
| Implementation depth | ${engineeringPreferences.implementationDepth} | git | avg ${gitSignals.avgLinesChanged} lines/commit |
| Type strictness | ${engineeringPreferences.typeStrictness} | none | not yet observed |
| Architecture bias | ${engineeringPreferences.architectureBias} | none | not yet observed |

## Communication Style
<!-- starts unknown; user-intelligence-engine updates after each interaction -->

| Dimension | Value | Confidence |
|---|---|---|
| Request style | ${communicationStyle.requestStyle} | none |
| Response depth | ${communicationStyle.responseDepth} | none |
| Reasoning preference | ${communicationStyle.reasoningPreference} | none |

## Active Predictions
<!-- LLM reads this block before every workflow to calibrate behaviour -->

- **Test generation**: ${engineeringPreferences.tests}
- **Implementation depth**: ${engineeringPreferences.implementationDepth}
- **Response format**: ${communicationStyle.responseDepth === "terse" ? "show diff first, explanation after" : "standard"}
- **Type safety**: ${engineeringPreferences.typeStrictness === "strict" ? "always strict, no any" : "follow project conventions"}

## Interaction Signal Log
<!-- user-intelligence-engine appends one row per workflow session -->

| Date | Request Pattern | Behavior | Signal Learned |
|---|---|---|---|
${signalRows}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const EI_GITIGNORE_ENTRY = "memory/users/\n";

async function ensureEiGitignore(eiDir: string): Promise<void> {
  const gitignorePath = path.join(eiDir, ".gitignore");
  let existing = "";
  try { existing = await readFile(gitignorePath, "utf8"); } catch { /* new file */ }
  if (!existing.includes("memory/users/")) {
    await writeFile(gitignorePath, existing + (existing.endsWith("\n") || !existing ? "" : "\n") + EI_GITIGNORE_ENTRY, "utf8");
  }
}

export async function runUserProfile(root: string): Promise<{ profile: UserProfile; profilePath: string; isCI: boolean }> {
  const identity = resolveIdentity(root);

  if (identity.isCI) {
    return {
      profile: buildEmptyProfile(identity),
      profilePath: "",
      isCI: true,
    };
  }

  const eiDir = path.join(root, ".engineering-intelligence");
  const userDir = path.join(eiDir, "memory", "users", identity.slug);
  const profilePath = path.join(userDir, "user-intelligence.md");

  // Ensure .engineering-intelligence/.gitignore ignores users/
  await mkdir(eiDir, { recursive: true });
  await ensureEiGitignore(eiDir);

  // Load existing profile if present, otherwise seed fresh from git
  let existing: Partial<UserProfile> = {};
  try {
    const raw = await readFile(profilePath, "utf8");
    existing = parseExistingProfile(raw);
  } catch { /* first run */ }

  const gitSignals = seedFromGitHistory(root, identity.email);
  const engPrefs = existing.engineeringPreferences ?? inferEngPrefs(gitSignals);

  const profile: UserProfile = {
    identity,
    gitSignals,
    communicationStyle: existing.communicationStyle ?? {
      requestStyle: "unknown",
      responseDepth: "unknown",
      reasoningPreference: "unknown",
    },
    engineeringPreferences: engPrefs,
    signalLog: existing.signalLog ?? [],
    generatedAt: new Date().toISOString(),
    sessionsObserved: existing.sessionsObserved ?? 0,
  };

  await mkdir(userDir, { recursive: true });
  await writeFile(profilePath, renderProfile(profile), "utf8");

  return { profile, profilePath: path.relative(root, profilePath), isCI: false };
}

function buildEmptyProfile(identity: UserIdentity): UserProfile {
  return {
    identity,
    gitSignals: { totalCommits: 0, testCommitRatio: 0, primaryDirs: [], primaryLanguage: "unknown", usesConventionalCommits: false, avgLinesChanged: 0 },
    communicationStyle: { requestStyle: "unknown", responseDepth: "unknown", reasoningPreference: "unknown" },
    engineeringPreferences: { tests: "on-request", implementationDepth: "standard", typeStrictness: "unknown", architectureBias: "unknown" },
    signalLog: [],
    generatedAt: new Date().toISOString(),
    sessionsObserved: 0,
  };
}

function parseExistingProfile(raw: string): Partial<UserProfile> {
  // Extract sessions observed from comment
  const sessionsMatch = raw.match(/sessions:\s*(\d+)/);
  const sessionsObserved = sessionsMatch ? parseInt(sessionsMatch[1], 10) : 0;

  // Extract signal log rows
  const logMatch = raw.match(/## Interaction Signal Log[\s\S]*?\n\| Date[\s\S]*?\n((?:\|[^\n]+\n)*)/);
  const signalLog: UserProfile["signalLog"] = [];
  if (logMatch?.[1]) {
    for (const line of logMatch[1].split("\n")) {
      const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 4 && cols[0] !== "—") {
        signalLog.push({ date: cols[0]!, requestPattern: cols[1]!, behavior: cols[2]!, signal: cols[3]! });
      }
    }
  }

  // Extract engineering preferences
  const prefSection = raw.match(/## Engineering Preferences[\s\S]*?(?=## |$)/)?.[0] ?? "";
  const prefRow = (dim: string) => {
    const m = prefSection.match(new RegExp(`\\|\\s*${dim}\\s*\\|\\s*([^|]+)\\|`));
    return m?.[1]?.trim() ?? "unknown";
  };

  const communicationSection = raw.match(/## Communication Style[\s\S]*?(?=## |$)/)?.[0] ?? "";
  const styleRow = (dim: string) => {
    const m = communicationSection.match(new RegExp(`\\|\\s*${dim}\\s*\\|\\s*([^|]+)\\|`));
    return m?.[1]?.trim() ?? "unknown";
  };

  return {
    sessionsObserved,
    signalLog,
    engineeringPreferences: {
      tests: prefRow("Tests"),
      implementationDepth: prefRow("Implementation depth"),
      typeStrictness: prefRow("Type strictness"),
      architectureBias: prefRow("Architecture bias"),
    },
    communicationStyle: {
      requestStyle: styleRow("Request style"),
      responseDepth: styleRow("Response depth"),
      reasoningPreference: styleRow("Reasoning preference"),
    },
  };
}

export async function loadUserProfile(root: string): Promise<{ path: string; content: string } | null> {
  if (detectCI()) return null;
  const identity = resolveIdentity(root);
  const profilePath = path.join(root, ".engineering-intelligence", "memory", "users", identity.slug, "user-intelligence.md");
  try {
    const content = await readFile(profilePath, "utf8");
    return { path: path.relative(root, profilePath), content };
  } catch {
    return null;
  }
}
