import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { renderAdapters } from "../adapters/index.js";
import { readManagedBlock } from "../installer/blocks.js";
import { MANIFEST_PATH, hashContent, readManifest } from "../manifest/index.js";
import { validateCanonicalTemplates } from "../templates.js";
import type { FileAction, IdeId } from "../types.js";

async function exists(location: string): Promise<boolean> {
  try {
    await access(location);
    return true;
  } catch {
    return false;
  }
}

export async function validateRender(ides: IdeId[]): Promise<string[]> {
  const errors = await validateCanonicalTemplates();
  const rendered = await renderAdapters(ides);
  for (const item of rendered) {
    if (
      item.content.includes(".agent/") ||
      item.content.includes(".agents/memory") ||
      item.content.includes(".agents/context")
    ) {
      errors.push(`${item.path} references an obsolete or host-bound runtime output path`);
    }
  }
  const allContent = rendered.map((item) => item.content).join("\n");
  for (const requiredPath of [
    ".engineering-intelligence/graph/",
    ".engineering-intelligence/reports/",
  ]) {
    if (!allContent.includes(requiredPath)) {
      errors.push(`Rendered templates do not describe required V2 runtime path: ${requiredPath}`);
    }
  }
  return errors;
}

export async function doctor(root: string): Promise<FileAction[]> {
  const actions: FileAction[] = [];
  const manifest = await readManifest(root);
  if (!manifest) {
    actions.push({ path: MANIFEST_PATH, status: "error", message: "No installation manifest found." });
    return actions;
  }
  const renderingErrors = await validateRender(manifest.adapters);
  for (const message of renderingErrors) {
    actions.push({ path: "templates", status: "error", message });
  }
  if (await exists(path.join(root, ".agent")) && !manifest.adapters.includes("antigravity") && !manifest.adapters.includes("antigravity-cli")) {
    actions.push({
      path: ".agent",
      status: "warning",
      message: "Legacy .agent directory found; installed adapters use .agents.",
    });
  }
  for (const entry of manifest.files) {
    const absolute = path.join(root, entry.path);
    if (!(await exists(absolute))) {
      actions.push({ path: entry.path, status: "error", message: "Managed file is missing." });
      continue;
    }
    const current = await readFile(absolute, "utf8");
    const tracked =
      entry.kind === "block" && entry.blockId
        ? readManagedBlock(current, entry.blockId)
        : current;
    if (tracked === undefined) {
      actions.push({ path: entry.path, status: "error", message: "Managed block is missing." });
    } else if (hashContent(tracked.trimEnd()) !== entry.hash) {
      actions.push({ path: entry.path, status: "warning", message: "Managed content was edited locally." });
    } else {
      actions.push({ path: entry.path, status: "unchanged" });
    }
  }
  return actions;
}
