import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderAdapters } from "../adapters/index.js";
import { readManagedBlock } from "../installer/blocks.js";
import { MANIFEST_PATH, hashContent, readManifest } from "../manifest/index.js";
import { exists, validateCanonicalTemplates } from "../templates.js";
import type { FileAction, IdeId } from "../types.js";

export async function validateRender(ides: IdeId[]): Promise<string[]> {
  const errors = await validateCanonicalTemplates();
  const rendered = await renderAdapters(ides);
  for (const item of rendered) {
    // Flag only the genuinely obsolete runtime output paths; `.agent/skills`, `.agent/workflows`,
    // `.agent/rules`, `.agent/agents` are legitimate Antigravity IDE paths.
    if (
      !item.path.endsWith(".json") &&
      (item.content.includes(".agent/memory") ||
        item.content.includes(".agent/context") ||
        item.content.includes(".agents/memory") ||
        item.content.includes(".agents/context"))
    ) {
      errors.push(`${item.path} references an obsolete or host-bound runtime output path`);
    }
  }
  const allContent = rendered.map((item) => item.content).join("\n");
  // After universal path aliasing, `.engineering-intelligence/` becomes `$EI` in all skill files,
  // so `.engineering-intelligence/graph/` becomes `$EIgraph/` and `.engineering-intelligence/reports/`
  // becomes `$EIreports/`. The alias preamble preserves `.engineering-intelligence/aidlc/` literally.
  for (const [requiredPath, alias] of [
    [".engineering-intelligence/aidlc/", "$AIDLC"],
    [".engineering-intelligence/graph/", "$EIgraph/"],
    [".engineering-intelligence/reports/", "$EIreports/"],
  ] as [string, string][]) {
    if (!allContent.includes(requiredPath) && !allContent.includes(alias)) {
      errors.push(`Rendered templates do not describe required runtime path: ${requiredPath}`);
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

  // Claude Code enforcement hooks: if the user owns a pre-existing settings.json,
  // the installer preserves it (never in the manifest), so verify the hook wiring
  // is actually present and guide a manual merge when it is not.
  if (manifest.adapters.includes("claude-code")) {
    const settingsPath = path.join(root, ".claude", "settings.json");
    const managedBySettings = manifest.files.some((entry) => entry.path === ".claude/settings.json");
    if (!managedBySettings) {
      let hasHooks = false;
      try {
        hasHooks = (await readFile(settingsPath, "utf8")).includes("engineering-intelligence hook");
      } catch { /* missing */ }
      if (!hasHooks) {
        actions.push({
          path: ".claude/settings.json",
          status: "warning",
          message:
            "Enforcement hooks are not wired. Merge the `hooks` block (SessionStart/PreToolUse/PostToolUse/Stop → `npx engineering-intelligence hook <event>`) into your existing .claude/settings.json.",
        });
      }
    }
  }

  // Cursor enforcement hooks: same pre-existing-file edge case for .cursor/hooks.json.
  if (manifest.adapters.includes("cursor")) {
    const hooksPath = path.join(root, ".cursor", "hooks.json");
    const managed = manifest.files.some((entry) => entry.path === ".cursor/hooks.json");
    if (!managed) {
      let hasHooks = false;
      try {
        hasHooks = (await readFile(hooksPath, "utf8")).includes("engineering-intelligence hook");
      } catch { /* missing */ }
      if (!hasHooks) {
        actions.push({
          path: ".cursor/hooks.json",
          status: "warning",
          message:
            "Enforcement hooks are not wired. Merge the `hooks` block (sessionStart/preToolUse/afterFileEdit/afterShellExecution/stop → `npx engineering-intelligence hook <event> --host cursor`) into your existing .cursor/hooks.json.",
        });
      }
    }
  }

  return actions;
}
