import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const EI_CONFIG_PATH = ".engineering-intelligence/ei.config.json";
export const LEGACY_CONFIG_PATH = ".engineering-intelligence/config.json";
export const EI_CONFIG_SCHEMA_VERSION = 2;

export type ProviderPolicy = "auto" | "full" | "native";

export interface ProjectFilesConfig {
  roots?: string[];
  include?: string[];
  exclude?: string[];
}

export interface ProvidersConfig {
  policy?: ProviderPolicy;
  offline?: boolean;
  requireProviders?: boolean;
  exposeRawMcp?: boolean;
}

export interface EiConfig {
  schemaVersion: number;
  hooks?: Record<string, unknown>;
  tokenBudgets: Record<string, number>;
  projectFiles: ProjectFilesConfig;
  providers: ProvidersConfig;
  [key: string]: unknown;
}

const DEFAULT_CONFIG: EiConfig = {
  schemaVersion: EI_CONFIG_SCHEMA_VERSION,
  hooks: {},
  tokenBudgets: {},
  projectFiles: {},
  providers: {
    policy: "auto",
    offline: false,
    requireProviders: false,
    exposeRawMcp: false,
  },
};

async function readJson(location: string): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = JSON.parse(await readFile(location, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function numbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0),
  );
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  return result.length > 0 ? result : undefined;
}

function normalizeConfig(raw: Record<string, unknown>, legacy: Record<string, unknown> = {}): EiConfig {
  const projectFiles = raw.projectFiles && typeof raw.projectFiles === "object" && !Array.isArray(raw.projectFiles)
    ? raw.projectFiles as Record<string, unknown>
    : {};
  const providers = raw.providers && typeof raw.providers === "object" && !Array.isArray(raw.providers)
    ? raw.providers as Record<string, unknown>
    : {};
  const rawPolicy = providers.policy;
  const policy: ProviderPolicy = rawPolicy === "full" || rawPolicy === "native" ? rawPolicy : "auto";
  return {
    ...raw,
    schemaVersion: EI_CONFIG_SCHEMA_VERSION,
    hooks: raw.hooks && typeof raw.hooks === "object" && !Array.isArray(raw.hooks)
      ? raw.hooks as Record<string, unknown>
      : {},
    tokenBudgets: {
      ...numbers(legacy.tokenBudgets),
      ...numbers(raw.tokenBudgets),
    },
    projectFiles: {
      roots: strings(projectFiles.roots),
      include: strings(projectFiles.include),
      exclude: strings(projectFiles.exclude),
    },
    providers: {
      policy,
      offline: providers.offline === true,
      requireProviders: providers.requireProviders === true,
      exposeRawMcp: providers.exposeRawMcp === true,
    },
  };
}

export async function loadEiConfig(root: string): Promise<EiConfig> {
  const [raw, legacy] = await Promise.all([
    readJson(path.join(root, EI_CONFIG_PATH)),
    readJson(path.join(root, LEGACY_CONFIG_PATH)),
  ]);
  return normalizeConfig(raw ?? DEFAULT_CONFIG, legacy);
}

export function defaultEiConfig(overrides: Record<string, unknown> = {}): EiConfig {
  return normalizeConfig({ ...DEFAULT_CONFIG, ...overrides });
}

/**
 * Consolidate the legacy token-budget file into ei.config.json. The write is
 * atomic and unknown user keys are preserved. The legacy file is deliberately
 * not deleted: removing user-owned configuration needs an explicit cleanup.
 */
export async function migrateEiConfig(root: string): Promise<{ changed: boolean; path: string; config: EiConfig }> {
  const configPath = path.join(root, EI_CONFIG_PATH);
  const [raw, legacy] = await Promise.all([readJson(configPath), readJson(path.join(root, LEGACY_CONFIG_PATH))]);
  const config = normalizeConfig(raw ?? DEFAULT_CONFIG, legacy);
  const current = raw ? `${JSON.stringify(raw, null, 2)}\n` : undefined;
  const desired = `${JSON.stringify(config, null, 2)}\n`;
  if (current === desired) return { changed: false, path: EI_CONFIG_PATH, config };
  await mkdir(path.dirname(configPath), { recursive: true });
  const temporary = `${configPath}.tmp-${process.pid}`;
  await writeFile(temporary, desired, "utf8");
  await rename(temporary, configPath);
  return { changed: true, path: EI_CONFIG_PATH, config };
}

export async function setProviderExpertMode(root: string, enabled: boolean): Promise<EiConfig> {
  return updateProviderConfig(root, { exposeRawMcp: enabled });
}

export async function updateProviderConfig(root: string, patch: Partial<ProvidersConfig>): Promise<EiConfig> {
  const config = await loadEiConfig(root);
  const updated: EiConfig = { ...config, providers: { ...config.providers, ...patch } };
  const configPath = path.join(root, EI_CONFIG_PATH);
  const temporary = `${configPath}.tmp-${process.pid}`;
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  await rename(temporary, configPath);
  return updated;
}
