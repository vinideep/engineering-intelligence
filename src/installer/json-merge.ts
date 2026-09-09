/**
 * Subtree-scoped merging for JSON config the user also owns.
 *
 * `.claude/settings.json` and `.cursor/hooks.json` are the user's files — they
 * hold permissions, model choice, env vars. Treating them as whole managed files
 * meant the most likely adopter (an existing Claude Code user, who therefore
 * already has a settings.json) got a conflict and the entire enforcement layer
 * silently did not install.
 *
 * Markdown solves this with comment sentinels (see blocks.ts); JSON has no such
 * affordance, so ownership is established by VALUE instead: an entry is ours iff
 * its command invokes `engineering-intelligence hook`. That makes merge, verify
 * and uninstall all decidable without storing a side-channel manifest of array
 * indices, and it survives the user reordering or adding their own hooks.
 */

const OWNERSHIP_MARKER = "engineering-intelligence hook";

/** The key under which we register ourselves in an `mcpServers` map. */
export const MCP_SERVER_KEY = "engineering-intelligence";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * True for an ARRAY ELEMENT that is ours — a hook entry invoking our CLI.
 * Deliberately only applied to elements: testing a whole container would claim
 * (and on uninstall destroy) the user's own hooks sitting beside ours.
 */
function isOurs(value: unknown): boolean {
  return JSON.stringify(value ?? "").includes(OWNERSHIP_MARKER);
}

/** True for an OBJECT KEY that is ours: our entry inside an `mcpServers` map. */
function isOurKey(parentKey: string | undefined, key: string): boolean {
  return parentKey === "mcpServers" && key === MCP_SERVER_KEY;
}

export function parseJsonOrEmpty(source: string | undefined): Json {
  if (!source || !source.trim()) return {};
  try {
    const parsed = JSON.parse(source) as unknown;
    return isObject(parsed) ? parsed : {};
  } catch {
    // Unparseable user config: treat as empty so we never destroy it — the
    // caller writes our keys alongside and the user's original stays on disk.
    return {};
  }
}

/**
 * Merge our hook config into the user's. Within `hooks`, each event's array
 * keeps every entry the user owns and replaces only the entries that are ours,
 * so re-running install is idempotent and never duplicates.
 */
export function mergeHookConfig(existingSource: string | undefined, oursSource: string): string {
  const existing = parseJsonOrEmpty(existingSource);
  const ours = parseJsonOrEmpty(oursSource);

  const merged: Json = { ...existing };
  for (const [topKey, ourValue] of Object.entries(ours)) {
    const theirValue = existing[topKey];
    if (!isObject(ourValue) || !isObject(theirValue)) {
      // `version`, or the user has nothing here yet — take ours wholesale.
      merged[topKey] = ourValue;
      continue;
    }
    const section: Json = { ...theirValue };
    for (const [event, ourEntries] of Object.entries(ourValue)) {
      const theirEntries = theirValue[event];
      if (!Array.isArray(ourEntries)) {
        section[event] = ourEntries;
        continue;
      }
      const kept = Array.isArray(theirEntries) ? theirEntries.filter((e) => !isOurs(e)) : [];
      section[event] = [...kept, ...ourEntries];
    }
    merged[topKey] = section;
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

/** Every entry we own is present in the file on disk. */
export function hasOurEntries(existingSource: string | undefined, oursSource: string): boolean {
  const existing = parseJsonOrEmpty(existingSource);
  const ours = parseJsonOrEmpty(oursSource);
  for (const [topKey, ourValue] of Object.entries(ours)) {
    if (!isObject(ourValue)) continue;
    const theirValue = existing[topKey];
    if (!isObject(theirValue)) return false;
    for (const [key, ourEntries] of Object.entries(ourValue)) {
      // Object-keyed ownership (mcpServers.engineering-intelligence).
      if (isOurKey(topKey, key)) {
        if (JSON.stringify(theirValue[key]) !== JSON.stringify(ourEntries)) return false;
        continue;
      }
      if (!Array.isArray(ourEntries)) continue;
      const theirEntries = theirValue[key];
      if (!Array.isArray(theirEntries)) return false;
      const theirOurs = JSON.stringify(theirEntries.filter((e) => isOurs(e)));
      for (const entry of ourEntries) {
        if (!theirOurs.includes(JSON.stringify(entry))) return false;
      }
    }
  }
  return true;
}

/**
 * Remove every entry we own, wherever it sits. Because ownership is decided by
 * the marker rather than by position, uninstall needs no record of what we wrote
 * — it just drops what invokes our CLI and prunes containers left empty.
 *
 * Returns the remaining JSON, or null when nothing of the user's is left, so the
 * caller can delete the file instead of leaving an empty husk.
 */
export function removeOurEntries(existingSource: string | undefined): string | null {
  const prune = (value: unknown, parentKey?: string): unknown => {
    if (Array.isArray(value)) {
      // Ownership is decided per ELEMENT. Testing a whole container would drop
      // the user's own hooks whenever one of ours happened to sit beside them.
      const kept = value
        .filter((e) => !isOurs(e))
        .map((e) => prune(e, parentKey))
        .filter((e) => e !== undefined);
      return kept.length > 0 ? kept : undefined;
    }
    if (isObject(value)) {
      const out: Json = {};
      for (const [k, v] of Object.entries(value)) {
        if (isOurKey(parentKey, k)) continue; // our MCP server registration
        const pruned = prune(v, k);
        if (pruned !== undefined) out[k] = pruned;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    }
    return value;
  };

  const remaining = prune(parseJsonOrEmpty(existingSource));
  if (remaining === undefined || !isObject(remaining)) return null;
  return `${JSON.stringify(remaining, null, 2)}\n`;
}
