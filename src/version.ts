import { readFile } from "node:fs/promises";

export async function packageVersion(): Promise<string> {
  const packageJson = new URL("../package.json", import.meta.url);
  const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || !parsed.version) throw new Error("Package version is missing from package.json.");
  return parsed.version;
}
