import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  loadAidlcState,
  saveAidlcState,
  loadOpenQuestions,
  saveOpenQuestions,
  loadRequirements,
  saveRequirements,
  checkInceptionExit,
  freezeRequirements,
} from "../dist/aidlc/index.js";

function setupWorkspace() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-aidlc-state-"));
  return dir;
}

test("loadAidlcState falls back to default when no state file exists", async () => {
  const dir = setupWorkspace();
  try {
    const state = await loadAidlcState(dir);
    assert.equal(state.position.phase, "discovery");
    assert.ok(state.breadcrumb.includes("Discovery"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveAidlcState writes aidlc-state.json and auto-projects aidlc-state.md", async () => {
  const dir = setupWorkspace();
  try {
    const state = await loadAidlcState(dir);
    state.position.phase = "inception";
    state.position.stage = "Scope and contract definition";
    state.position.activeWorkflow = "scope-requirement";
    state.position.activeHat = "Product Analyst";
    state.position.activeUnit = "TKT-001";
    state.breadcrumb = "AI-DLC: Inception -> Scope definition -> in-progress";

    await saveAidlcState(dir, state);

    // Verify JSON was written
    const jsonPath = path.join(dir, ".engineering-intelligence", "aidlc", "aidlc-state.json");
    assert.ok(existsSync(jsonPath), "aidlc-state.json must exist");
    const reloaded = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(reloaded.position.phase, "inception");
    assert.equal(reloaded.position.activeUnit, "TKT-001");

    // Verify Markdown projection was written
    const mdPath = path.join(dir, ".engineering-intelligence", "aidlc", "aidlc-state.md");
    assert.ok(existsSync(mdPath), "aidlc-state.md must exist as projection");
    const mdContent = readFileSync(mdPath, "utf8");
    assert.ok(mdContent.includes("| Phase | inception |"));
    assert.ok(mdContent.includes("| Active unit | TKT-001 |"));
    assert.ok(mdContent.includes("AI-DLC: Inception -> Scope definition -> in-progress"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gate blindness fix: gate recognizes blocking questions in markdown table format", async () => {
  const dir = setupWorkspace();
  try {
    const aidlcDir = path.join(dir, ".engineering-intelligence", "aidlc");
    const inceptionDir = path.join(aidlcDir, "inception");
    const agileDir = path.join(aidlcDir, "agile");
    mkdirSync(inceptionDir, { recursive: true });
    mkdirSync(agileDir, { recursive: true });

    writeFileSync(path.join(inceptionDir, "requirements.md"), "# Requirements\n");
    writeFileSync(path.join(agileDir, "product-backlog.md"), "# Backlog\n");

    // Write open questions as a Markdown TABLE (like real projects have)
    const tableMd = `# Open Questions

| # | Question | Owner | Status | Priority |
|---|---|---|---|---|
| 1 | What is the payment gateway secret key? | Dev | Open | P0 (blocking) |
| 2 | What color should the button be? | Design | Open | Normal |
`;
    writeFileSync(path.join(aidlcDir, "open-questions.md"), tableMd);

    // Check inception gate — MUST block because question #1 is P0/blocking!
    const gateResult = await checkInceptionExit(dir);
    assert.equal(gateResult.status, "blocked");
    assert.ok(gateResult.blockingQuestions.length > 0, "should detect blocking question from markdown table");
    assert.ok(gateResult.blockingQuestions[0].includes("payment gateway"));

    // Now resolve question #1 via structured saveOpenQuestions
    const questions = await loadOpenQuestions(dir);
    assert.equal(questions.length, 2);
    questions[0].status = "resolved";
    await saveOpenQuestions(dir, questions);

    // Gate should now pass
    const passedResult = await checkInceptionExit(dir);
    assert.equal(passedResult.status, "pass");
    assert.equal(passedResult.blockingQuestions.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("freezeRequirements writes requirements.json and updates requirements.md", async () => {
  const dir = setupWorkspace();
  try {
    const reqPath = await freezeRequirements(dir, "Authentication", [
      { questionId: "Q1", selectedOptionId: "B", customText: "Use OAuth 2.0 with PKCE" },
    ]);

    assert.ok(existsSync(reqPath));

    const jsonPath = path.join(dir, ".engineering-intelligence", "aidlc", "inception", "requirements.json");
    assert.ok(existsSync(jsonPath), "requirements.json must be saved");

    const reqs = await loadRequirements(dir);
    assert.equal(reqs.requirements.length, 1);
    assert.equal(reqs.requirements[0].topic, "Authentication");
    assert.equal(reqs.requirements[0].decision, "Option B");
    assert.equal(reqs.requirements[0].rationale, "Use OAuth 2.0 with PKCE");

    const mdContent = readFileSync(reqPath, "utf8");
    assert.ok(mdContent.includes("Use OAuth 2.0 with PKCE"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
