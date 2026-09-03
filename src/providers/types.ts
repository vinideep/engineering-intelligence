import type { ProviderPolicy } from "../config/index.js";

export const PROVIDER_NAMES = ["graphify", "cce"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];
export type ProviderHealth = "healthy" | "degraded" | "missing" | "disabled" | "unsupported" | "error";

export interface ProviderCompatibility {
  name: ProviderName;
  displayName: string;
  package: string;
  version: string;
  executable: string;
  versionArgs: string[];
  purpose: "structure" | "retrieval";
  localOnly: boolean;
  prerequisites: string[];
}

export interface ProviderStatus {
  name: ProviderName;
  displayName: string;
  purpose: "structure" | "retrieval";
  health: ProviderHealth;
  requiredVersion: string;
  detectedVersion?: string;
  executable?: string;
  source?: "managed" | "system";
  fingerprint?: string;
  message: string;
  remediation?: string[];
  checkedAt: string;
}

export interface ProjectProviderManifest {
  schemaVersion: 1;
  policy: ProviderPolicy;
  offline: boolean;
  requireProviders: boolean;
  expertMode: boolean;
  sourceCommit?: string;
  workspaceHash?: string;
  providers: ProviderStatus[];
  updatedAt: string;
}

export interface PrepareProvidersOptions {
  policy?: ProviderPolicy;
  offline?: boolean;
  requireProviders?: boolean;
  installMissing?: boolean;
  dryRun?: boolean;
  expertMode?: boolean;
  providerHome?: string;
}

export interface PrepareProvidersResult {
  ok: boolean;
  degraded: boolean;
  policy: ProviderPolicy;
  statuses: ProviderStatus[];
  actions: string[];
  manifestPath: string;
}
