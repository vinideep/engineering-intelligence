#!/usr/bin/env node
/**
 * Runs every unit test file in test/ (`*.test.mjs`) except the integration set,
 * so a new test file can never be silently skipped by a hand-maintained list.
 * Integration tests run separately via `npm run test:integration`.
 *
 * Usage: node scripts/run-tests.mjs [--integration] [extra node --test args]
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INTEGRATION = new Set([
  "install-integration.test.mjs",
  "mcp.test.mjs",
  "shiplogic-integration.test.mjs",
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const integration = args.includes("--integration");
const passthrough = args.filter((arg) => arg !== "--integration");

const files = readdirSync(path.join(root, "test"))
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => (integration ? INTEGRATION.has(name) : !INTEGRATION.has(name)))
  .sort()
  .map((name) => path.join("test", name));

if (files.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...passthrough, ...files], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
