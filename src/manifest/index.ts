import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InstallManifest } from "../types.js";

export const MANIFEST_PATH = ".engineering-intelligence/install-manifest.json";
export const TEMPLATE_VERSION = "2.0.0";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function readManifest(root: string): Promise<InstallManifest | undefined> {
  try {
    const text = await readFile(path.join(root, MANIFEST_PATH), "utf8");
    return JSON.parse(text) as InstallManifest;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function writeManifest(root: string, manifest: InstallManifest): Promise<void> {
  await writeFile(path.join(root, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
