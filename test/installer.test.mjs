import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { renderAdapters } from "../dist/adapters/index.js";
import { install, uninstall, update } from "../dist/installer/index.js";
import { SKILL_NAMES, WORKFLOW_NAMES } from "../dist/templates.js";
import { doctor } from "../dist/validation/index.js";

const options = { packageVersion: "3.5.0" };

async function project() {
  return mkdtemp(path.join(tmpdir(), "engineering-intelligence-"));
}

async function readable(root, relative) {
  return readFile(path.join(root, relative), "utf8");
}

test("every adapter renders the complete canonical skill and workflow inventory it supports", async () => {
  const profiles = {
    antigravity: { skills: ".agent/skills", workflows: ".agent/workflows", workflowKind: "file" },
    "antigravity-cli": { skills: ".agents/skills", workflows: ".agents/workflows", workflowKind: "file" },
    codex: { skills: ".agents/skills", workflows: ".agents/workflows", workflowKind: "file" },
    generic: { skills: ".agents/skills", workflows: ".agents/skills", workflowKind: "skill" },
    "claude-code": { skills: ".claude/skills", workflows: ".claude/commands", workflowKind: "file" },
    cursor: { skills: null, workflows: ".cursor/commands", workflowKind: "file" },
    "github-copilot": { skills: ".github/skills", workflows: ".github/prompts", workflowKind: "prompt" },
    "gemini-cli": { skills: ".agents/skills", workflows: ".gemini/commands", workflowKind: "toml" },
    commandcode: { skills: ".commandcode/skills", workflows: ".commandcode/commands", workflowKind: "file" },
  };

  for (const [adapter, profile] of Object.entries(profiles)) {
    const paths = new Set((await renderAdapters([adapter])).map((entry) => entry.path));
    if (profile.skills) {
      for (const name of SKILL_NAMES) {
        assert.ok(paths.has(`${profile.skills}/${name}/SKILL.md`), `${adapter} omitted skill ${name}`);
      }
    }
    for (const name of WORKFLOW_NAMES) {
      const suffix = profile.workflowKind === "skill"
        ? `${name}/SKILL.md`
        : profile.workflowKind === "prompt"
          ? `${name}.prompt.md`
          : profile.workflowKind === "toml"
            ? `${name}.toml`
            : `${name}.md`;
      assert.ok(paths.has(`${profile.workflows}/${suffix}`), `${adapter} omitted workflow ${name}`);
    }
  }
});

test("installs shared skills once for overlapping adapters", async () => {
  const root = await project();
  const result = await install(root, ["antigravity", "codex", "gemini-cli"], options);
  assert.equal(result.conflicts, 0);
  const manifest = JSON.parse(await readable(root, ".engineering-intelligence/install-manifest.json"));
  const shared = manifest.files.filter((entry) => entry.path === ".agents/skills/engineering-intelligence-skill/SKILL.md");
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].owners, ["codex", "gemini-cli"]);
  assert.match(await readable(root, ".agent/workflows/initialize-engineering-intelligence.md"), /knowledge-base/);
  assert.match(await readable(root, ".agent/workflows/map-architecture.md"), /dependency-graph\.json/);
  assert.match(await readable(root, ".gemini/commands/engineering-intelligence.toml"), /User supplied scope or request/);
});

test("installs CommandCode native project skills and commands", async () => {
  const root = await project();
  const result = await install(root, ["commandcode"], options);
  assert.equal(result.conflicts, 0);
  assert.match(await readable(root, ".commandcode/skills/engineering-intelligence-skill/SKILL.md"), /Engineering Intelligence Implementation/);
  assert.match(await readable(root, ".commandcode/commands/engineering-intelligence.md"), /\$ARGUMENTS/);
  assert.match(await readable(root, ".commandcode/commands/scope-requirement.md"), /\$ARGUMENTS/);
  assert.doesNotMatch(await readable(root, ".commandcode/commands/map-architecture.md"), /\$ARGUMENTS/);
  const manifest = JSON.parse(await readable(root, ".engineering-intelligence/install-manifest.json"));
  assert.ok(manifest.adapters.includes("commandcode"));
});

test("managed instructions preserve existing user text and uninstall removes only managed content", async () => {
  const root = await project();
  await writeFile(path.join(root, "AGENTS.md"), "# Existing Rules\n\nKeep this.\n");
  await install(root, ["codex"], options);
  const installed = await readable(root, "AGENTS.md");
  assert.match(installed, /# Existing Rules/);
  assert.match(installed, /<!-- engineering-intelligence:start -->/);
  const result = await uninstall(root, options);
  assert.equal(result.conflicts, 0);
  assert.equal(await readable(root, "AGENTS.md"), "# Existing Rules\n\nKeep this.\n");
});

test("update preserves locally modified managed files unless forced", async () => {
  const root = await project();
  await install(root, ["cursor"], options);
  const relative = ".cursor/commands/engineering-intelligence.md";
  await writeFile(path.join(root, relative), "custom local workflow\n");
  const result = await update(root, options);
  assert.equal(result.conflicts, 1);
  assert.equal(await readable(root, relative), "custom local workflow\n");
  const forced = await update(root, { ...options, force: true });
  assert.equal(forced.conflicts, 0);
  assert.match(await readable(root, relative), /Engineering Intelligence/);
});

test("doctor reports legacy folders and locally edited managed content", async () => {
  const root = await project();
  await install(root, ["generic"], options);
  await writeFile(path.join(root, ".agents/skills/engineering-intelligence-skill/SKILL.md"), "changed\n");
  await writeFile(path.join(root, ".agent"), "legacy marker");
  const actions = await doctor(root);
  assert.ok(actions.some((action) => action.path === ".agent" && action.status === "warning"));
  assert.ok(actions.some((action) => action.path.includes("engineering-intelligence-skill/SKILL.md") && action.status === "warning"));
});

test("doctor recognizes an untouched installation as healthy", async () => {
  const root = await project();
  await install(root, ["antigravity", "claude-code", "github-copilot"], options);
  const actions = await doctor(root);
  assert.equal(actions.filter((action) => action.status !== "unchanged").length, 0);
});

test("doctor detects package drift and canonical files omitted from the install manifest", async () => {
  const root = await project();
  await install(root, ["generic"], options);
  const manifestPath = path.join(root, ".engineering-intelligence/install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const omitted = manifest.files.find((entry) => entry.path.includes("graph-engine/SKILL.md"));
  assert.ok(omitted);
  manifest.packageVersion = "2.3.0";
  manifest.files = manifest.files.filter((entry) => entry.path !== omitted.path);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const actions = await doctor(root);
  assert.ok(actions.some((action) => action.path.endsWith("install-manifest.json") && action.status === "error" && action.message.includes("2.3.0")));
  assert.ok(actions.some((action) => action.path === omitted.path && action.status === "error" && action.message.includes("missing from the install manifest")));
});

test("dry run does not write installer state or adapter files", async () => {
  const root = await project();
  const result = await install(root, ["claude-code"], { ...options, dryRun: true });
  assert.ok(result.changed > 0);
  await assert.rejects(access(path.join(root, ".engineering-intelligence/install-manifest.json")));
  await assert.rejects(access(path.join(root, ".claude/skills/engineering-intelligence-skill/SKILL.md")));
});

test("update removes an obsolete unchanged managed file recorded by an older manifest", async () => {
  const root = await project();
  await install(root, ["generic"], options);
  const manifestPath = path.join(root, ".engineering-intelligence/install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const obsolete = ".agents/skills/old-engine/SKILL.md";
  const content = "old managed skill\n";
  await mkdir(path.dirname(path.join(root, obsolete)), { recursive: true });
  await writeFile(path.join(root, obsolete), content);
  const { createHash } = await import("node:crypto");
  manifest.files.push({
    path: obsolete,
    kind: "file",
    hash: createHash("sha256").update(content.trimEnd()).digest("hex"),
    owners: ["generic"],
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const result = await update(root, options);
  assert.ok(result.actions.some((action) => action.path === obsolete && action.status === "removed"));
  await assert.rejects(access(path.join(root, obsolete)));
});

test("update upgrades a V1-shaped installation with V2 graph and impact assets", async () => {
  const root = await project();
  await install(root, ["antigravity", "generic"], options);
  const manifestPath = path.join(root, ".engineering-intelligence/install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const v2Segments = [
    "/graph-engine/",
    "/change-detection-engine/",
    "/incremental-sync-engine/",
    "/engineering-change-review/",
    "/map-architecture.md",
    "/analyze-impact.md",
    "/sync-engineering-intelligence.md",
    "/review-engineering-change.md",
  ];
  const removed = manifest.files.filter((entry) => v2Segments.some((segment) => entry.path.includes(segment)));
  manifest.packageVersion = "0.1.0";
  manifest.templateVersion = "1.0.0";
  manifest.files = manifest.files.filter((entry) => !removed.includes(entry));
  for (const entry of removed) {
    await unlink(path.join(root, entry.path));
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = await update(root, options);
  assert.equal(result.conflicts, 0);
  assert.ok(result.actions.some((action) => action.path === ".agents/skills/graph-engine/SKILL.md" && action.status === "created"));
  assert.ok(result.actions.some((action) => action.path === ".agent/workflows/analyze-impact.md" && action.status === "created"));
  const updatedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(updatedManifest.templateVersion, "4.0.0");
});

test("upgrade installs new V2 files while preserving edited managed instructions", async () => {
  const root = await project();
  await install(root, ["generic"], options);
  const manifestPath = path.join(root, ".engineering-intelligence/install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const graphEntry = manifest.files.find((entry) => entry.path === ".agents/skills/graph-engine/SKILL.md");
  manifest.files = manifest.files.filter((entry) => entry !== graphEntry);
  await unlink(path.join(root, graphEntry.path));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const agents = await readable(root, "AGENTS.md");
  await writeFile(root + "/AGENTS.md", agents.replace("This repository uses", "Locally customized repository uses"));
  const result = await update(root, options);
  assert.ok(result.actions.some((action) => action.path === "AGENTS.md" && action.status === "conflict"));
  assert.ok(result.actions.some((action) => action.path === graphEntry.path && action.status === "created"));
});

test("uninstall removes templates but preserves runtime graph and report artifacts", async () => {
  const root = await project();
  await install(root, ["generic"], options);
  const graph = ".engineering-intelligence/graph/dependency-graph.json";
  const report = ".engineering-intelligence/reports/IMP-001-example.md";
  await mkdir(path.dirname(path.join(root, graph)), { recursive: true });
  await mkdir(path.dirname(path.join(root, report)), { recursive: true });
  await writeFile(path.join(root, graph), '{"schemaVersion":1}\n');
  await writeFile(path.join(root, report), "# Impact\n");
  const result = await uninstall(root, options);
  assert.equal(result.conflicts, 0);
  assert.equal(await readable(root, graph), '{"schemaVersion":1}\n');
  assert.equal(await readable(root, report), "# Impact\n");
  await assert.rejects(access(path.join(root, ".agents/skills/graph-engine/SKILL.md")));
});

test("update prompts to overwrite and respects user choice on conflict", async () => {
  const root = await project();
  await install(root, ["generic"], options);
  const relative = ".agents/skills/graph-engine/SKILL.md";
  await writeFile(path.join(root, relative), "locally modified skill content\n");

  // Case 1: user declines to overwrite (promptOverwrite returns false)
  const resultPreserve = await update(root, {
    ...options,
    promptOverwrite: async (filePath) => {
      assert.equal(filePath, relative);
      return false;
    },
  });
  assert.equal(resultPreserve.conflicts, 1);
  assert.equal(await readable(root, relative), "locally modified skill content\n");

  // Case 2: user agrees to overwrite (promptOverwrite returns true)
  const resultOverwrite = await update(root, {
    ...options,
    promptOverwrite: async (filePath) => {
      assert.equal(filePath, relative);
      return true;
    },
  });
  assert.equal(resultOverwrite.conflicts, 0);
  assert.notEqual(await readable(root, relative), "locally modified skill content\n");
});
