import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createConsolidatedRegistry } from "../dist/mcp/consolidated.js";
import { McpToolRegistry } from "../dist/mcp/registry.js";

test("typed MCP registry validates required, typed, and unknown arguments", async () => {
  const registry = new McpToolRegistry().register({
    name: "typed",
    description: "fixture",
    inputSchema: { type: "object", required: ["name"], additionalProperties: false, properties: { name: { type: "string" }, count: { type: "number", minimum: 1 } } },
    handler: async (args) => args,
  });
  await assert.rejects(registry.execute("typed", {}), /name is required/);
  await assert.rejects(registry.execute("typed", { name: 1 }), /name must be a string/);
  await assert.rejects(registry.execute("typed", { name: "ok", extra: true }), /Unknown argument/);
  assert.deepEqual(await registry.execute("typed", { name: "ok", count: 2 }), { name: "ok", count: 2 });
});

test("raw provider tools are hidden by default and exposed only by explicit expert config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-mcp-registry-"));
  let registry = await createConsolidatedRegistry(root);
  let names = registry.list().map((tool) => tool.name);
  assert.ok(names.includes("get_engineering_context"));
  assert.ok(names.includes("validate_change"));
  assert.ok(!names.some((name) => name.startsWith("provider_graphify_") || name.startsWith("provider_cce_")));
  await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
  await writeFile(path.join(root, ".engineering-intelligence", "ei.config.json"), JSON.stringify({ schemaVersion: 2, providers: { exposeRawMcp: true } }));
  registry = await createConsolidatedRegistry(root);
  names = registry.list().map((tool) => tool.name);
  assert.ok(names.includes("provider_graphify_evidence"));
  assert.ok(names.includes("provider_cce_retrieval"));
});
