/**
 * MCP server integration tests — spawns the real MCP server as a child process
 * and communicates with it over stdio using the JSON-RPC MCP protocol.
 *
 * Validates that:
 *  - The server initializes and responds to the initialize handshake
 *  - tools/list returns the expected 4 tools
 *  - tools/call for get_graph and analyze_impact return valid JSON responses
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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

    // Notify initialized
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

    // 2. List tools
    sendRequest(proc, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listResponse = await readResponse(proc, 2);
    assert.ok(!listResponse.error, `tools/list failed: ${JSON.stringify(listResponse.error)}`);
    const toolNames = (listResponse.result?.tools ?? []).map((t) => t.name);
    assert.ok(toolNames.includes("map_dependencies"), `map_dependencies not in tools: ${toolNames}`);
    assert.ok(toolNames.includes("get_graph"), `get_graph not in tools: ${toolNames}`);
    assert.ok(toolNames.includes("analyze_impact"), `analyze_impact not in tools: ${toolNames}`);
    assert.ok(toolNames.includes("read_knowledge"), `read_knowledge not in tools: ${toolNames}`);

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
    // If the graph was built by graph.test.mjs it will have schemaVersion; if not it will have error
    if (graphData.error) {
      // Graph not found — acceptable if tests run in isolation; just verify the error format
      assert.ok(graphData.error.includes("dependency-graph.json"), `Unexpected error: ${graphData.error}`);
    } else {
      assert.equal(graphData.schemaVersion, 1);
      assert.equal(graphData.graphType, "dependency");
      assert.ok(Array.isArray(graphData.nodes));
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
    assert.ok(Array.isArray(impactData.direct), `direct should be an array, got: ${JSON.stringify(impactData)}`);
    assert.ok(Array.isArray(impactData.indirect), "indirect should be an array");
    assert.ok(Array.isArray(impactData.unknowns), "unknowns should be an array");

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

  } finally {
    proc.stdin.end();
    await new Promise((resolve) => proc.on("close", resolve));
    if (errors.length > 0) {
      console.log("  MCP server stderr:", errors.join("").substring(0, 500));
    }
  }
});
