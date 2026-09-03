import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEiConfig, type ProviderPolicy } from "../config/index.js";
import { runProcess, type ProcessRunner } from "../process/index.js";
import { PROVIDER_COMPATIBILITY } from "./compatibility.js";
import { ensureProviderCacheIgnored, PROVIDER_DIR } from "./workspace.js";
import { PROVIDER_NAMES, type PrepareProvidersOptions, type PrepareProvidersResult, type ProjectProviderManifest, type ProviderName, type ProviderStatus } from "./types.js";

export const PROVIDER_MANIFEST_PATH = `${PROVIDER_DIR}/manifest.json`;
const LOCK_STALE_MS = 15 * 60 * 1000;

function platformKey(): string {
  return `${process.platform}-${process.arch}`;
}

export function defaultProviderHome(): string {
  return process.env.EI_PROVIDER_HOME
    ? path.resolve(process.env.EI_PROVIDER_HOME)
    : path.join(os.homedir(), ".engineering-intelligence", "providers");
}

export function managedProviderPaths(name: ProviderName, providerHome = defaultProviderHome()) {
  const provider = PROVIDER_COMPATIBILITY[name];
  const versionRoot = path.join(providerHome, name, provider.version, platformKey());
  const executable = path.join(versionRoot, "bin", process.platform === "win32" ? `${provider.executable}.exe` : provider.executable);
  return { versionRoot, toolDir: path.join(versionRoot, "tools"), binDir: path.join(versionRoot, "bin"), executable };
}

function providerPathsAt(name: ProviderName, versionRoot: string) {
  const provider = PROVIDER_COMPATIBILITY[name];
  return {
    versionRoot,
    toolDir: path.join(versionRoot, "tools"),
    binDir: path.join(versionRoot, "bin"),
    executable: path.join(versionRoot, "bin", process.platform === "win32" ? `${provider.executable}.exe` : provider.executable),
  };
}

function versionFrom(text: string): string | undefined {
  return text.match(/\b\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/)?.[0];
}

async function fingerprint(executable: string): Promise<string | undefined> {
  try { return createHash("sha256").update(await readFile(executable)).digest("hex"); } catch { return undefined; }
}

interface CurrentProviderRelease {
  version?: string;
  platform?: string;
  executable?: string;
  fingerprint?: string;
  activatedAt?: string;
  previousExecutable?: string;
}

async function currentProviderRelease(name: ProviderName, providerHome: string): Promise<CurrentProviderRelease | undefined> {
  const currentPath = path.join(providerHome, name, "current.json");
  let parsed: CurrentProviderRelease;
  try { parsed = JSON.parse(await readFile(currentPath, "utf8")) as CurrentProviderRelease; } catch { return undefined; }
  if (!parsed.executable) return undefined;
  const allowedRoot = path.resolve(providerHome, name);
  const executable = path.resolve(parsed.executable);
  if (executable !== allowedRoot && !executable.startsWith(`${allowedRoot}${path.sep}`)) {
    return { ...parsed, executable: undefined };
  }
  return { ...parsed, executable };
}

async function probeExecutable(name: ProviderName, executable: string, source: "managed" | "system", runner: ProcessRunner): Promise<ProviderStatus | undefined> {
  const provider = PROVIDER_COMPATIBILITY[name];
  const result = await runner({ command: executable, args: provider.versionArgs, timeoutMs: 20_000 });
  if (result.exitCode !== 0) return undefined;
  const detectedVersion = versionFrom(`${result.stdout}\n${result.stderr}`);
  const compatible = detectedVersion === provider.version;
  return {
    name,
    displayName: provider.displayName,
    purpose: provider.purpose,
    health: compatible ? "healthy" : "degraded",
    requiredVersion: provider.version,
    detectedVersion,
    executable,
    source,
    fingerprint: source === "managed" ? await fingerprint(executable) : undefined,
    message: compatible ? `${provider.displayName} ${detectedVersion} is ready.` : `${provider.displayName} version ${detectedVersion ?? "unknown"} does not match EI's tested ${provider.version}.`,
    remediation: compatible ? undefined : [`Run engineering-intelligence providers install ${name} to install the tested managed version.`],
    checkedAt: new Date().toISOString(),
  };
}

export async function providerStatus(name: ProviderName, options: { providerHome?: string; runner?: ProcessRunner; disabled?: boolean } = {}): Promise<ProviderStatus> {
  const provider = PROVIDER_COMPATIBILITY[name];
  if (options.disabled) {
    return { name, displayName: provider.displayName, purpose: provider.purpose, health: "disabled", requiredVersion: provider.version, message: "Disabled by native provider policy.", checkedAt: new Date().toISOString() };
  }
  const runner = options.runner ?? runProcess;
  const providerHome = options.providerHome ?? defaultProviderHome();
  const current = await currentProviderRelease(name, providerHome);
  if (current && !current.executable) {
    return { name, displayName: provider.displayName, purpose: provider.purpose, health: "error", requiredVersion: provider.version, message: "The managed provider activation record points outside EI's provider directory and was rejected.", remediation: [`Run engineering-intelligence providers repair ${name}.`], checkedAt: new Date().toISOString() };
  }
  if (current?.executable) {
    const actualFingerprint = await fingerprint(current.executable);
    if (current.fingerprint && actualFingerprint !== current.fingerprint) {
      return { name, displayName: provider.displayName, purpose: provider.purpose, health: "error", requiredVersion: provider.version, executable: current.executable, source: "managed", fingerprint: actualFingerprint, message: "The managed provider executable fingerprint changed after activation and was rejected.", remediation: [`Run engineering-intelligence providers repair ${name}.`], checkedAt: new Date().toISOString() };
    }
    const activeStatus = await probeExecutable(name, current.executable, "managed", runner);
    if (activeStatus) return activeStatus;
  }
  const managed = managedProviderPaths(name, providerHome);
  const managedStatus = await probeExecutable(name, managed.executable, "managed", runner);
  if (managedStatus) return managedStatus;
  const systemStatus = await probeExecutable(name, provider.executable, "system", runner);
  if (systemStatus) return systemStatus;
  return {
    name,
    displayName: provider.displayName,
    purpose: provider.purpose,
    health: "missing",
    requiredVersion: provider.version,
    message: `${provider.displayName} is not installed or did not pass its version handshake.`,
    remediation: ["Install uv from https://docs.astral.sh/uv/.", `Run engineering-intelligence providers install ${name}.`],
    checkedAt: new Date().toISOString(),
  };
}

async function withLock<T>(providerHome: string, work: () => Promise<T>, timeoutMs = 15_000): Promise<T> {
  await mkdir(providerHome, { recursive: true });
  const lockPath = path.join(providerHome, ".install.lock");
  const checkDeadAndUnlink = async () => {
    try {
      const info = await stat(lockPath);
      let isDead = false;
      try {
        const text = await readFile(lockPath, "utf8");
        const content = JSON.parse(text) as { pid?: number };
        if (typeof content.pid === "number") {
          if (content.pid === process.pid) {
            isDead = true;
          } else {
            try {
              process.kill(content.pid, 0);
            } catch (error) {
              const err = error as NodeJS.ErrnoException;
              if (err.code === "ESRCH") isDead = true;
            }
          }
        } else {
          isDead = true;
        }
      } catch {
        isDead = true;
      }
      if (isDead || Date.now() - info.mtimeMs > LOCK_STALE_MS) {
        await unlink(lockPath).catch(() => undefined);
      }
    } catch { /* no lock */ }
  };

  const startTime = Date.now();
  let handle;
  while (!handle) {
    await checkDeadAndUnlink();
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      break;
    } catch {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Another EI provider operation holds ${lockPath}. Retry after it finishes.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  try {
    return await work();
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
    }
  }
}

function managedEnv(paths: ReturnType<typeof managedProviderPaths>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    UV_TOOL_DIR: paths.toolDir,
    UV_TOOL_BIN_DIR: paths.binDir,
    PATH: `${paths.binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    NO_COLOR: "1",
  };
}

export interface InstallProviderOptions {
  providerHome?: string;
  runner?: ProcessRunner;
  dryRun?: boolean;
  onProgress?: (message: string) => void;
}

export async function installProvider(name: ProviderName, options: InstallProviderOptions = {}): Promise<ProviderStatus> {
  const runner = options.runner ?? runProcess;
  const providerHome = options.providerHome ?? defaultProviderHome();
  const provider = PROVIDER_COMPATIBILITY[name];
  const paths = managedProviderPaths(name, providerHome);
  if (options.dryRun) {
    return { name, displayName: provider.displayName, purpose: provider.purpose, health: "missing", requiredVersion: provider.version, message: `Would install ${provider.package}==${provider.version} into ${paths.versionRoot}.`, checkedAt: new Date().toISOString() };
  }
  return withLock(providerHome, async () => {
    options.onProgress?.(`Checking uv package manager for ${provider.displayName}...`);
    const uv = await runner({ command: "uv", args: ["--version"], timeoutMs: 15_000 });
    if (uv.exitCode !== 0) {
      return {
        name,
        displayName: provider.displayName,
        purpose: provider.purpose,
        health: "unsupported",
        requiredVersion: provider.version,
        message: "uv is required and was not found; EI requires uv to manage Graphify and CCE tools.",
        remediation: [
          "Install uv with: curl -LsSf https://astral.sh/uv/install.sh | sh (macOS/Linux) or brew install uv",
          `Then run: engineering-intelligence providers install ${name}`,
        ],
        checkedAt: new Date().toISOString(),
      };
    }
    const transactionId = randomUUID();
    // Python tool environments are not relocatable: console-script shebangs and
    // uv shims may contain absolute paths. Install into an immutable release
    // directory, validate there, then atomically switch only current.json.
    const staging = providerPathsAt(name, path.join(paths.versionRoot, "releases", transactionId));
    await mkdir(staging.versionRoot, { recursive: true });
    const spec = `${provider.package}==${provider.version}`;
    options.onProgress?.(`Installing ${provider.displayName} (${spec}) via uv...`);
    const installed = await runner({ command: "uv", args: ["tool", "install", "--force", spec], env: managedEnv(staging), timeoutMs: 10 * 60_000, maxBuffer: 20 * 1024 * 1024 });
    if (installed.exitCode !== 0) {
      await rm(staging.versionRoot, { recursive: true, force: true });
      return { name, displayName: provider.displayName, purpose: provider.purpose, health: "error", requiredVersion: provider.version, message: `Installation failed: ${(installed.stderr || installed.error || "unknown error").trim().slice(-1000)}`, remediation: provider.prerequisites.map((item) => `Verify prerequisite: ${item}`), checkedAt: new Date().toISOString() };
    }
    const stagedStatus = await probeExecutable(name, staging.executable, "managed", runner);
    if (stagedStatus?.health !== "healthy") {
      await rm(staging.versionRoot, { recursive: true, force: true });
      return stagedStatus ?? { name, displayName: provider.displayName, purpose: provider.purpose, health: "error", requiredVersion: provider.version, message: "The staged provider failed its version handshake; the previous healthy version remains active.", checkedAt: new Date().toISOString() };
    }
    const currentPath = path.join(providerHome, name, "current.json");
    let previousCurrent: string | undefined;
    let previousExecutable: string | undefined;
    try {
      previousCurrent = await readFile(currentPath, "utf8");
      previousExecutable = (JSON.parse(previousCurrent) as CurrentProviderRelease).executable;
    } catch { /* first activation */ }
    const temporary = `${currentPath}.tmp-${randomUUID()}`;
    try {
      await mkdir(path.dirname(currentPath), { recursive: true });
      await writeFile(temporary, `${JSON.stringify({ version: provider.version, platform: platformKey(), executable: staging.executable, fingerprint: stagedStatus.fingerprint, previousExecutable, activatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
      await rename(temporary, currentPath);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      await rm(staging.versionRoot, { recursive: true, force: true });
      return { name, displayName: provider.displayName, purpose: provider.purpose, health: "error", requiredVersion: provider.version, message: `Provider activation failed; the previous version remains active: ${error instanceof Error ? error.message : String(error)}`, checkedAt: new Date().toISOString() };
    }
    const status = await providerStatus(name, { providerHome, runner });
    if (status?.health !== "healthy") {
      if (previousCurrent !== undefined) {
        const restore = `${currentPath}.tmp-${randomUUID()}`;
        await writeFile(restore, previousCurrent, "utf8");
        await rename(restore, currentPath);
      } else {
        await unlink(currentPath).catch(() => undefined);
      }
      await rm(staging.versionRoot, { recursive: true, force: true });
      return status ?? { name, displayName: provider.displayName, purpose: provider.purpose, health: "error", requiredVersion: provider.version, message: "Activated provider failed its health check; the previous version was restored.", checkedAt: new Date().toISOString() };
    }
    options.onProgress?.(`${provider.displayName} is installed and healthy.`);
    return status;
  });
}

async function writeProjectManifest(root: string, manifest: ProjectProviderManifest): Promise<void> {
  const location = path.join(root, PROVIDER_MANIFEST_PATH);
  const temporary = `${location}.tmp-${randomUUID()}`;
  await mkdir(path.dirname(location), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporary, location);
}

export async function readProviderManifest(root: string): Promise<ProjectProviderManifest | undefined> {
  try { return JSON.parse(await readFile(path.join(root, PROVIDER_MANIFEST_PATH), "utf8")) as ProjectProviderManifest; } catch { return undefined; }
}

export async function prepareProviders(root: string, options: PrepareProvidersOptions & { runner?: ProcessRunner } = {}): Promise<PrepareProvidersResult> {
  if (!options.dryRun) await ensureProviderCacheIgnored(root);
  const config = await loadEiConfig(root);
  const policy: ProviderPolicy = options.policy ?? config.providers.policy ?? "auto";
  const offline = options.offline ?? config.providers.offline ?? false;
  const requireProviders = options.requireProviders ?? config.providers.requireProviders ?? false;
  const expertMode = options.expertMode ?? config.providers.exposeRawMcp ?? false;
  const actions: string[] = [];
  const statuses: ProviderStatus[] = [];
  for (const name of PROVIDER_NAMES) {
    let status = await providerStatus(name, { providerHome: options.providerHome, runner: options.runner, disabled: policy === "native" });
    if (status.health === "missing" || status.health === "degraded") {
      if (policy !== "native" && options.installMissing && !offline) {
        status = await installProvider(name, { providerHome: options.providerHome, runner: options.runner, dryRun: options.dryRun, onProgress: options.onProgress });
        actions.push(`${name}: ${status.message}`);
      } else if (offline) {
        status = { ...status, health: "degraded", message: `${status.message} Offline mode prevented installation; native fallback is active.` };
      }
    }
    statuses.push(status);
  }
  const unavailable = statuses.filter((status) => status.health !== "healthy" && status.health !== "disabled");
  const degraded = policy !== "native" && unavailable.length > 0;
  const ok = !requireProviders || unavailable.length === 0;
  const manifest: ProjectProviderManifest = {
    schemaVersion: 1,
    policy,
    offline,
    requireProviders,
    expertMode,
    providers: statuses,
    updatedAt: new Date().toISOString(),
  };
  if (!options.dryRun) await writeProjectManifest(root, manifest);
  return { ok, degraded, policy, statuses, actions, manifestPath: PROVIDER_MANIFEST_PATH };
}

export async function purgeProjectProviderCache(root: string): Promise<void> {
  await rm(path.join(root, PROVIDER_DIR), { recursive: true, force: true });
}
