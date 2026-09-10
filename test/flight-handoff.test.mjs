import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSessionHandoff, getSessionHandoff, listActiveFlights, preflight } from "../dist/flight/index.js";
import { createConsolidatedRegistry } from "../dist/mcp/consolidated.js";

function setupFlightRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-handoff-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(dir + "/src/main.ts", "export function main() { return 1; }\n");
  return dir;
}

test("createSessionHandoff and getSessionHandoff work end-to-end", async () => {
  const dir = setupFlightRepo();
  try {
    const handoff = await createSessionHandoff(dir, {
      sessionId: "session-abc-123",
      sourceIde: "cursor",
      targetIde: "claude-code",
      note: "Refactoring main function",
      intent: "Optimize throughput",
    });

    assert.equal(handoff.sessionId, "session-abc-123");
    assert.equal(handoff.sourceIde, "cursor");
    assert.equal(handoff.targetIde, "claude-code");
    assert.equal(handoff.note, "Refactoring main function");

    const retrieved = await getSessionHandoff(dir, "session-abc-123");
    assert.ok(retrieved);
    assert.equal(retrieved.sessionId, "session-abc-123");
    assert.equal(retrieved.intent, "Optimize throughput");

    // Default retrieval without sessionId
    const defaultHandoff = await getSessionHandoff(dir);
    assert.ok(defaultHandoff);
    assert.equal(defaultHandoff.sessionId, "session-abc-123");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("listActiveFlights lists currently open flights", async () => {
  const dir = setupFlightRepo();
  try {
    const f1 = await preflight(dir, { intent: "Task 1", files: ["src/main.ts"] });
    assert.ok(f1.id);

    const active = await listActiveFlights(dir);
    assert.ok(active.length >= 1);
    assert.ok(active.some((f) => f.id === f1.id && f.intent === "Task 1"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("MCP consolidated registry executes session handoff tools", async () => {
  const dir = setupFlightRepo();
  try {
    const registry = await createConsolidatedRegistry(dir);

    // Test create_session_handoff
    const createRes = await registry.execute("create_session_handoff", {
      root: dir,
      sessionId: "mcp-session-1",
      note: "Testing MCP handoff",
    });
    assert.ok(createRes);
    assert.equal(createRes.sessionId, "mcp-session-1");

    // Test get_session_handoff
    const getRes = await registry.execute("get_session_handoff", {
      root: dir,
      sessionId: "mcp-session-1",
    });
    assert.ok(getRes);
    assert.equal(getRes.sessionId, "mcp-session-1");

    // Test list_active_flights
    const listRes = await registry.execute("list_active_flights", { root: dir });
    assert.ok(listRes);
    assert.ok(Array.isArray(listRes.activeFlights));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
