#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { isIdeId } from "../adapters/index.js";
import { install, uninstall, update } from "../installer/index.js";
import { doctor } from "../validation/index.js";
import { IDE_IDS, type FileAction, type IdeId, type OperationResult } from "../types.js";

type Command = "install" | "update" | "doctor" | "uninstall";

interface Options {
  command: Command;
  root: string;
  ides: IdeId[];
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  json: boolean;
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
  engineering-intelligence [install] [path] [--ide <id>...] [--yes] [--dry-run] [--force]
  engineering-intelligence update [path] [--dry-run] [--force]
  engineering-intelligence doctor [path] [--json]
  engineering-intelligence uninstall [path] [--dry-run] [--force]

IDE ids: ${IDE_IDS.join(", ")}
`;
}

function parseArgs(args: string[]): Options {
  let command: Command = "install";
  const remaining = [...args];
  if (remaining[0] && ["install", "update", "doctor", "uninstall"].includes(remaining[0])) {
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
  };
}

async function selectIdes(options: Options): Promise<IdeId[]> {
  if (options.command !== "install" || options.ides.length > 0) {
    return options.ides;
  }
  if (options.yes || !input.isTTY) {
    return ["generic"];
  }
  const readline = createInterface({ input, output });
  output.write(`Select one or more IDE adapters:\n${IDE_IDS.map((ide, i) => `  ${i + 1}. ${ide}`).join("\n")}\n`);
  const answer = await readline.question("Adapter numbers or ids, comma separated [generic]: ");
  readline.close();
  const choices = answer.trim().length === 0 ? ["generic"] : answer.split(",").map((part) => part.trim());
  return [...new Set(choices.map((choice) => {
    const numbered = Number.parseInt(choice, 10);
    const candidate = Number.isNaN(numbered) ? choice : IDE_IDS[numbered - 1];
    if (!candidate || !isIdeId(candidate)) {
      throw new Error(`Unknown IDE selection "${choice}".`);
    }
    return candidate;
  }))];
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
  if (options.command === "doctor") {
    const actions = await doctor(options.root);
    if (options.json) {
      output.write(`${JSON.stringify(actions, null, 2)}\n`);
    } else {
      printActions(actions);
    }
    process.exitCode = actions.some((action) => action.status === "error") ? 1 : 0;
    return;
  }
  if (options.command === "uninstall") {
    const result = await uninstall(options.root, { dryRun: options.dryRun, force: options.force, packageVersion: version });
    printResult("Uninstall complete", result, options.dryRun);
    process.exitCode = result.conflicts > 0 ? 1 : 0;
    return;
  }
  if (options.command === "update") {
    const result = await update(options.root, { dryRun: options.dryRun, force: options.force, packageVersion: version });
    printResult("Update complete", result, options.dryRun);
    process.exitCode = result.conflicts > 0 ? 1 : 0;
    return;
  }
  const ides = await selectIdes(options);
  const result = await install(options.root, ides, {
    dryRun: options.dryRun,
    force: options.force,
    packageVersion: version,
  });
  printResult(`Installed ${ides.join(", ")}`, result, options.dryRun);
  if (!options.dryRun && result.conflicts === 0) {
    output.write("Open your selected AI IDE and invoke the installed initialization workflow.\n");
  }
  process.exitCode = result.conflicts > 0 ? 1 : 0;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
