#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { isIdeId } from "../adapters/index.js";
import { install, uninstall, update } from "../installer/index.js";
import { doctor } from "../validation/index.js";
import { generateDashboardHTML } from "../visualizer/index.js";
import { IDE_IDS, type FileAction, type IdeId, type OperationResult } from "../types.js";

type Command = "install" | "update" | "doctor" | "uninstall" | "visualize" | "create" | "map" | "mcp" | "freshness" | "git-analysis" | "user-profile" | "impact" | "who-calls" | "verify" | "preflight" | "postflight" | "evidence-record" | "evidence-check";

const COMMANDS: Command[] = ["install", "create", "update", "doctor", "uninstall", "visualize", "map", "mcp", "freshness", "git-analysis", "user-profile", "impact", "who-calls", "verify", "preflight", "postflight", "evidence-record", "evidence-check"];

interface Options {
  command: Command;
  root: string;
  ides: IdeId[];
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  json: boolean;
  openBrowser: boolean;
  graphType: string;
  update_: boolean;
  files: string[];
  threshold: number;
  window: number;
  strict: boolean;
  transitive: boolean;
  intent: string;
  id: string;
  positionals: string[];
}

async function packageVersion(): Promise<string> {
  const packageJson = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { version: string };
  return parsed.version;
}

function usage(): string {
  return `engineering-intelligence

Install engineering intelligence orchestration assets for AI coding IDEs.
Build a real dependency graph. Start an MCP server for tool-based queries.

Usage:
  engineering-intelligence install [path] [--ide <id>...] [--yes] [--dry-run] [--force]
  engineering-intelligence create [path] [--ide <id>...] [--yes]
  engineering-intelligence update [path] [--dry-run] [--force]
  engineering-intelligence doctor [path] [--json]
  engineering-intelligence uninstall [path] [--dry-run] [--force]
  engineering-intelligence visualize [path] [--open]
  engineering-intelligence map [path] [--type dependency] [--update] [--files a,b,c]
  engineering-intelligence mcp [path]
  engineering-intelligence impact <file...> [--json]
  engineering-intelligence who-calls <symbol> [--transitive] [--json]
  engineering-intelligence verify [path] [--strict] [--json]
  engineering-intelligence preflight --intent "<summary>" [file...] [--json]
  engineering-intelligence postflight [--id <flight>] [--strict] [--json]
  engineering-intelligence evidence-record [path]
  engineering-intelligence evidence-check [path] [--strict] [--json]
  engineering-intelligence freshness [path] [--threshold 60] [--json]
  engineering-intelligence git-analysis [path] [--window 90] [--json]
  engineering-intelligence user-profile [path] [--json]

Query commands (impact, who-calls) auto-refresh the graph against your working
tree before answering, so results always reflect the current code.

IDE ids: ${IDE_IDS.join(", ")}
`;
}

function parseArgs(args: string[]): Options {
  let command: Command = "install";
  const remaining = [...args];
  if (remaining[0] && (COMMANDS as string[]).includes(remaining[0])) {
    command = remaining.shift() as Command;
  }
  if (remaining.includes("--help") || remaining.includes("-h")) {
    output.write(usage());
    process.exit(0);
  }
  const ides: IdeId[] = [];
  let target: string | undefined;
  let yes = false;
  let dryRun = false;
  let force = false;
  let json = false;
  let openBrowser = false;
  let graphType = "dependency";
  let update_ = false;
  let files: string[] = [];
  let threshold = 60;
  let window_ = 90;
  let strict = false;
  let transitive = false;
  let intent = "";
  let id = "";
  const positionals: string[] = [];

  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index];
    if (arg === "--ide") {
      const value = remaining[++index];
      if (!value) throw new Error("--ide requires a value.");
      for (const ide of value.split(",")) {
        if (!isIdeId(ide)) throw new Error(`Unknown IDE "${ide}". Supported: ${IDE_IDS.join(", ")}.`);
        ides.push(ide);
      }
    } else if (arg.startsWith("--ide=")) {
      const value = arg.slice("--ide=".length);
      for (const ide of value.split(",")) {
        if (!isIdeId(ide)) throw new Error(`Unknown IDE "${ide}". Supported: ${IDE_IDS.join(", ")}.`);
        ides.push(ide);
      }
    } else if (arg === "--yes" || arg === "-y") {
      yes = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--open") {
      openBrowser = true;
    } else if (arg === "--type") {
      const value = remaining[++index];
      if (!value) throw new Error("--type requires a value.");
      graphType = value;
    } else if (arg.startsWith("--type=")) {
      graphType = arg.slice("--type=".length);
    } else if (arg === "--update") {
      update_ = true;
    } else if (arg === "--files") {
      const value = remaining[++index];
      if (!value) throw new Error("--files requires a value.");
      files = value.split(",").map((f) => f.trim()).filter(Boolean);
    } else if (arg.startsWith("--files=")) {
      files = arg.slice("--files=".length).split(",").map((f) => f.trim()).filter(Boolean);
    } else if (arg === "--threshold") {
      const value = remaining[++index];
      if (!value) throw new Error("--threshold requires a value.");
      threshold = parseInt(value, 10);
    } else if (arg.startsWith("--threshold=")) {
      threshold = parseInt(arg.slice("--threshold=".length), 10);
    } else if (arg === "--window") {
      const value = remaining[++index];
      if (!value) throw new Error("--window requires a value.");
      window_ = parseInt(value, 10);
    } else if (arg.startsWith("--window=")) {
      window_ = parseInt(arg.slice("--window=".length), 10);
    } else if (arg === "--strict") {
      strict = true;
    } else if (arg === "--transitive") {
      transitive = true;
    } else if (arg === "--intent") {
      const value = remaining[++index];
      if (!value) throw new Error("--intent requires a value.");
      intent = value;
    } else if (arg.startsWith("--intent=")) {
      intent = arg.slice("--intent=".length);
    } else if (arg === "--id") {
      const value = remaining[++index];
      if (!value) throw new Error("--id requires a value.");
      id = value;
    } else if (arg.startsWith("--id=")) {
      id = arg.slice("--id=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option "${arg}".`);
    } else {
      positionals.push(arg);
      if (!target) target = arg;
    }
  }
  // For commands whose positionals are a payload (not a path), the root is cwd.
  const positionalIsPayload = command === "impact" || command === "who-calls" || command === "preflight";
  return {
    command,
    root: path.resolve(positionalIsPayload ? process.cwd() : (target ?? process.cwd())),
    ides: [...new Set(ides)],
    yes,
    dryRun,
    force,
    json,
    openBrowser,
    graphType,
    update_,
    files,
    threshold,
    window: window_,
    strict,
    transitive,
    intent,
    id,
    positionals,
  };
}

async function selectIdes(options: Options, readline: any): Promise<IdeId[]> {
  if ((options.command !== "install" && options.command !== "create") || options.ides.length > 0) {
    return options.ides;
  }
  if (options.yes || !readline) {
    return ["generic"];
  }
  output.write(`Select one or more IDE adapters:\n${IDE_IDS.map((ide, i) => `  ${i + 1}. ${ide}`).join("\n")}\n`);
  const answer = (await readline.question("Adapter numbers or ids, comma separated [generic]: ")) as string;
  const choices = answer.trim().length === 0 ? ["generic"] : answer.split(",").map((part: string) => part.trim());
  const mapped = choices.map((choice: string) => {
    const numbered = Number.parseInt(choice, 10);
    const candidate = Number.isNaN(numbered) ? choice : IDE_IDS[numbered - 1];
    if (!candidate || !isIdeId(candidate)) throw new Error(`Unknown IDE selection "${choice}".`);
    return candidate;
  });
  return [...new Set(mapped)] as IdeId[];
}

function printActions(actions: FileAction[]): void {
  for (const action of actions) {
    const detail = action.message ? ` - ${action.message}` : "";
    output.write(`${action.status.padEnd(9)} ${action.path}${detail}\n`);
  }
}

function printResult(label: string, result: OperationResult, dryRun: boolean): void {
  printActions(result.actions);
  const prefix = dryRun ? "Dry run:" : `${label}:`;
  output.write(`${prefix} ${result.changed} changed, ${result.conflicts} conflict(s).\n`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const version = await packageVersion();
  let readline: any = null;
  const usePrompt = !options.yes && input.isTTY;
  if (usePrompt) {
    readline = createInterface({ input, output });
  }

  const promptOverwrite = readline
    ? async (filePath: string) => {
        const answer = await readline.question(`Conflict: ${filePath} has been modified locally. Overwrite? (y/N): `);
        return answer.trim().toLowerCase() === "y";
      }
    : undefined;

  if (options.command === "freshness") {
    const { writeFreshnessReport } = await import("../freshness/index.js");
    const { reportPath, report } = await writeFreshnessReport(options.root, options.threshold);
    if (options.json) {
      output.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      output.write(`Freshness report: ${reportPath}\n`);
      output.write(`  ${report.scores.length} documents scanned\n`);
      output.write(`  Drift decision: ${report.driftDecision}\n`);
      const stale = report.scores.filter((s) => s.action !== "none");
      if (stale.length > 0) {
        output.write(`  ${stale.length} document(s) need attention:\n`);
        for (const s of stale) output.write(`    ${s.score.toString().padStart(3)} ${s.docPath}\n`);
      }
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "git-analysis") {
    const { runGitAnalysis } = await import("../git-analysis/index.js");
    const { reportPath, analysis } = await runGitAnalysis(options.root, options.window);
    if (options.json) {
      output.write(`${JSON.stringify(analysis, null, 2)}\n`);
    } else {
      output.write(`Git analysis report: ${reportPath}\n`);
      output.write(`  ${analysis.commitsAnalyzed} commits in last ${analysis.windowDays} days\n`);
      output.write(`  ${analysis.hotspots.length} hotspots, ${analysis.coupling.length} coupled pairs\n`);
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "user-profile") {
    const { runUserProfile } = await import("../user-profile/index.js");
    const { profile, profilePath, isCI } = await runUserProfile(options.root);
    if (isCI) {
      output.write("CI environment detected — personal profile skipped.\n");
      output.write("Team preferences at .engineering-intelligence/memory/team-preferences.md still apply.\n");
    } else if (options.json) {
      output.write(`${JSON.stringify(profile, null, 2)}\n`);
    } else {
      output.write(`User profile: ${profilePath}\n`);
      output.write(`  Identity: ${profile.identity.email}${profile.identity.gitHubUsername ? ` (GitHub: ${profile.identity.gitHubUsername})` : ""}\n`);
      output.write(`  Commits analysed: ${profile.gitSignals.totalCommits}\n`);
      output.write(`  Primary language: ${profile.gitSignals.primaryLanguage}\n`);
      output.write(`  Test ratio: ${Math.round(profile.gitSignals.testCommitRatio * 100)}% of commits include test files\n`);
      output.write(`  Inferred test preference: ${profile.engineeringPreferences.tests}\n`);
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "map") {
    const { buildGraph } = await import("../graph/index.js");
    const result = await buildGraph(options.root, {
      update: options.update_,
      files: options.files.length > 0 ? options.files : undefined,
    });
    output.write(`Graph built: ${result.graphPath}\n`);
    output.write(`  ${result.nodeCount} nodes, ${result.edgeCount} edges (${result.fileCount} source files scanned)\n`);
    if (result.wasIncremental) output.write("  [incremental update]\n");
    if (readline) readline.close();
    return;
  }

  if (options.command === "impact") {
    const { ensureFreshGraph, analyzeImpact } = await import("../graph/index.js");
    const files = options.files.length > 0 ? options.files : options.positionals;
    if (files.length === 0) {
      output.write("Usage: engineering-intelligence impact <file...> [--json]\n");
      process.exitCode = 1;
      if (readline) readline.close();
      return;
    }
    const fresh = await ensureFreshGraph(options.root);
    const result = await analyzeImpact(options.root, files);
    if (options.json) {
      output.write(`${JSON.stringify(fresh.staleWarning ? { ...result, staleWarning: fresh.staleWarning } : result, null, 2)}\n`);
    } else {
      output.write(`Impact of changing: ${files.join(", ")}\n`);
      if (fresh.staleWarning) output.write(`  ⚠ ${fresh.staleWarning}\n`);
      output.write(`  Direct (${result.direct.length}): ${result.direct.slice(0, 20).join(", ") || "none"}\n`);
      output.write(`  Indirect (${result.indirect.length}): ${result.indirect.slice(0, 20).join(", ") || "none"}\n`);
      if (result.testsToRun.length > 0) output.write(`  Tests to run (${result.testsToRun.length}): ${result.testsToRun.join(", ")}\n`);
      for (const note of result.riskNotes) output.write(`  ⚠ ${note}\n`);
      if (result.direct.length === 0 && result.indirect.length === 0) {
        output.write("  No dependents found (or no graph — run `map` first).\n");
      }
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "who-calls") {
    const { ensureFreshGraph, whoCalls } = await import("../graph/index.js");
    const name = options.positionals[0];
    if (!name) {
      output.write("Usage: engineering-intelligence who-calls <symbol> [--transitive] [--json]\n");
      process.exitCode = 1;
      if (readline) readline.close();
      return;
    }
    const fresh = await ensureFreshGraph(options.root);
    const result = await whoCalls(options.root, name, { transitive: options.transitive });
    if (options.json) {
      output.write(`${JSON.stringify(fresh.staleWarning ? { ...result, staleWarning: fresh.staleWarning } : result, null, 2)}\n`);
    } else {
      if (result.unresolved) {
        output.write(`${result.unresolved}\n`);
      } else {
        output.write(`Callers of ${name} (${result.matched.length} definition(s), ${result.callers.length} caller(s)):\n`);
        for (const c of result.callers) {
          output.write(`  ${c.label}  [${c.confidence}]  ${c.evidence[0] ?? ""}\n`);
        }
        if (result.callers.length === 0) output.write("  No callers found in the graph.\n");
      }
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "verify") {
    const { verifyKnowledge, renderVerifyReport } = await import("../verify/index.js");
    const report = await verifyKnowledge(options.root);
    if (options.json) {
      output.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      output.write(renderVerifyReport(report));
    }
    if (options.strict && report.drift > 0) process.exitCode = 1;
    if (readline) readline.close();
    return;
  }

  if (options.command === "preflight") {
    const { preflight } = await import("../flight/index.js");
    if (!options.intent) {
      output.write("Usage: engineering-intelligence preflight --intent \"<what you're changing>\" [file...]\n");
      process.exitCode = 1;
      if (readline) readline.close();
      return;
    }
    const files = options.files.length > 0 ? options.files : options.positionals;
    const record = await preflight(options.root, { intent: options.intent, files });
    if (options.json) {
      output.write(`${JSON.stringify(record, null, 2)}\n`);
    } else {
      output.write(`Flight opened: ${record.id}\n`);
      output.write(`  Intent: ${record.intent}\n`);
      output.write(`  Declared files (${record.declaredFiles.length}): ${record.declaredFiles.join(", ") || "none"}\n`);
      output.write(`  Predicted radius: ${record.predictedRadius.files.length} file(s), ${record.predictedRadius.direct.length} direct / ${record.predictedRadius.indirect.length} indirect dependents\n`);
      output.write(`  Run \`engineering-intelligence postflight --id ${record.id}\` after editing.\n`);
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "postflight") {
    const { postflight, renderFlightReport } = await import("../flight/index.js");
    const result = await postflight(options.root, { id: options.id || undefined });
    if ("error" in result) {
      output.write(`${result.error}\n`);
      process.exitCode = 1;
      if (readline) readline.close();
      return;
    }
    if (options.json) {
      output.write(`${JSON.stringify(result.record, null, 2)}\n`);
    } else {
      output.write(renderFlightReport(result.record, result.report));
    }
    if (options.strict && result.report.verdict === "flagged") process.exitCode = 1;
    if (readline) readline.close();
    return;
  }

  if (options.command === "evidence-record") {
    const { recordEvidenceHashes } = await import("../evidence/index.js");
    const snapshot = await recordEvidenceHashes(options.root);
    output.write(`Recorded ${snapshot.hashes.length} evidence hash(es) to .engineering-intelligence/knowledge-base/.evidence-hashes.json\n`);
    if (readline) readline.close();
    return;
  }

  if (options.command === "evidence-check") {
    const { checkEvidenceHashes, renderEvidenceReport } = await import("../evidence/index.js");
    const report = await checkEvidenceHashes(options.root);
    if (options.json) {
      output.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      output.write(renderEvidenceReport(report));
    }
    if (options.strict && report.stale > 0) process.exitCode = 1;
    if (readline) readline.close();
    return;
  }

  if (options.command === "mcp") {
    const { startMcpServer } = await import("../mcp/index.js");
    if (readline) readline.close();
    await startMcpServer(options.root);
    return;
  }

  if (options.command === "doctor") {
    const actions = await doctor(options.root);
    if (options.json) {
      output.write(`${JSON.stringify(actions, null, 2)}\n`);
    } else {
      printActions(actions);
    }
    process.exitCode = actions.some((action) => action.status === "error") ? 1 : 0;
    if (readline) readline.close();
    return;
  }
  if (options.command === "visualize") {
    const html = await generateDashboardHTML(options.root);
    const outDir = path.join(options.root, ".engineering-intelligence");
    const outPath = path.join(outDir, "dashboard.html");
    await mkdir(outDir, { recursive: true });
    await writeFile(outPath, html, "utf8");
    output.write(`Dashboard generated: ${outPath}\n`);
    if (options.openBrowser) {
      const { exec } = await import("node:child_process");
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${cmd} ${JSON.stringify(outPath)}`);
    }
    if (readline) readline.close();
    return;
  }
  if (options.command === "uninstall") {
    const result = await uninstall(options.root, { dryRun: options.dryRun, force: options.force, packageVersion: version });
    printResult("Uninstall complete", result, options.dryRun);
    process.exitCode = result.conflicts > 0 ? 1 : 0;
    if (readline) readline.close();
    return;
  }
  if (options.command === "update") {
    const result = await update(options.root, { dryRun: options.dryRun, force: options.force, packageVersion: version, promptOverwrite });
    printResult("Update complete", result, options.dryRun);
    process.exitCode = result.conflicts > 0 ? 1 : 0;
    if (readline) readline.close();
    return;
  }
  const ides = await selectIdes(options, readline);
  if (options.command === "create") {
    await mkdir(options.root, { recursive: true });
    const result = await install(options.root, ides, {
      dryRun: options.dryRun,
      force: options.force,
      packageVersion: version,
      promptOverwrite,
    });
    printResult(`Created project with ${ides.join(", ")}`, result, options.dryRun);
    if (!options.dryRun && result.conflicts === 0) {
      output.write("Project scaffolded. Open your AI IDE and run /create-project to complete setup.\n");
    }
    process.exitCode = result.conflicts > 0 ? 1 : 0;
    if (readline) readline.close();
    return;
  }
  const result = await install(options.root, ides, {
    dryRun: options.dryRun,
    force: options.force,
    packageVersion: version,
    promptOverwrite,
  });
  printResult(`Installed ${ides.join(", ")}`, result, options.dryRun);
  if (!options.dryRun && result.conflicts === 0) {
    output.write("Open your selected AI IDE and invoke the installed initialization workflow.\n");
  }
  process.exitCode = result.conflicts > 0 ? 1 : 0;
  if (readline) readline.close();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
