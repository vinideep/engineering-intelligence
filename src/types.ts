export const IDE_IDS = [
  "antigravity",
  "antigravity-cli",
  "codex",
  "claude-code",
  "cursor",
  "github-copilot",
  "gemini-cli",
  "commandcode",
  "generic",
] as const;

export type IdeId = (typeof IDE_IDS)[number];

/**
 * How a rendered artifact is owned on disk.
 *
 * file       — we own the whole file; local edits conflict on update.
 * block      — we own a marked region of a Markdown file.
 * seed       — we write it once if absent, then never touch it again. For files
 *              the USER is expected to edit (ei.config.json is how enforcement is
 *              turned on), so editing it must not raise a doctor warning or block
 *              the next update.
 * json-merge — we own only specific keys inside a JSON file the user also owns
 *              (their .claude/settings.json holds permissions, model, env). Ours
 *              are merged in and removed on uninstall; theirs are never touched.
 */
export type ManagedKind = "file" | "block" | "seed" | "json-merge";

export interface RenderedFile {
  path: string;
  content: string;
  kind: ManagedKind;
  blockId?: string;
  owners: IdeId[];
}

export interface ManagedFileEntry {
  path: string;
  kind: ManagedKind;
  hash: string;
  blockId?: string;
  owners: IdeId[];
}

export interface InstallManifest {
  schemaVersion: 1;
  packageVersion: string;
  templateVersion: string;
  adapters: IdeId[];
  files: ManagedFileEntry[];
  installedAt: string;
  updatedAt: string;
}

export type ActionStatus =
  | "created"
  | "updated"
  | "unchanged"
  | "removed"
  | "preserved"
  | "conflict"
  | "warning"
  | "error";

export interface FileAction {
  path: string;
  status: ActionStatus;
  message?: string;
}

export interface OperationResult {
  actions: FileAction[];
  conflicts: number;
  changed: number;
}
