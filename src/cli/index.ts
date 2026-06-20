#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { isIdeId } from "../adapters/index.js";
import { install, uninstall, update } from "../installer/index.js";
import { generateTokenReport, formatMarkdown, formatCsv } from "../report/index.js";
import { doctor } from "../validation/index.js";
import { generateDashboardHTML } from "../visualizer/index.js";
import { IDE_IDS, type FileAction, type IdeId, type OperationResult } from "../types.js";

type Command = "install" | "update" | "doctor" | "uninstall" | "visualize" | "create" | "token-report";

interface Options {
  command: Command;
  root: string;
  ides: IdeId[];
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  json: boolean;
  openBrowser: boolean;
  format: "md" | "csv";
  out: string | undefined;
}

async function packageVersion(): Promise<string> {
  const packageJson = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { version: string };
  return parsed.version;
}

function usage(): string {
  return `engineering-intelligence

Install engineering intelligence orchestration assets for AI coding IDEs.

Usage:
  engineering-intelligence install [path] [--ide <id>...] [--yes] [--dry-run] [--force]
  engineering-intelligence create [path] [--ide <id>...] [--yes]
  engineering-intelligence update [path] [--dry-run] [--force]
  engineering-intelligence doctor [path] [--json]
  engineering-intelligence uninstall [path] [--dry-run] [--force]
  engineering-intelligence visualize [path] [--open]
  engineering-intelligence token-report [path] [--format md|csv] [--out <file>]

IDE ids: ${IDE_IDS.join(", ")}
`;
}

function parseArgs(args: string[]): Options {
  let command: Command = "install";
  const remaining = [...args];
  if (
    remaining[0] &&
    ["install", "create", "update", "doctor", "uninstall", "visualize", "token-report"].includes(
      remaining[0],
    )
  ) {
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
  let format: "md" | "csv" = "md";
  let out: string | undefined;
  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index];
    if (arg === "--ide") {
      const value = remaining[++index];
      if (!value) {
        throw new Error("--ide requires a value.");
      }
      for (const ide of value.split(",")) {
        if (!isIdeId(ide)) {
          throw new Error(`Unknown IDE "${ide}". Supported: ${IDE_IDS.join(", ")}.`);
        }
        ides.push(ide);
      }
    } else if (arg.startsWith("--ide=")) {
      const value = arg.slice("--ide=".length);
      for (const ide of value.split(",")) {
        if (!isIdeId(ide)) {
          throw new Error(`Unknown IDE "${ide}". Supported: ${IDE_IDS.join(", ")}.`);
        }
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
    } else if (arg === "--format") {
      const value = remaining[++index];
      if (value !== "md" && value !== "csv") {
        throw new Error(`--format must be "md" or "csv".`);
      }
      format = value;
    } else if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (value !== "md" && value !== "csv") {
        throw new Error(`--format must be "md" or "csv".`);
      }
      format = value;
    } else if (arg === "--out") {
      out = remaining[++index];
      if (!out) throw new Error("--out requires a file path.");
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option "${arg}".`);
    } else if (!target) {
      target = arg;
    } else {
      throw new Error(`Unexpected argument "${arg}".`);
    }
  }
  return {
    command,
    root: path.resolve(target ?? process.cwd()),
    ides: [...new Set(ides)],
    yes,
    dryRun,
    force,
    json,
    openBrowser,
    format,
    out,
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
    if (!candidate || !isIdeId(candidate)) {
      throw new Error(`Unknown IDE selection "${choice}".`);
    }
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

  if (options.command === "token-report") {
    const report = await generateTokenReport(options.root);
    const content =
      options.format === "csv" ? formatCsv(report) : formatMarkdown(report);
    const ext = options.format === "csv" ? "csv" : "md";
    const outPath = options.out
      ? path.resolve(options.out)
      : path.join(options.root, ".engineering-intelligence", `token-report.${ext}`);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, content, "utf8");
    output.write(`Token report written: ${outPath}\n`);
    if (readline) readline.close();
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
