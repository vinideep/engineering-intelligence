#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { isIdeId } from "../adapters/index.js";
import { install, uninstall, update } from "../installer/index.js";
import { doctor } from "../validation/index.js";
import { generateDashboardHTML } from "../visualizer/index.js";
import { IDE_IDS, type FileAction, type IdeId, type OperationResult } from "../types.js";

type Command = "install" | "update" | "doctor" | "uninstall" | "visualize" | "create" | "map" | "mcp" | "freshness" | "git-analysis" | "user-profile" | "hook" | "gate" | "verify" | "claims" | "context" | "telemetry";

const COMMANDS: Command[] = ["install", "create", "update", "doctor", "uninstall", "visualize", "map", "mcp", "freshness", "git-analysis", "user-profile", "hook", "gate", "verify", "claims", "context", "telemetry"];

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
  hookEvent?: string;
  gateName?: string;
  base: string;
  positional?: string;   // action (claims) or task (context)
  statement?: string;
  evidence?: string;
  confidence?: string;
  author?: string;
  budget: number;
  strict: boolean;
  host: string;
  failOn?: string;
}

async function packageVersion(): Promise<string> {
  const packageJson = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { version: string };
  return parsed.version;
}

function usage(all = false): string {
  const core = `engineering-intelligence — codebase intelligence that lives in your repo.

Four commands do everything:

Usage:
  engineering-intelligence install [path] [--ide <id>...] [--yes] [--dry-run] [--force]
  engineering-intelligence create [path] [--ide <id>...] [--yes]
  engineering-intelligence update [path] [--dry-run] [--force]
  engineering-intelligence doctor [path] [--json]
  engineering-intelligence uninstall [path] [--dry-run] [--force]
  engineering-intelligence visualize [path] [--open]
  engineering-intelligence map [path] [--type dependency] [--update] [--files a,b,c]
  engineering-intelligence mcp [path]
  engineering-intelligence freshness [path] [--threshold 60] [--json]
  engineering-intelligence git-analysis [path] [--window 90] [--json]
  engineering-intelligence user-profile [path] [--json]
  engineering-intelligence hook <event> [path]   (internal: driven by IDE lifecycle hooks)
  engineering-intelligence gate <name> [path] [--base <ref>] [--fail-on error|warning] [--json]
  engineering-intelligence verify [path] [--json]
  engineering-intelligence claims verify [path] [--json] [--strict]
  engineering-intelligence claims derive [path] [--json]
  engineering-intelligence claims add --statement "..." --evidence "src/a.ts:10-20,src/b.ts" --author "name" [path]
  engineering-intelligence claims list [path] [--json]
  engineering-intelligence context "<task>" [path] [--files a,b] [--budget 2000] [--json]
  engineering-intelligence telemetry [path] [--json]

IDE ids: ${IDE_IDS.join(", ")}
Hook events: session-start, pre-tool-use, post-tool-use, stop
Gates: env-vars, dead-exports, api-diff, migration-lint
`;
  if (!all) return core + "\nRun `engineering-intelligence --help --all` for the full advanced command list.\n";
  return core + `
Advanced commands (the 4 verbs above orchestrate these; use directly if you want):
  install / create / update / uninstall [path] [--ide <id>...] [--dry-run] [--force]
  map [path] [--type dependency] [--update] [--files a,b,c]
  impact <file...> [--json]            who-calls <symbol> [--transitive] [--json]
  verify [path] [--strict] [--json]    visualize [path] [--open]
  preflight --intent "<s>" [file...]   postflight [--id <flight>] [--strict]
  evidence-record [path]               evidence-check [path] [--strict] [--json]
  freshness [path] [--threshold 60]    git-analysis [path] [--window 90]
  user-profile [path] [--json]
`;
}

function parseArgs(args: string[]): Options {
  let command: Command = "install";
  const remaining = [...args];
  if (remaining[0] && (COMMANDS as string[]).includes(remaining[0])) {
    command = remaining.shift() as Command;
  }
  if (remaining.includes("--help") || remaining.includes("-h")) {
    output.write(usage(remaining.includes("--all")));
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
  let hookEvent: string | undefined;
  let gateName: string | undefined;
  let base = "HEAD";
  let positional: string | undefined;
  let statement: string | undefined;
  let evidence: string | undefined;
  let confidence: string | undefined;
  let author: string | undefined;
  let budget = 2000;
  let strict = false;
  let host = "claude-code";
  let failOn: string | undefined;

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
    } else if (arg === "--base") {
      const value = remaining[++index];
      if (!value) throw new Error("--base requires a value.");
      base = value;
    } else if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg === "--statement") {
      statement = remaining[++index];
    } else if (arg.startsWith("--statement=")) {
      statement = arg.slice("--statement=".length);
    } else if (arg === "--evidence") {
      evidence = remaining[++index];
    } else if (arg.startsWith("--evidence=")) {
      evidence = arg.slice("--evidence=".length);
    } else if (arg === "--author") {
      author = remaining[++index];
    } else if (arg.startsWith("--author=")) {
      author = arg.slice("--author=".length);
    } else if (arg === "--confidence") {
      confidence = remaining[++index];
    } else if (arg.startsWith("--confidence=")) {
      confidence = arg.slice("--confidence=".length);
    } else if (arg === "--budget") {
      budget = parseInt(remaining[++index] ?? "", 10);
    } else if (arg.startsWith("--budget=")) {
      budget = parseInt(arg.slice("--budget=".length), 10);
    } else if (arg === "--strict") {
      strict = true;
    } else if (arg === "--host") {
      host = remaining[++index] ?? host;
    } else if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length);
    } else if (arg === "--fail-on") {
      const value = remaining[++index];
      if (!value) throw new Error("--fail-on requires a value.");
      failOn = value;
    } else if (arg.startsWith("--fail-on=")) {
      failOn = arg.slice("--fail-on=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option "${arg}".`);
    } else if (command === "hook" && hookEvent === undefined) {
      hookEvent = arg;
    } else if (command === "gate" && gateName === undefined) {
      gateName = arg;
    } else if ((command === "claims" || command === "context") && positional === undefined) {
      positional = arg;
    } else if (!target) {
      target = arg;
    } else {
      positionals.push(arg);
      if (!target) target = arg;
    }
  }
  // For commands whose positionals are a payload (not a path), the root is cwd.
  const positionalIsPayload = command === "impact" || command === "who-calls" || command === "preflight" || command === "ask" || command === "guard";
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
    hookEvent,
    gateName,
    base,
    positional,
    statement,
    evidence,
    confidence,
    author,
    budget: Number.isNaN(budget) ? 2000 : budget,
    strict,
    host,
    failOn,
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

async function readStdin(): Promise<string> {
  if (input.isTTY) return ""; // no piped payload
  const chunks: Buffer[] = [];
  for await (const chunk of input) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === "hook") {
    const { runHook, normalizeInput, isHookEvent, isHookHost } = await import("../hooks/index.js");
    const event = options.hookEvent ?? "";
    if (!isHookEvent(event)) {
      // Unknown event — fail safe (allow) rather than break the host session.
      process.exitCode = 0;
      return;
    }
    const host = isHookHost(options.host) ? options.host : "claude-code";
    const payload = normalizeInput(host, await readStdin());
    // The host passes the project directory as cwd; honour it over the process cwd.
    const root = path.resolve(options.root !== process.cwd() ? options.root : (payload.cwd ?? process.cwd()));
    const result = await runHook(event, root, payload, host);
    if (result.stdout) output.write(`${result.stdout}\n`);
    process.exitCode = result.exitCode;
    return;
  }

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

  if (options.command === "setup") {
    const { runSetup, mcpRegistrationHint } = await import("../orchestrators/setup.js");
    const ides = options.ides.length > 0 ? options.ides : undefined;
    const result = await runSetup(options.root, {
      ides,
      packageVersion: version,
      dryRun: options.dryRun,
      force: options.force,
      promptOverwrite,
    });
    if (options.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      for (const line of result.logs) output.write(`  ${line}\n`);
      if (!options.dryRun) output.write(mcpRegistrationHint(options.root, result.ides));
    }
    process.exitCode = result.installOp.conflicts > 0 ? 1 : 0;
    if (readline) readline.close();
    return;
  }

  if (options.command === "ask") {
    const { runAsk } = await import("../orchestrators/ask.js");
    const query = options.positionals.join(" ").trim();
    if (!query) {
      output.write("Usage: engineering-intelligence ask \"<question>\" | <file...>\n");
      process.exitCode = 1;
      if (readline) readline.close();
      return;
    }
    const result = await runAsk(options.root, query, options.positionals, { full: options.full });
    output.write(options.json ? `${JSON.stringify(result.json, null, 2)}\n` : result.text);
    if (readline) readline.close();
    return;
  }

  if (options.command === "guard") {
    const { preflight, postflight, renderFlightReport } = await import("../flight/index.js");
    const intent = options.intent || options.positionals[0];
    const isPreflight = options.positionals.length > 0 || !!options.intent;
    if (isPreflight) {
      const files = options.intent ? options.positionals : options.positionals.slice(1);
      const { ensureFreshGraph } = await import("../graph/index.js");
      await ensureFreshGraph(options.root);
      const record = await preflight(options.root, { intent, files });
      try {
        const { recordEvidenceHashes } = await import("../evidence/index.js");
        if (existsSync(path.join(options.root, ".engineering-intelligence", "knowledge-base"))) await recordEvidenceHashes(options.root);
      } catch { /* best-effort */ }
      if (options.json) {
        output.write(`${JSON.stringify(record, null, 2)}\n`);
      } else {
        output.write(`Flight opened: ${record.id}\n  Intent: ${record.intent}\n`);
        output.write(`  Declared files (${record.declaredFiles.length}): ${record.declaredFiles.join(", ") || "none"}\n`);
        output.write(`  Predicted radius: ${record.predictedRadius.files.length} file(s), ${record.predictedRadius.direct.length} direct dependent(s)\n`);
        output.write("  …make your edits, then run `engineering-intelligence guard` to audit.\n");
      }
    } else {
      const result = await postflight(options.root, {});
      if ("error" in result) {
        output.write(`${result.error}\n`);
        process.exitCode = 1;
        if (readline) readline.close();
        return;
      }
      output.write(options.json ? `${JSON.stringify(result.record, null, 2)}\n` : renderFlightReport(result.record, result.report));
      if (options.strict && result.report.verdict === "flagged") process.exitCode = 1;
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "health") {
    const { runHealth } = await import("../orchestrators/health.js");
    const result = await runHealth(options.root);
    output.write(options.json ? `${JSON.stringify(result.json, null, 2)}\n` : result.text);
    if (options.openBrowser) {
      const { generateDashboardHTML } = await import("../visualizer/index.js");
      const html = await generateDashboardHTML(options.root);
      const outPath = path.join(options.root, ".engineering-intelligence", "dashboard.html");
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, html, "utf8");
      output.write(`  Dashboard: ${outPath}\n`);
    }
    if (options.strict && !result.ok) process.exitCode = 1;
    if (readline) readline.close();
    return;
  }

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

  if (options.command === "verify") {
    const { runVerification } = await import("../verify/index.js");
    const { loadHookConfig } = await import("../hooks/index.js");
    const config = await loadHookConfig(options.root);
    const { receipt, noCommands } = await runVerification(options.root, {
      commands: config.verifyCommands.length > 0 ? config.verifyCommands : undefined,
    });
    if (options.json) {
      output.write(`${JSON.stringify(receipt, null, 2)}\n`);
    } else if (noCommands) {
      output.write("No check commands detected. Set hooks.verifyCommands in .engineering-intelligence/ei.config.json.\n");
    } else {
      for (const run of receipt.commands) {
        output.write(`${run.exitCode === 0 ? "PASS" : "FAIL"}  ${run.command}  (${run.durationMs}ms)\n`);
      }
      const covered = Object.keys(receipt.files).length;
      output.write(`Verdict: ${receipt.verdict.toUpperCase()} — receipt covers ${covered} changed file(s).\n`);
      if (receipt.verdict === "fail") {
        const failing = receipt.commands.find((r) => r.exitCode !== 0);
        if (failing?.outputTail) output.write(`${failing.outputTail.trimEnd()}\n`);
      }
    }
    process.exitCode = receipt.verdict === "pass" ? 0 : 1;
    if (readline) readline.close();
    return;
  }

  if (options.command === "gate") {
    const { runGate, isGateName, GATE_NAMES } = await import("../gates/index.js");
    if (!options.gateName || !isGateName(options.gateName)) {
      output.write(`Unknown gate "${options.gateName ?? ""}". Available: ${GATE_NAMES.join(", ")}.\n`);
      process.exitCode = 2;
      if (readline) readline.close();
      return;
    }
    if (options.failOn && !["error", "warning", "info"].includes(options.failOn)) {
      throw new Error(`--fail-on must be error, warning, or info (got "${options.failOn}").`);
    }
    const result = await runGate(options.gateName, options.root, {
      base: options.base,
      failOn: options.failOn as "error" | "warning" | "info" | undefined,
    });
    if (options.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const icon = { error: "🔴", warning: "🟡", info: "🔵" } as const;
      output.write(`Gate ${result.gate}: ${result.status.toUpperCase()} — ${result.summary}\n`);
      for (const f of result.findings) {
        const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : "";
        output.write(`  ${icon[f.severity]} ${f.message}${loc}\n`);
      }
    }
    process.exitCode = result.status === "fail" ? 1 : 0;
    if (readline) readline.close();
    return;
  }

  if (options.command === "claims") {
    const claims = await import("../claims/index.js");
    const action = options.positional ?? "verify";
    if (action === "add") {
      if (!options.statement || !options.evidence || !options.author) {
        output.write('claims add records an ASSERTED (unchecked) claim and requires --statement "..." --evidence "path:start-end,path2" --author "name".\nDerived facts are not hand-authored — run `claims derive` to compute them.\n');
        process.exitCode = 2;
        if (readline) readline.close();
        return;
      }
      try {
        const claim = await claims.addClaim(options.root, {
          statement: options.statement,
          evidence: claims.parseEvidenceSpec(options.evidence),
          author: options.author,
        });
        output.write(options.json
          ? `${JSON.stringify(claim, null, 2)}\n`
          : `Added ${claim.id} (asserted — not machine-checked): ${claim.statement}\n`);
      } catch (error) {
        output.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    } else if (action === "list") {
      const store = await claims.loadClaims(options.root);
      if (options.json) output.write(`${JSON.stringify(store, null, 2)}\n`);
      else {
        output.write(`${store.claims.length} claim(s):\n`);
        for (const c of store.claims) output.write(`  ${c.id} [${c.kind ?? "asserted"}] ${c.statement}\n`);
      }
    } else if (action === "derive") {
      const { added, removed, total } = await claims.deriveClaims(options.root);
      output.write(options.json
        ? `${JSON.stringify({ added, removed, total }, null, 2)}\n`
        : `Derived ${total} fact(s) from source (+${added} new, -${removed} no longer true). Asserted claims left untouched.\n`);
    } else { // verify
      const report = await claims.verifyClaims(options.root);
      output.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : claims.renderVerifyReport(report));
      // A refuted derived fact is a real contradiction with the source and fails strict mode.
      if (options.strict && report.refuted + report.stale + report.missing > 0) process.exitCode = 1;
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "context") {
    const { getContext } = await import("../context/index.js");
    const task = options.positional ?? "";
    if (!task) {
      output.write('context requires a task, e.g. context "add rate limiting" --files src/auth.ts\n');
      process.exitCode = 2;
      if (readline) readline.close();
      return;
    }
    const pack = await getContext(options.root, { task, files: options.files, budget: options.budget });
    if (options.json) {
      output.write(`${JSON.stringify(pack, null, 2)}\n`);
    } else {
      output.write(pack.markdown);
      output.write(`\n<!-- ~${pack.tokensEstimated}/${pack.budget} tokens; included: ${pack.included.join(", ") || "none"}${pack.omitted.length ? `; omitted (budget): ${pack.omitted.join(", ")}` : ""} -->\n`);
    }
    if (readline) readline.close();
    return;
  }

  if (options.command === "telemetry") {
    const { aggregate, renderReport } = await import("../telemetry/index.js");
    const report = await aggregate(options.root);
    output.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : renderReport(report));
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
