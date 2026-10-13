const START = (id: string): string => `<!-- ${id}:start -->`;
const END = (id: string): string => `<!-- ${id}:end -->`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Block ids written by pre-rename releases, keyed by their current id. */
const LEGACY_BLOCK_IDS: Record<string, readonly string[]> = {
  graphward: ["engineering-intelligence"],
};

/**
 * If `source` has no block for `id` but has one under a legacy id, relabel the
 * legacy markers in place so the existing content is updated (not duplicated).
 */
export function adoptLegacyBlock(source: string, id: string): string {
  if (readManagedBlock(source, id) !== undefined) return source;
  for (const legacy of LEGACY_BLOCK_IDS[id] ?? []) {
    if (readManagedBlock(source, legacy) !== undefined) {
      return source.replace(START(legacy), START(id)).replace(END(legacy), END(id));
    }
  }
  return source;
}

export function managedBlock(content: string, id: string): string {
  return `${START(id)}\n${content.trimEnd()}\n${END(id)}`;
}

export function readManagedBlock(source: string, id: string): string | undefined {
  const expression = new RegExp(
    `${escapeRegExp(START(id))}\\n([\\s\\S]*?)\\n${escapeRegExp(END(id))}`,
  );
  return expression.exec(source)?.[1];
}

export function upsertManagedBlock(source: string, content: string, id: string): string {
  const replacement = managedBlock(content, id);
  const expression = new RegExp(
    `${escapeRegExp(START(id))}\\n[\\s\\S]*?\\n${escapeRegExp(END(id))}`,
  );
  if (expression.test(source)) {
    return source.replace(expression, replacement);
  }
  const prefix = source.length === 0 ? "" : `${source.trimEnd()}\n\n`;
  return `${prefix}${replacement}\n`;
}

export function removeManagedBlock(source: string, id: string): string {
  const expression = new RegExp(
    `\\n?${escapeRegExp(START(id))}\\n[\\s\\S]*?\\n${escapeRegExp(END(id))}\\n?`,
  );
  const remaining = source.replace(expression, "\n").trimEnd();
  return remaining.length > 0 ? `${remaining}\n` : "";
}
