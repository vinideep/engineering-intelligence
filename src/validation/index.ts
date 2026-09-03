import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderAdapters } from "../adapters/index.js";
import { readManagedBlock } from "../installer/blocks.js";
import { hasOurEntries } from "../installer/json-merge.js";
import { MANIFEST_PATH, TEMPLATE_VERSION, hashContent, readManifest } from "../manifest/index.js";
import { exists, validateCanonicalTemplates } from "../templates.js";
import type { FileAction, IdeId } from "../types.js";
import { packageVersion } from "../version.js";

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

export async function doctor(root: string, expectedPackageVersion?: string): Promise<FileAction[]> {
  const actions: FileAction[] = [];
  const manifest = await readManifest(root);
  if (!manifest) {
    actions.push({ path: MANIFEST_PATH, status: "error", message: "No installation manifest found." });
    return actions;
  }
  const expectedVersion = expectedPackageVersion ?? await packageVersion();
  if (manifest.packageVersion !== expectedVersion) {
    actions.push({ path: MANIFEST_PATH, status: "error", message: `Installed package version ${manifest.packageVersion} differs from canonical ${expectedVersion}; run engineering-intelligence update.` });
  }
  if (manifest.templateVersion !== TEMPLATE_VERSION) {
    actions.push({ path: MANIFEST_PATH, status: "error", message: `Installed template version ${manifest.templateVersion} differs from canonical ${TEMPLATE_VERSION}; run engineering-intelligence update.` });
  }
  const renderingErrors = await validateRender(manifest.adapters);
  // Needed to verify json-merge entries: we must know what we would write in
  // order to check that it is still present inside the user's own file.
  const desired = await renderAdapters(manifest.adapters);
  const desiredByPath = new Map(desired.map((f) => [f.path, f]));
  const manifestByPath = new Map(manifest.files.map((entry) => [entry.path, entry]));
  for (const rendered of desired) {
    if (!manifestByPath.has(rendered.path)) {
      actions.push({ path: rendered.path, status: "error", message: "Canonical managed artifact is missing from the install manifest; run engineering-intelligence update." });
    }
  }
  for (const entry of manifest.files) {
    if (!desiredByPath.has(entry.path)) {
      actions.push({ path: entry.path, status: "warning", message: "Install manifest tracks an artifact that is no longer canonical; run engineering-intelligence update." });
    }
  }
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

    if (entry.kind === "seed") {
      // Seeded config is the user's to edit — that is how enforcement is turned
      // on — so a local change is expected, never a warning.
      actions.push({ path: entry.path, status: "unchanged" });
      continue;
    }

    if (entry.kind === "json-merge") {
      // We only own our own entries; the user's surrounding config is theirs.
      const rendered = desiredByPath.get(entry.path);
      const wired = rendered ? hasOurEntries(current, rendered.content) : true;
      actions.push(
        wired
          ? { path: entry.path, status: "unchanged" }
          : {
              path: entry.path,
              status: "warning",
              message: "Enforcement hook entries are missing. Run `engineering-intelligence update` to re-merge them.",
            },
      );
      continue;
    }

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
