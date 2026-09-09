import type { ProviderCompatibility, ProviderName } from "./types.js";

/**
 * The only place upstream package/version coupling is allowed. Provider output
 * is parsed behind adapters and these exact tuples are exercised in smoke CI.
 */
export const PROVIDER_COMPATIBILITY: Readonly<Record<ProviderName, ProviderCompatibility>> = {
  graphify: {
    name: "graphify",
    displayName: "Graphify",
    package: "graphifyy",
    version: "0.9.29",
    executable: "graphify",
    versionArgs: ["--version"],
    purpose: "structure",
    localOnly: true,
    prerequisites: ["uv", "Python 3.11+"],
  },
  cce: {
    name: "cce",
    displayName: "Code Context Engine",
    package: "code-context-engine[local]",
    version: "0.4.25",
    executable: "cce",
    versionArgs: ["--version"],
    purpose: "retrieval",
    localOnly: true,
    prerequisites: ["uv", "Python 3.11+", "C/C++ build tools and CMake when wheels are unavailable"],
  },
};
