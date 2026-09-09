import { spawn, spawnSync } from "node:child_process";

export interface ProcessRequest {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
  onChunk?: (chunk: string, source: "stdout" | "stderr") => void;
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

export const runProcess: ProcessRunner = (request) => {
  return new Promise((resolve) => {
    const args = request.args ?? [];
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    const maxBuffer = request.maxBuffer ?? 10 * 1024 * 1024;

    let child;
    try {
      child = spawn(request.command, args, {
        cwd: request.cwd,
        env: request.env,
        windowsHide: true,
      });
    } catch (error) {
      resolve({
        command: request.command,
        args,
        exitCode: 1,
        stdout: "",
        stderr: "",
        timedOut: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (request.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 3000);
      }, request.timeoutMs);
    }

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length + chunk.length <= maxBuffer) {
        stdout += chunk;
      }
      request.onChunk?.(chunk, "stdout");
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length + chunk.length <= maxBuffer) {
        stderr += chunk;
      }
      request.onChunk?.(chunk, "stderr");
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({
        command: request.command,
        args,
        exitCode: 1,
        stdout,
        stderr,
        timedOut,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        command: request.command,
        args,
        exitCode: timedOut ? 124 : (code ?? 0),
        stdout,
        stderr,
        timedOut,
      });
    });
  });
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
