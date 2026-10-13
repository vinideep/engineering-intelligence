/**
 * The single list of source extensions the graph understands. Every consumer
 * (file collection, incremental rebuild, import parsing, symbol extraction,
 * flight tracking) must agree, or a file is parsed by one stage and invisible to
 * another — `.jsx` files used to be collected nowhere and `.mts` only partly.
 */

/** JavaScript/TypeScript family — parsed for imports and symbols. */
export const JS_FAMILY_EXTS: ReadonlySet<string> = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

/** Every extension that becomes a graph module node. */
export const GRAPH_SOURCE_EXTS: ReadonlySet<string> = new Set([...JS_FAMILY_EXTS, ".py", ".go", ".rs", ".rb", ".java", ".kt"]);

/** Same set as a path-suffix test (case-sensitive, like the extension sets). */
export const SOURCE_EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|go|rs|rb|java|kt)$/;

/** Strip a graph source extension to form a stable `module:` id path. */
export function stripSourceExt(relPath: string): string {
  return relPath.replace(SOURCE_EXT_RE, "");
}
