import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  ClarityAssessment,
  AmbiguityItem,
  ClarificationQuestion,
  UserDecision,
} from "./types.js";

const ARCHITECTURAL_PATTERNS = [
  {
    regex: /\b(auth|authentications?|login|signups?)\b/i,
    category: "architecture" as const,
    description: "Authentication mechanism and session management are unspecified.",
    whyItMatters: "Affects token storage, middleware, session invalidation, and security compliance.",
    question: "Which authentication strategy should be implemented?",
    options: [
      { id: "A", text: "Stateless JWT tokens with Authorization Bearer header", tradeoff: "Horizontal scalability, cannot revoke instantly without blacklist" },
      { id: "B", text: "Server-side sessions with secure HTTP-only cookies", tradeoff: "Instant revocation, requires stateful store or sticky sessions" },
      { id: "C", text: "OAuth2 / OIDC provider integration (e.g. GitHub, Google)", tradeoff: "Delegates credentials, adds external dependency" },
    ],
  },
  {
    regex: /\b(payments?|checkout|billings?|subscriptions?)\b/i,
    category: "scope" as const,
    description: "Payment gateway integration details and idempotency constraints are unspecified.",
    whyItMatters: "Directly impacts compliance (PCI-DSS), webhook retry handling, and transaction state machines.",
    question: "What is the primary target payment processor and transaction flow?",
    options: [
      { id: "A", text: "Stripe PaymentIntents with asynchronous webhook handling", tradeoff: "Industry standard, requires webhook endpoint & signature validation" },
      { id: "B", text: "Generic pluggable payment adapter interface (multi-provider)", tradeoff: "High flexibility, requires building abstract provider contracts" },
      { id: "C", text: "Simulated/mock payment service for local/test environments", tradeoff: "Zero external setup, cannot process real currency" },
    ],
  },
  {
    regex: /\b(caches?|caching|memoizes?|memoization)\b/i,
    category: "nfr" as const,
    description: "Cache tier, invalidation policy, and TTL strategy are unspecified.",
    whyItMatters: "Determines memory footprint, cache consistency risks, and distributed sync requirements.",
    question: "Which caching architecture should be used?",
    options: [
      { id: "A", text: "In-memory LRU / Map cache with TTL expiration", tradeoff: "Zero external dependencies, not shared across process instances" },
      { id: "B", text: "Distributed Redis / Key-Value store", tradeoff: "Shared across clustered instances, requires infrastructure dependency" },
      { id: "C", text: "HTTP Cache-Control headers with ETag validation", tradeoff: "Relies on edge/client caching, best for public read endpoints" },
    ],
  },
  {
    regex: /\b(db|databases?|schemas?|migrations?|models?)\b/i,
    category: "data_model" as const,
    description: "Data persistence strategy, migration rollback, and locking behavior are unspecified.",
    whyItMatters: "Unplanned schema alterations can cause table locks or breaking backward compatibility.",
    question: "How should the data schema evolution be handled?",
    options: [
      { id: "A", text: "Additive-only migration with backward compatibility and zero downtime", tradeoff: "Safe for production, requires multiple phased releases" },
      { id: "B", text: "Strict relational table creation with foreign keys and cascade rules", tradeoff: "Strict relational integrity, potential migration locking" },
      { id: "C", text: "Document-oriented JSON/JSONB column extension", tradeoff: "Fast schema evolution, weaker relational constraints" },
    ],
  },
  {
    regex: /\b(apis?|endpoints?|routes?|rest|graphql)\b/i,
    category: "api_contract" as const,
    description: "API contract format, versioning, and error response standards are unspecified.",
    whyItMatters: "Public signature alterations can break existing API consumers and client SDKs.",
    question: "What API design contract should this endpoint conform to?",
    options: [
      { id: "A", text: "RESTful JSON API under existing route versioning (e.g. /v1/...)", tradeoff: "Predictable, standard HTTP status codes and payloads" },
      { id: "B", text: "Internal RPC / service-to-service contract", tradeoff: "Optimized for internal calls, not meant for external consumption" },
      { id: "C", text: "Event-driven asynchronous messaging", tradeoff: "Decoupled execution, requires consumer worker/queue infrastructure" },
    ],
  },
];

export function assessPromptClarity(prompt: string): ClarityAssessment {
  const trimmed = prompt.trim();
  const ambiguities: AmbiguityItem[] = [];
  const questions: ClarificationQuestion[] = [];

  let score = 100;

  // 1. Penalty for excessively short / vague prompts
  if (trimmed.length < 25) {
    score -= 40;
    ambiguities.push({
      category: "scope",
      description: `Prompt is very brief (${trimmed.length} characters) without declared boundaries.`,
      whyItMatters: "Lacks sufficient detail to determine impacted files, contracts, or non-functional constraints.",
    });
  } else if (trimmed.length < 50) {
    score -= 20;
  }

  // 2. Scan for architectural keywords with unspecified parameters
  for (const pattern of ARCHITECTURAL_PATTERNS) {
    if (pattern.regex.test(trimmed)) {
      // Check if prompt already gave specific clarification (e.g. explicitly mentions "JWT", "session", "Stripe", etc.)
      const hasSpecificDetails = pattern.options.some((opt) => {
        const keyPhrase = opt.text.toLowerCase().slice(0, 15);
        return trimmed.toLowerCase().includes(keyPhrase);
      });

      if (!hasSpecificDetails) {
        score -= 25;
        ambiguities.push({
          category: pattern.category,
          description: pattern.description,
          whyItMatters: pattern.whyItMatters,
        });

        questions.push({
          id: `Q${questions.length + 1}`,
          question: pattern.question,
          context: pattern.whyItMatters,
          options: pattern.options,
        });
      }
    }
  }

  // Fallback question if prompt is vague (< 25 chars) and no domain question matched
  if (questions.length === 0 && trimmed.length < 25) {
    questions.push({
      id: "Q1",
      question: "What is the primary architectural layer and scope for this change?",
      context: "The prompt lacks a declared target component or subsystem.",
      options: [
        { id: "A", text: "Backend service logic and data layer", tradeoff: "Focuses on API and data correctness" },
        { id: "B", text: "Frontend / CLI client interface", tradeoff: "Focuses on developer experience and inputs" },
        { id: "C", text: "Full vertical-slice implementation (end-to-end)", tradeoff: "Comprehensive, touches multiple system layers" },
      ],
    });
  }

  // 3. Check if any file path or function is referenced
  const hasFileOrSymbolReference = /\.(ts|js|py|go|rs|json|md)\b|[A-Z][a-zA-Z0-9]+Service|[a-zA-Z0-9]+Handler/i.test(trimmed);
  if (!hasFileOrSymbolReference && score < 80) {
    score -= 10;
    ambiguities.push({
      category: "scope",
      description: "No specific files, modules, or symbol targets were mentioned.",
      whyItMatters: "Agent must infer target blast radius using heuristics rather than declared scope.",
    });
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    clarityScore: finalScore,
    isClear: finalScore >= 75 && ambiguities.length === 0,
    prompt: trimmed,
    ambiguities,
    questions,
  };
}

import { loadRequirements, saveRequirements } from "./state.js";

export async function freezeRequirements(
  root: string,
  topic: string,
  decisions: UserDecision[],
): Promise<string> {
  const reqs = await loadRequirements(root);
  const timestamp = new Date().toISOString();

  for (const d of decisions) {
    reqs.requirements.push({
      id: `req-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
      topic,
      questionId: d.questionId,
      decision: `Option ${d.selectedOptionId}`,
      rationale: d.customText || "Standard trade-off accepted",
      confirmedAt: d.confirmedAt || timestamp,
    });
  }

  await saveRequirements(root, reqs);
  return path.join(root, ".engineering-intelligence", "aidlc", "inception", "requirements.md");
}
