import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

export async function packageVersion(): Promise<string> {
  const packageJson = new URL("../package.json", import.meta.url);
  const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || !parsed.version) throw new Error("Package version is missing from package.json.");
  return parsed.version;
}

/** Synchronous variant for render paths that must stay synchronous. */
export function packageVersionSync(): string {
  const parsed = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || !parsed.version) throw new Error("Package version is missing from package.json.");
  return parsed.version;
}

/**
 * How generated hooks, messages and docs invoke the CLI. Pinned to this
 * version: an unpinned `npx graphward` resolves npm's `latest`, which may be a
 * different release (or a different codebase) than the one that installed the
 * project's skills, hooks and on-disk formats.
 */
export function cliInvocation(version = packageVersionSync()): string {
  return `npx graphward@${version}`;
}
