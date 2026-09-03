/**
 * A realistic brownfield smoke test for the documented user journey.
 *
 * The fixture is intentionally shaped like Shiplogic: route planning depends
 * on carrier capability adapters, and an existing Claude settings file belongs
 * to the project owner. The test exercises the real CLI, not just library
 * functions, and then proves the smallest safe update path after a source edit.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, "../dist/cli/index.js");

function cli(args, cwd) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  return result;
}

async function createShiplogicFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ei-shiplogic-"));
  await mkdir(path.join(root, ".claude"), { recursive: true });
  await mkdir(path.join(root, "src", "domain"), { recursive: true });
  await mkdir(path.join(root, "src", "providers"), { recursive: true });
  await mkdir(path.join(root, "src", "routes"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    name: "shiplogic-demo",
    private: true,
    scripts: { test: "node -e \"process.exit(0)\"" },
  }, null, 2));
  await writeFile(path.join(root, ".claude", "settings.json"), JSON.stringify({
    permissions: { allow: ["Bash(npm test)"] },
    model: "opus",
  }, null, 2));
  await writeFile(path.join(root, "src", "providers", "carrier.ts"),
    "export function carrierCapabilities(country: string) { return country === \"IN\" ? [\"dhl\", \"fedex\"] : [\"dhl\"]; }\n");
  await writeFile(path.join(root, "src", "routes", "route-plan.ts"),
    "import { carrierCapabilities } from \"../providers/carrier.js\";\nexport function createRoutePlan(country: string) { return carrierCapabilities(country); }\n");
  return root;
}

test("Shiplogic-style onboarding and incremental sync work through the real CLI", async (t) => {
  const root = await createShiplogicFixture();
  t.after(async () => rm(root, { recursive: true, force: true }));

  const initialized = cli(["initialize", root, "--providers", "native", "--yes", "--json"], root);
  assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
  const init = JSON.parse(initialized.stdout);
  assert.equal(init.ok, true);
  assert.equal(init.degraded, false);
  assert.deepEqual(init.setup.ides, ["claude-code"], "existing IDE markers should be auto-detected");
  assert.ok(init.evidence.graph.nodes >= 3);
  assert.ok(init.evidence.graph.edges >= 1);
  assert.ok(init.evidence.claims.total >= 3);
  assert.equal(init.evidence.knowledge.status, "ready");

  const settings = JSON.parse(await readFile(path.join(root, ".claude", "settings.json"), "utf8"));
  assert.deepEqual(settings.permissions, { allow: ["Bash(npm test)"] }, "project settings must survive installation");
  assert.equal(settings.model, "opus");
  assert.ok(settings.hooks.SessionStart.some((entry) => entry.hooks.some((hook) => hook.command.includes("engineering-intelligence hook"))));

  const doctor = cli(["doctor", root, "--json"], root);
  assert.equal(doctor.status, 0, doctor.stdout);
  const health = cli(["health", root, "--strict", "--json"], root);
  assert.equal(health.status, 0, `${health.stdout}\n${health.stderr}`);
  assert.equal(JSON.parse(health.stdout).providers.policy, "native");
  const receipt = cli(["verify", root, "--json"], root);
  assert.equal(receipt.status, 0, receipt.stdout);
  assert.equal(JSON.parse(receipt.stdout).verdict, "pass");

  const context = cli(["context", "route plan", root, "--files", "src/routes/route-plan.ts", "--json"], root);
  assert.equal(context.status, 0, context.stdout);
  const pack = JSON.parse(context.stdout);
  assert.equal(pack.knowledge.trust, "healthy");
  assert.ok(pack.architecture.nodes.some((node) => node.path === "src/routes/route-plan.ts"));

  const originalOverview = await readFile(path.join(root, ".engineering-intelligence", "knowledge-base", "00-project-overview.md"), "utf8");
  await writeFile(path.join(root, "src", "domain", "country.ts"),
    "export function normalizeCountry(country: string) { return country.trim().toUpperCase(); }\n");
  await writeFile(path.join(root, "src", "routes", "route-plan.ts"),
    "import { normalizeCountry } from \"../domain/country.js\";\nimport { carrierCapabilities } from \"../providers/carrier.js\";\nexport function createRoutePlan(country: string) { return carrierCapabilities(normalizeCountry(country)); }\n");

  const synced = cli([
    "sync", root,
    "--files", "src/routes/route-plan.ts,src/domain/country.ts",
    "--json",
  ], root);
  assert.equal(synced.status, 0, `${synced.stdout}\n${synced.stderr}`);
  const sync = JSON.parse(synced.stdout);
  assert.deepEqual(sync.changedFiles, ["src/routes/route-plan.ts", "src/domain/country.ts"]);
  assert.equal(sync.graph.wasIncremental, true);
  assert.ok(sync.graph.fileCount >= 2);
  assert.ok(sync.derived.total >= 5);
  assert.equal(sync.claims.refuted, 0);
  assert.equal(sync.claims.stale, 0);
  assert.equal(sync.claims.missing, 0);
  assert.equal(sync.requiresModelKnowledgeSync, true, "source edits need an explicit prose-review handoff");
  const graph = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"), "utf8"));
  assert.ok(graph.nodes.some((node) => node.path === "src/domain/country.ts"));
  assert.equal(await readFile(path.join(root, ".engineering-intelligence", "knowledge-base", "00-project-overview.md"), "utf8"), originalOverview, "deterministic sync must not rewrite canonical prose");

  const finalClaims = cli(["claims", "verify", root, "--strict", "--json"], root);
  assert.equal(finalClaims.status, 0, finalClaims.stdout);
  const finalHealth = cli(["health", root, "--strict", "--json"], root);
  assert.equal(finalHealth.status, 0, `${finalHealth.stdout}\n${finalHealth.stderr}`);
});
