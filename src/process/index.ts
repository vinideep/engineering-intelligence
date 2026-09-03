import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProcessRequest {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
}

export interface ProcessResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
}

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

export const runProcess: ProcessRunner = async (request) => {
  const args = request.args ?? [];
  try {
    const { stdout, stderr } = await execFileAsync(request.command, args, {
      cwd: request.cwd,
      env: request.env,
      timeout: request.timeoutMs ?? 30_000,
      maxBuffer: request.maxBuffer ?? 10 * 1024 * 1024,
      windowsHide: true,
      encoding: "utf8",
    });
    return { command: request.command, args, exitCode: 0, stdout, stderr, timedOut: false };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: string | number; killed?: boolean };
    const timedOut = failure.killed === true || failure.code === "ETIMEDOUT";
    return {
      command: request.command,
      args,
      exitCode: typeof failure.code === "number" ? failure.code : timedOut ? 124 : 1,
      stdout: typeof failure.stdout === "string" ? failure.stdout : "",
      stderr: typeof failure.stderr === "string" ? failure.stderr : "",
      timedOut,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/** Argument-array synchronous runner for legacy synchronous analysis paths. */
export function runProcessSync(request: ProcessRequest): ProcessResult {
  const args = request.args ?? [];
  const result = spawnSync(request.command, args, {
    cwd: request.cwd,
    env: request.env,
    timeout: request.timeoutMs ?? 30_000,
    maxBuffer: request.maxBuffer ?? 10 * 1024 * 1024,
    windowsHide: true,
    encoding: "utf8",
  });
  const timedOut = result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  return {
    command: request.command,
    args,
    exitCode: typeof result.status === "number" ? result.status : timedOut ? 124 : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: Boolean(timedOut),
    ...(result.error ? { error: result.error.message } : {}),
  };
}
