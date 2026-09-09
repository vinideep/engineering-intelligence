import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { runGate, GATE_NAMES } from "../gates/index.js";
import { latestOpenFlight } from "../flight/index.js";
import { loadOpenQuestions } from "./state.js";
import { validateAllBacklogTickets } from "./backlog-graph.js";
import type { Phase, GateCheckResult } from "./types.js";

function aidlcDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "aidlc");
}

async function getBlockingOpenQuestions(root: string): Promise<string[]> {
  const items = await loadOpenQuestions(root);
  return items
    .filter((q) => q.status !== "resolved" && q.priority === "blocking")
    .map((q) => q.question);
}

export async function checkDiscoveryExit(root: string): Promise<GateCheckResult> {
  const missing: string[] = [];
  const recs: string[] = [];

  const visionFile = path.join(aidlcDir(root), "discovery", "vision.md");
  const techEnvFile = path.join(aidlcDir(root), "discovery", "technical-environment.md");

  if (!existsSync(visionFile)) {
    missing.push("discovery/vision.md missing");
    recs.push("Define business objectives and success metrics in discovery/vision.md");
  }
  if (!existsSync(techEnvFile)) {
    missing.push("discovery/technical-environment.md missing");
    recs.push("Document runtime, dependencies, and constraints in discovery/technical-environment.md");
  }

  const blocking = await getBlockingOpenQuestions(root);
  if (blocking.length > 0) {
    recs.push(`Resolve ${blocking.length} blocking open question(s) before advancing`);
  }

  const passed = missing.length === 0 && blocking.length === 0;
  return {
    phase: "discovery",
    status: passed ? "pass" : "blocked",
    score: passed ? 100 : Math.max(0, 100 - missing.length * 35 - blocking.length * 20),
    missingPrerequisites: missing,
    blockingQuestions: blocking,
    recommendations: recs,
  };
}

export async function checkInceptionExit(root: string): Promise<GateCheckResult> {
  const missing: string[] = [];
  const recs: string[] = [];

  const reqFile = path.join(aidlcDir(root), "inception", "requirements.md");
  const backlogFile = path.join(aidlcDir(root), "agile", "product-backlog.md");
  const backlogDir = path.join(aidlcDir(root), "agile", "backlog");

  if (!existsSync(reqFile)) {
    missing.push("inception/requirements.md missing");
    recs.push("Run Socratic clarification gate or requirements scoping to freeze inception/requirements.md");
  }

  const hasBacklog = existsSync(backlogFile) || existsSync(backlogDir);
  if (!hasBacklog) {
    missing.push("agile/product-backlog.md or agile/backlog/ missing");
    recs.push("Decompose initiative into features/tickets before entering Construction");
  } else {
    const ticketValidation = await validateAllBacklogTickets(root);
    if (!ticketValidation.valid) {
      for (const err of ticketValidation.errors) {
        missing.push(`Ticket ${err.ticket} targets unknown graph node(s): ${err.missing.join(", ")}`);
        recs.push(`Fix target graph nodes in ${err.ticket} to match dependency-graph.json or prefix with 'proposed:'`);
      }
    }
  }

  const blocking = await getBlockingOpenQuestions(root);
  if (blocking.length > 0) {
    recs.push(`Resolve ${blocking.length} blocking questions prior to construction`);
  }

  const passed = missing.length === 0 && blocking.length === 0;
  return {
    phase: "inception",
    status: passed ? "pass" : "blocked",
    score: passed ? 100 : Math.max(0, 100 - missing.length * 40 - blocking.length * 25),
    missingPrerequisites: missing,
    blockingQuestions: blocking,
    recommendations: recs,
  };
}

export async function checkConstructionExit(root: string): Promise<GateCheckResult> {
  const missing: string[] = [];
  const recs: string[] = [];

  // 1. Check active open flights
  const openFlight = await latestOpenFlight(root);
  if (openFlight) {
    missing.push(`Active unclosed flight: ${openFlight.id}`);
    recs.push(`Call postflight to verify scope and close flight ${openFlight.id}`);
  }

  // 2. Check deterministic safety gates
  for (const gate of ["env-vars", "dead-exports", "api-diff"] as const) {
    try {
      const res = await runGate(gate, root);
      if (res.status === "fail") {
        missing.push(`Safety gate failed: ${gate} (${res.summary})`);
        recs.push(`Fix ${gate} findings before exiting construction`);
      }
    } catch {
      // gate non-blocking if target repo lacks configuration
    }
  }

  const passed = missing.length === 0;
  return {
    phase: "construction",
    status: passed ? "pass" : "blocked",
    score: passed ? 100 : Math.max(0, 100 - missing.length * 30),
    missingPrerequisites: missing,
    blockingQuestions: [],
    recommendations: recs,
  };
}

export async function checkOperationsExit(root: string): Promise<GateCheckResult> {
  const missing: string[] = [];
  const recs: string[] = [];

  const opsDir = path.join(aidlcDir(root), "operations");
  const hasOpsDir = existsSync(opsDir);

  if (!hasOpsDir) {
    missing.push("operations/ directory missing");
    recs.push("Generate operations readiness artifacts and rollback procedures");
  }

  const passed = missing.length === 0;
  return {
    phase: "operations",
    status: passed ? "pass" : "blocked",
    score: passed ? 100 : 50,
    missingPrerequisites: missing,
    blockingQuestions: [],
    recommendations: recs,
  };
}

export async function checkPhaseGate(root: string, phase: Phase): Promise<GateCheckResult> {
  switch (phase) {
    case "discovery":
      return checkDiscoveryExit(root);
    case "inception":
      return checkInceptionExit(root);
    case "construction":
      return checkConstructionExit(root);
    case "operations":
      return checkOperationsExit(root);
    default:
      return {
        phase,
        status: "blocked",
        score: 0,
        missingPrerequisites: [`Unknown phase ${phase}`],
        blockingQuestions: [],
        recommendations: ["Select a valid AI-DLC phase: discovery, inception, construction, operations"],
      };
  }
}
