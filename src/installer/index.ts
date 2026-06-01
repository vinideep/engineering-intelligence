import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderAdapters } from "../adapters/index.js";
import { MANIFEST_PATH, TEMPLATE_VERSION, hashContent, readManifest, writeManifest } from "../manifest/index.js";
import { exists } from "../templates.js";
import { validateRender } from "../validation/index.js";
import type {
  FileAction,
  IdeId,
  InstallManifest,
  ManagedFileEntry,
  OperationResult,
  RenderedFile,
} from "../types.js";
import { readManagedBlock, removeManagedBlock, upsertManagedBlock } from "./blocks.js";

export interface MutationOptions {
  dryRun?: boolean;
  force?: boolean;
  packageVersion: string;
  promptOverwrite?: (filePath: string) => Promise<boolean>;
}


async function readMaybe(location: string): Promise<string | undefined> {
  try {
    return await readFile(location, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeTarget(root: string, relativePath: string, content: string): Promise<void> {
  const absolute = path.join(root, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

function priorByPath(manifest: InstallManifest | undefined): Map<string, ManagedFileEntry> {
  return new Map((manifest?.files ?? []).map((entry) => [entry.path, entry]));
}

function entryFor(rendered: RenderedFile): ManagedFileEntry {
  return {
    path: rendered.path,
    kind: rendered.kind,
    hash: hashContent(rendered.content.trimEnd()),
    blockId: rendered.blockId,
    owners: rendered.owners,
  };
}

async function applyRendered(
  root: string,
  rendered: RenderedFile,
  prior: ManagedFileEntry | undefined,
  options: MutationOptions,
): Promise<{ action: FileAction; entry?: ManagedFileEntry }> {
  const absolute = path.join(root, rendered.path);
  const current = await readMaybe(absolute);
  const desiredEntry = entryFor(rendered);

  if (rendered.kind === "file") {
    const currentHash = current === undefined ? undefined : hashContent(current.trimEnd());
    const isSafe =
      current === undefined ||
      currentHash === desiredEntry.hash ||
      (prior !== undefined && currentHash === prior.hash) ||
      options.force === true;
    if (!isSafe) {
      if (options.promptOverwrite && await options.promptOverwrite(rendered.path)) {
        const status = current === undefined ? "created" : "updated";
        if (!options.dryRun) {
          await writeTarget(root, rendered.path, rendered.content);
        }
        return { action: { path: rendered.path, status }, entry: desiredEntry };
      }
      return {
        action: { path: rendered.path, status: "conflict", message: "Existing or locally modified file preserved." },
        entry: prior,
      };
    }
    const status = current === undefined ? "created" : currentHash === desiredEntry.hash ? "unchanged" : "updated";
    if (!options.dryRun && status !== "unchanged") {
      await writeTarget(root, rendered.path, rendered.content);
    }
    return { action: { path: rendered.path, status }, entry: desiredEntry };
  }

  const id = rendered.blockId!;
  const existingBlock = current === undefined ? undefined : readManagedBlock(current, id);
  const existingHash = existingBlock === undefined ? undefined : hashContent(existingBlock.trimEnd());
  const isSafe =
    existingBlock === undefined ||
    existingHash === desiredEntry.hash ||
    (prior !== undefined && existingHash === prior.hash) ||
    options.force === true;
  if (!isSafe) {
    if (options.promptOverwrite && await options.promptOverwrite(rendered.path)) {
      const status = current === undefined || existingBlock === undefined ? "created" : "updated";
      if (!options.dryRun) {
        await writeTarget(root, rendered.path, upsertManagedBlock(current ?? "", rendered.content, id));
      }
      return { action: { path: rendered.path, status }, entry: desiredEntry };
    }
    return {
      action: { path: rendered.path, status: "conflict", message: "Locally modified managed block preserved." },
      entry: prior,
    };
  }
  const status = current === undefined || existingBlock === undefined
    ? "created"
    : existingHash === desiredEntry.hash
      ? "unchanged"
      : "updated";
  if (!options.dryRun && status !== "unchanged") {
    await writeTarget(root, rendered.path, upsertManagedBlock(current ?? "", rendered.content, id));
  }
  return { action: { path: rendered.path, status }, entry: desiredEntry };
}

async function removeEntry(
  root: string,
  entry: ManagedFileEntry,
  options: MutationOptions,
  reason = "Locally modified content preserved.",
): Promise<{ action: FileAction; retained: boolean }> {
  const absolute = path.join(root, entry.path);
  const current = await readMaybe(absolute);
  if (current === undefined) {
    return { action: { path: entry.path, status: "preserved", message: "Already missing." }, retained: false };
  }
  const managed = entry.kind === "block" && entry.blockId ? readManagedBlock(current, entry.blockId) : current;
  const unchanged = managed !== undefined && hashContent(managed.trimEnd()) === entry.hash;
  if (!unchanged && !options.force) {
    return { action: { path: entry.path, status: "conflict", message: reason }, retained: true };
  }
  if (!options.dryRun) {
    if (entry.kind === "file") {
      await unlink(absolute);
    } else {
      const remaining = removeManagedBlock(current, entry.blockId!);
      if (remaining.trim().length === 0) {
        await unlink(absolute);
      } else {
        await writeFile(absolute, remaining, "utf8");
      }
    }
  }
  return { action: { path: entry.path, status: "removed" }, retained: false };
}

export async function install(
  root: string,
  requestedAdapters: IdeId[],
  options: MutationOptions,
): Promise<OperationResult> {
  const priorManifest = await readManifest(root);
  const adapters = [...new Set([...(priorManifest?.adapters ?? []), ...requestedAdapters])];
  const errors = await validateRender(adapters);
  if (errors.length > 0) {
    return {
      actions: errors.map((message) => ({ path: "templates", status: "error", message })),
      conflicts: errors.length,
      changed: 0,
    };
  }
  const desired = await renderAdapters(adapters);
  const prior = priorByPath(priorManifest);
  const actions: FileAction[] = [];
  const entries: ManagedFileEntry[] = [];
  for (const rendered of desired) {
    const result = await applyRendered(root, rendered, prior.get(rendered.path), options);
    actions.push(result.action);
    if (result.entry) {
      entries.push(result.entry);
    }
  }
  const desiredPaths = new Set(desired.map((item) => item.path));
  for (const obsolete of priorManifest?.files ?? []) {
    if (desiredPaths.has(obsolete.path)) {
      continue;
    }
    const removal = await removeEntry(
      root,
      obsolete,
      options,
      "Obsolete managed content was edited locally and was preserved.",
    );
    actions.push(removal.action);
    if (removal.retained) {
      entries.push(obsolete);
    }
  }
  const now = new Date().toISOString();
  const manifest: InstallManifest = {
    schemaVersion: 1,
    packageVersion: options.packageVersion,
    templateVersion: TEMPLATE_VERSION,
    adapters,
    files: entries,
    installedAt: priorManifest?.installedAt ?? now,
    updatedAt: now,
  };
  if (!options.dryRun) {
    await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
    await writeManifest(root, manifest);
  }
  return summarize(actions);
}

export async function update(root: string, options: MutationOptions): Promise<OperationResult> {
  const manifest = await readManifest(root);
  if (!manifest) {
    return summarize([{ path: MANIFEST_PATH, status: "error", message: "Nothing installed; run install first." }]);
  }
  return install(root, manifest.adapters, options);
}

export async function uninstall(root: string, options: MutationOptions): Promise<OperationResult> {
  const manifest = await readManifest(root);
  if (!manifest) {
    return summarize([{ path: MANIFEST_PATH, status: "error", message: "Nothing installed." }]);
  }
  const actions: FileAction[] = [];
  const retained: ManagedFileEntry[] = [];
  for (const entry of manifest.files) {
    const removal = await removeEntry(root, entry, options);
    actions.push(removal.action);
    if (removal.retained) {
      retained.push(entry);
    }
  }
  if (!options.dryRun) {
    const manifestAbsolute = path.join(root, MANIFEST_PATH);
    if (retained.length === 0) {
      if (await exists(manifestAbsolute)) {
        await unlink(manifestAbsolute);
      }
    } else {
      await writeManifest(root, { ...manifest, files: retained, updatedAt: new Date().toISOString() });
    }
  }
  return summarize(actions);
}

function summarize(actions: FileAction[]): OperationResult {
  return {
    actions,
    conflicts: actions.filter((action) => action.status === "conflict" || action.status === "error").length,
    changed: actions.filter((action) => ["created", "updated", "removed"].includes(action.status)).length,
  };
}
