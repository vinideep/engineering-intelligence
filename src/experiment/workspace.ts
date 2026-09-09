import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { runProcess, runProcessSync } from "../process/index.js";

export interface WorktreeSession {
  worktreeDir: string;
  cleanup: () => Promise<void>;
  createPatch: () => Promise<string>;
  applyPatchToMain: () => Promise<void>;
}

export interface IsolatedWorktreeOptions {
  id?: string;
  copyDirty?: boolean;
}

function gitSync(cwd: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  return runProcessSync({ command: "git", args, cwd, timeoutMs: 30_000 });
}

async function gitAsync(cwd: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return runProcess({ command: "git", args, cwd, timeoutMs: 60_000 });
}

export async function createIsolatedWorktree(
  root: string,
  options: IsolatedWorktreeOptions = {},
): Promise<WorktreeSession> {
  const prefix = options.id ? `ei-wt-${options.id}-` : "ei-wt-";
  const parentDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const worktreeDir = path.join(parentDir, "worktree");

  // Detached checkout of HEAD into worktree
  const addRes = await gitAsync(root, ["worktree", "add", "--detach", "--quiet", worktreeDir, "HEAD"]);
  if (addRes.exitCode !== 0) {
    await rm(parentDir, { recursive: true, force: true });
    throw new Error(`Failed to create git worktree: ${addRes.stderr || addRes.stdout}`);
  }

  // Symlink node_modules if present in root to avoid reinstall
  const rootNodeModules = path.join(root, "node_modules");
  const wtNodeModules = path.join(worktreeDir, "node_modules");
  if (existsSync(rootNodeModules) && !existsSync(wtNodeModules)) {
    try {
      await symlink(rootNodeModules, wtNodeModules, "dir");
    } catch {
      // Symlink non-fatal if cross-device or permission restricted
    }
  }

  // If copyDirty is requested, capture git diff from root and apply to worktree
  if (options.copyDirty) {
    const diffRes = await gitAsync(root, ["diff", "HEAD"]);
    if (diffRes.exitCode === 0 && diffRes.stdout.trim().length > 0) {
      const patchPath = path.join(parentDir, "dirty.patch");
      await writeFile(patchPath, diffRes.stdout, "utf8");
      await gitAsync(worktreeDir, ["apply", "--whitespace=nowarn", patchPath]);
    }
  }

  let cleanedUp = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      gitSync(root, ["worktree", "remove", "--force", worktreeDir]);
    } catch {
      // Best effort
    }
    try {
      await rm(parentDir, { recursive: true, force: true });
    } catch {
      // Best effort
    }
  };

  const createPatch = async (): Promise<string> => {
    const res = await gitAsync(worktreeDir, ["diff", "HEAD"]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to generate diff patch: ${res.stderr}`);
    }
    return res.stdout;
  };

  const applyPatchToMain = async (): Promise<void> => {
    const patch = await createPatch();
    if (!patch.trim()) return;
    const patchPath = path.join(parentDir, "export.patch");
    await writeFile(patchPath, patch, "utf8");
    const applyRes = await gitAsync(root, ["apply", "--whitespace=nowarn", patchPath]);
    if (applyRes.exitCode !== 0) {
      throw new Error(`Failed to apply worktree patch to root workspace: ${applyRes.stderr}`);
    }
  };

  return {
    worktreeDir,
    cleanup,
    createPatch,
    applyPatchToMain,
  };
}

export async function withIsolatedWorktree<T>(
  root: string,
  fn: (session: WorktreeSession) => Promise<T>,
  options?: IsolatedWorktreeOptions,
): Promise<T> {
  const session = await createIsolatedWorktree(root, options);
  try {
    return await fn(session);
  } finally {
    await session.cleanup();
  }
}
