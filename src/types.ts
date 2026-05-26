export const IDE_IDS = [
  "antigravity",
  "codex",
  "claude-code",
  "cursor",
  "github-copilot",
  "gemini-cli",
  "generic",
] as const;

export type IdeId = (typeof IDE_IDS)[number];

export type ManagedKind = "file" | "block";

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
