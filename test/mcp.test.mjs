/**
 * MCP server integration tests — spawns the real MCP server as a child process
 * and communicates with it over stdio using the JSON-RPC MCP protocol.
 *
 * Validates that:
 *  - The server initializes and responds to the initialize handshake
 *  - tools/list returns only the consolidated EI control-plane surface
 *  - hidden legacy wrappers remain callable for compatibility
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { packageVersion } from "../dist/version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, "../dist/cli/index.js");
const REPO_ROOT = path.resolve(__dirname, "..");

function sendRequest(proc, request) {
  const line = JSON.stringify(request) + "\n";
  proc.stdin.write(line);
}

async function readResponse(proc, requestId, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to request ${requestId}`));
    }, timeoutMs);

    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === requestId) {
            clearTimeout(timer);
            proc.stdout.off("data", onData);
            resolve(msg);
            return;
          }
        } catch {
          // non-JSON line (e.g. debug output) — ignore
        }
      }
    };
    proc.stdout.on("data", onData);
  });
}

test("MCP server: initialize, list tools, call get_graph and analyze_impact", async () => {
  const proc = spawn(process.execPath, [CLI, "mcp", REPO_ROOT], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const errors = [];
  proc.stderr.on("data", (d) => errors.push(d.toString()));

  try {
    // 1. Initialize handshake
    sendRequest(proc, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0" },
      },
    });
    const initResponse = await readResponse(proc, 1);
    assert.ok(!initResponse.error, `initialize failed: ${JSON.stringify(initResponse.error)}`);
    assert.equal(initResponse.result?.serverInfo?.name, "engineering-intelligence");
    assert.equal(initResponse.result?.serverInfo?.version, await packageVersion());

    // Notify initialized
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

    // 2. List tools
    sendRequest(proc, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listResponse = await readResponse(proc, 2);
    assert.ok(!listResponse.error, `tools/list failed: ${JSON.stringify(listResponse.error)}`);
    const toolNames = (listResponse.result?.tools ?? []).map((t) => t.name);
    assert.deepEqual([...toolNames].sort(), ["get_engineering_context", "analyze_change_impact", "validate_change", "sync_engineering_knowledge", "provider_status"].sort());
    assert.ok(!toolNames.some((name) => name.startsWith("provider_graphify_") || name.startsWith("provider_cce_")), "raw provider tools must be hidden by default");

    // 3. Call get_graph (graph already built by graph.test.mjs)
    sendRequest(proc, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_graph", arguments: { root: REPO_ROOT, type: "dependency" } },
    });
    const graphResponse = await readResponse(proc, 3);
    assert.ok(!graphResponse.error, `get_graph call failed: ${JSON.stringify(graphResponse.error)}`);
    const graphText = graphResponse.result?.content?.[0]?.text ?? "{}";
    const graphData = JSON.parse(graphText);
    // v2.4: get_graph returns a COMPACT filtered view, not the raw graph.
    if (graphData.error) {
      assert.ok(graphData.error.includes("dependency-graph.json"), `Unexpected error: ${graphData.error}`);
    } else {
      assert.equal(typeof graphData.nodeCount, "number", "compact get_graph should report nodeCount");
      assert.ok(Array.isArray(graphData.nodes), "compact get_graph should return a nodes array");
      // Terse node format: "id <kind> @evidence".
      if (graphData.nodes.length > 0) assert.ok(typeof graphData.nodes[0] === "string", "nodes should be terse strings");
    }

    // 4. Call analyze_impact
    sendRequest(proc, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "analyze_impact",
        arguments: { root: REPO_ROOT, changedFiles: ["src/types.ts"] },
      },
    });
    const impactResponse = await readResponse(proc, 4);
    assert.ok(!impactResponse.error, `analyze_impact call failed: ${JSON.stringify(impactResponse.error)}`);
    const impactText = impactResponse.result?.content?.[0]?.text ?? "{}";
    const impactData = JSON.parse(impactText);
    // v2.4: shaper prunes empty arrays, so absent = empty. Present fields must be arrays.
    // src/types.ts has many importers, so `direct` (the answer) must be present + non-empty.
    assert.ok(Array.isArray(impactData.direct) && impactData.direct.length > 0, `direct should be a non-empty array, got: ${JSON.stringify(impactData)}`);
    for (const field of ["indirect", "testsToRun", "riskNotes", "unknowns"]) {
      if (impactData[field] !== undefined) assert.ok(Array.isArray(impactData[field]), `${field} should be an array when present`);
    }
    // v2.4.1: `details` is packed losslessly as {cols, rows}.
    if (impactData.details !== undefined) {
      assert.ok(Array.isArray(impactData.details.cols) && Array.isArray(impactData.details.rows), "details should be packed {cols, rows}");
    }

    // 5. Call read_knowledge (list mode)
    sendRequest(proc, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "read_knowledge", arguments: { root: REPO_ROOT } },
    });
    const kbResponse = await readResponse(proc, 5);
    assert.ok(!kbResponse.error, `read_knowledge call failed: ${JSON.stringify(kbResponse.error)}`);
    const kbText = kbResponse.result?.content?.[0]?.text ?? "{}";
    const kbData = JSON.parse(kbText);
    assert.ok(Array.isArray(kbData.files), "files should be an array");

    // 6. Call find_symbol
    sendRequest(proc, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "find_symbol", arguments: { root: REPO_ROOT, name: "buildGraph" } },
    });
    const findResponse = await readResponse(proc, 6, 30_000);
    assert.ok(!findResponse.error, `find_symbol call failed: ${JSON.stringify(findResponse.error)}`);
    const findData = JSON.parse(findResponse.result?.content?.[0]?.text ?? "{}");
    assert.ok(Array.isArray(findData.matches), "matches should be an array");
    assert.ok(findData.matches.some((m) => m.id === "symbol:src/graph/index#buildGraph"), `expected buildGraph match, got: ${JSON.stringify(findData.matches?.map((m) => m.id))}`);

    // 7. Call who_calls
    sendRequest(proc, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "who_calls", arguments: { root: REPO_ROOT, name: "buildGraph" } },
    });
    const whoResponse = await readResponse(proc, 7, 30_000);
    assert.ok(!whoResponse.error, `who_calls call failed: ${JSON.stringify(whoResponse.error)}`);
    const whoData = JSON.parse(whoResponse.result?.content?.[0]?.text ?? "{}");
    // v2.4.1: callers packed losslessly as {cols, rows}; never truncated (mustKeep).
    assert.ok(whoData.callers && Array.isArray(whoData.callers.rows), "callers should be packed {cols, rows}");
    assert.ok(whoData.callers.rows.length > 0, `expected callers of buildGraph, got: ${JSON.stringify(whoData)}`);
    assert.ok(whoData.callers.cols.includes("label"), "packed callers should carry a label column");

  } finally {
    proc.stdin.end();
    await new Promise((resolve) => proc.on("close", resolve));
    if (errors.length > 0) {
      console.log("  MCP server stderr:", errors.join("").substring(0, 500));
    }
  }
});
