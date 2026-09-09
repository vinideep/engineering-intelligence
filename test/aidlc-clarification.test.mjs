import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assessPromptClarity,
  freezeRequirements,
  checkPhaseGate,
  checkDiscoveryExit,
  checkInceptionExit,
} from "../dist/aidlc/index.js";

test("assessPromptClarity detects ambiguities in vague and architectural prompts", () => {
  // 1. Vague prompt
  const vague = assessPromptClarity("add payments");
  assert.equal(vague.isClear, false, "vague prompt should not be marked clear");
  assert.ok(vague.clarityScore < 75, `clarity score should be < 75, got ${vague.clarityScore}`);
  assert.ok(vague.ambiguities.length > 0, "should identify ambiguities");
  assert.ok(vague.questions.length > 0, "should produce clarification questions");
  assert.ok(vague.questions[0].options.length >= 2, "questions should have at least 2 options");

  // 2. Ambiguous architectural prompt
  const auth = assessPromptClarity("implement auth for user login");
  assert.equal(auth.isClear, false);
  const hasAuthQ = auth.questions.some((q) => q.question.toLowerCase().includes("authentication"));
  assert.ok(hasAuthQ, "should ask about authentication strategy");

  // 3. Clear, specific prompt
  const specific = assessPromptClarity("Update src/token-optimizer.ts to change the default token budget threshold from 2000 to 2500");
  assert.equal(specific.isClear, true, "specific prompt with target file should be clear");
  assert.ok(specific.clarityScore >= 75);
  assert.equal(specific.questions.length, 0);
});

test("freezeRequirements commits user decisions to inception/requirements.md", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-aidlc-"));
  try {
    const filePath = await freezeRequirements(dir, "Payment Processing", [
      { questionId: "Q1", selectedOptionId: "A", customText: "Stripe with webhook signatures" },
    ]);

    assert.ok(filePath.endsWith("requirements.md"));
    const content = readFileSync(filePath, "utf8");
    assert.ok(content.includes("Payment Processing"));
    assert.ok(content.includes("Option A"));
    assert.ok(content.includes("Stripe with webhook signatures"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkDiscoveryExit and checkInceptionExit enforce required artifacts and open questions", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-aidlc-gates-"));
  try {
    // 1. Empty repo: Discovery gate should be blocked
    const disc1 = await checkDiscoveryExit(dir);
    assert.equal(disc1.status, "blocked");
    assert.ok(disc1.missingPrerequisites.some((m) => m.includes("vision.md")));

    // 2. Create discovery artifacts
    mkdirSync(path.join(dir, ".engineering-intelligence", "aidlc", "discovery"), { recursive: true });
    writeFileSync(path.join(dir, ".engineering-intelligence", "aidlc", "discovery", "vision.md"), "# Vision\nTarget: automated delivery\n");
    writeFileSync(path.join(dir, ".engineering-intelligence", "aidlc", "discovery", "technical-environment.md"), "# Tech Env\nNode 22\n");

    const disc2 = await checkDiscoveryExit(dir);
    assert.equal(disc2.status, "pass");
    assert.equal(disc2.score, 100);

    // 3. Inception gate check: should be blocked without requirements.md and backlog
    const incep1 = await checkInceptionExit(dir);
    assert.equal(incep1.status, "blocked");
    assert.ok(incep1.missingPrerequisites.some((m) => m.includes("requirements.md")));

    // 4. Create requirements and backlog
    mkdirSync(path.join(dir, ".engineering-intelligence", "aidlc", "inception"), { recursive: true });
    mkdirSync(path.join(dir, ".engineering-intelligence", "aidlc", "agile"), { recursive: true });
    writeFileSync(path.join(dir, ".engineering-intelligence", "aidlc", "inception", "requirements.md"), "# Requirements\n");
    writeFileSync(path.join(dir, ".engineering-intelligence", "aidlc", "agile", "product-backlog.md"), "# Backlog\n");

    const incep2 = await checkInceptionExit(dir);
    assert.equal(incep2.status, "pass");

    // 5. Add a blocking question to open-questions.md -> should block inception
    writeFileSync(
      path.join(dir, ".engineering-intelligence", "aidlc", "open-questions.md"),
      "# Open Questions\n- [ ] Critical blocking question: Which database engine to use?\n",
    );

    const incep3 = await checkInceptionExit(dir);
    assert.equal(incep3.status, "blocked");
    assert.ok(incep3.blockingQuestions.length > 0);

    // 6. Test checkPhaseGate dispatch
    const gateRes = await checkPhaseGate(dir, "discovery");
    assert.equal(gateRes.phase, "discovery");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
