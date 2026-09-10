import { estimateTokens } from "../token-optimizer.js";

export interface SkeletonResult {
  skeleton: string;
  originalTokens: number;
  skeletonTokens: number;
  reductionRatio: number;
}

/**
 * Generate a progressive code skeleton preserving type/interface contracts,
 * class structures, and function/method signatures while folding function bodies.
 */
export function generateCodeSkeleton(content: string, filePath: string): SkeletonResult {
  const originalTokens = estimateTokens(content);
  if (!content.trim()) {
    return {
      skeleton: content,
      originalTokens: 0,
      skeletonTokens: 0,
      reductionRatio: 0,
    };
  }

  const isPython = filePath.endsWith(".py");
  let skeleton: string;

  if (isPython) {
    skeleton = skeletonizePython(content);
  } else {
    skeleton = skeletonizeCStyle(content);
  }

  const skeletonTokens = estimateTokens(skeleton);
  const reductionRatio = originalTokens > 0
    ? Number(Math.max(0, (originalTokens - skeletonTokens) / originalTokens).toFixed(2))
    : 0;

  return {
    skeleton,
    originalTokens,
    skeletonTokens,
    reductionRatio,
  };
}

function skeletonizePython(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let inFuncBody = false;
  let funcIndent = 0;
  let omittedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inFuncBody) {
      const currentIndent = line.search(/\S/);
      if (currentIndent > funcIndent || (trimmed === "" && i + 1 < lines.length && lines[i + 1].search(/\S/) > funcIndent)) {
        omittedLines++;
        continue;
      } else {
        output.push(`${" ".repeat(funcIndent + 4)}# ... implementation omitted (${omittedLines} lines) ...`);
        output.push(`${" ".repeat(funcIndent + 4)}pass`);
        inFuncBody = false;
        omittedLines = 0;
      }
    }

    if (/^(?:async\s+)?def\s+/.test(trimmed)) {
      output.push(line);
      funcIndent = line.search(/\S/);
      inFuncBody = true;
      omittedLines = 0;
      continue;
    }

    output.push(line);
  }

  if (inFuncBody && omittedLines > 0) {
    output.push(`${" ".repeat(funcIndent + 4)}# ... implementation omitted (${omittedLines} lines) ...`);
    output.push(`${" ".repeat(funcIndent + 4)}pass`);
  }

  return output.join("\n");
}

function skeletonizeCStyle(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let inFoldedBody = false;
  let braceDepth = 0;
  let bodyStartBraceDepth = 0;
  let omittedLines = 0;
  let foldIndent = "";
  let inInterfaceOrType = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track interface or type alias declarations so we don't fold their definitions
    if (/^(?:export\s+)?interface\s+/.test(trimmed)) {
      inInterfaceOrType = true;
    }

    // Count net braces on this line, taking quotes and comments into account
    const { opens, closes } = countSignificantBraces(line);

    if (inFoldedBody) {
      braceDepth += opens - closes;
      if (braceDepth <= bodyStartBraceDepth) {
        // We have closed the folded body
        output.push(`${foldIndent}  /* ... implementation omitted (${omittedLines} lines) ... */`);
        output.push(line); // includes the closing brace
        inFoldedBody = false;
        omittedLines = 0;
      } else {
        omittedLines++;
      }
      continue;
    }

    // Detect function, method, constructor, or arrow function body start
    const isFunctionHeader =
      !inInterfaceOrType &&
      (
        /^(?:export\s+)?(?:async\s+)?function(?:\s|\*)/.test(trimmed) ||
        /^(?:export\s+)?(?:default\s+)?class\s+/.test(trimmed) ||
        /^(?:public|private|protected|static|async|\*|\s)*(?:constructor|get|set|[a-zA-Z0-9_$]+)\s*\([^)]*\)/.test(trimmed) ||
        /^(?:export\s+)?(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/.test(trimmed)
      );

    if (isFunctionHeader && opens > closes && !/^(?:export\s+)?(?:default\s+)?class\s+/.test(trimmed)) {
      output.push(line);
      inFoldedBody = true;
      bodyStartBraceDepth = braceDepth;
      braceDepth += opens - closes;
      foldIndent = line.match(/^(\s*)/)?.[1] ?? "";
      omittedLines = 0;
      continue;
    }

    braceDepth += opens - closes;
    if (inInterfaceOrType && braceDepth <= 0) {
      inInterfaceOrType = false;
    }

    output.push(line);
  }

  return output.join("\n");
}

function countSignificantBraces(line: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  let inString: string | null = null;
  let inLineComment = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const prev = i > 0 ? line[i - 1] : "";

    if (inLineComment) break;

    if (inString) {
      if (char === inString && prev !== "\\") {
        inString = null;
      }
      continue;
    }

    if (char === "/" && line[i + 1] === "/") {
      inLineComment = true;
      break;
    }

    if ((char === '"' || char === "'" || char === "`") && prev !== "\\") {
      inString = char;
      continue;
    }

    if (char === "{") opens++;
    else if (char === "}") closes++;
  }

  return { opens, closes };
}
