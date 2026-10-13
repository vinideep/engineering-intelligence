/**
 * Pre-rename (engineering-intelligence → GraphWard) compatibility.
 *
 * Projects installed before the rename keep their state in
 * `.engineering-intelligence/` with `ei.config.json`. Every entry point (CLI,
 * hooks, MCP server) calls `migrateLegacyLayout` first so that state is moved
 * once, atomically, instead of a fresh empty `.graphward/` silently shadowing it.
 */

import { existsSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const GW_DIR = ".graphward";
export const LEGACY_DIR = ".engineering-intelligence";
export const LEGACY_CONFIG_FILE = "ei.config.json";
export const CONFIG_FILE = "gw.config.json";

export interface LegacyMigration {
  migrated: boolean;
  /** Human-readable note when something was moved or needs manual attention. */
  message?: string;
}

/**
 * Move `.engineering-intelligence/` to `.graphward/` (and `ei.config.json` to
 * `gw.config.json`) when only the legacy layout exists. Never merges or
 * overwrites: if both directories exist the legacy one is left for the user.
 */
export function migrateLegacyLayout(root: string): LegacyMigration {
  const legacyDir = path.join(root, LEGACY_DIR);
  const gwDir = path.join(root, GW_DIR);
  let migrated = false;
  const notes: string[] = [];
  try {
    if (existsSync(legacyDir)) {
      if (!existsSync(gwDir)) {
        renameSync(legacyDir, gwDir);
        migrated = true;
        notes.push(`Moved ${LEGACY_DIR}/ to ${GW_DIR}/.`);
      } else {
        notes.push(`Both ${LEGACY_DIR}/ and ${GW_DIR}/ exist; ${GW_DIR}/ is used. Remove ${LEGACY_DIR}/ once nothing in it is needed.`);
      }
    }
    const legacyConfig = path.join(gwDir, LEGACY_CONFIG_FILE);
    const config = path.join(gwDir, CONFIG_FILE);
    if (existsSync(legacyConfig) && !existsSync(config)) {
      renameSync(legacyConfig, config);
      migrated = true;
      notes.push(`Renamed ${LEGACY_CONFIG_FILE} to ${CONFIG_FILE}.`);
    }
  } catch (error) {
    // Never block a command on migration; report and carry on with whatever exists.
    return { migrated, message: `Could not migrate ${LEGACY_DIR}/: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { migrated, ...(notes.length > 0 ? { message: notes.join(" ") } : {}) };
}

/**
 * `GW_*` environment variable, falling back to its pre-rename `EI_*` name.
 */
export function envWithLegacy(name: string): string | undefined {
  const value = process.env[`GW_${name}`];
  if (value !== undefined && value !== "") return value;
  const legacy = process.env[`EI_${name}`];
  return legacy !== undefined && legacy !== "" ? legacy : undefined;
}

/** Default home for managed providers, reusing a pre-rename install if present. */
export function defaultProviderHomeDir(): string {
  const configured = envWithLegacy("PROVIDER_HOME");
  if (configured) return path.resolve(configured);
  const current = path.join(os.homedir(), GW_DIR, "providers");
  const legacy = path.join(os.homedir(), LEGACY_DIR, "providers");
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}
