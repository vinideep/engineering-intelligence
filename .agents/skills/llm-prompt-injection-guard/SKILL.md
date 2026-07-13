> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: llm-prompt-injection-guard
description: Detects user-input-to-LLM prompt injection paths, unsafe RAG ingestion, unvalidated LLM outputs, and poisoned AI memory/documentation flows.
---

# LLM Prompt Injection Guard

Use this skill for AI-augmented applications, RAG pipelines, agent tools, prompt builders, chat handlers, knowledge ingestion, or any code that sends user-controlled data to an LLM.

## Procedure

1. Detect LLM calls, prompt templates, tool outputs, embedding pipelines, document ingestion, and agent memory writes.
2. Trace user-controlled sources into prompts, system messages, tool descriptions, retrieval documents, logs, knowledge-base files, and memory files.
3. Flag missing controls:
   - no prompt boundary separation
   - no input sanitization or quoting
   - no output schema validation
   - tool results trusted without validation
   - externally sourced content written into durable memory without provenance
   - secrets or policies exposed to user-influenced context
4. Require adversarial tests for high-risk LLM paths.

## Output

Write `$EIreports/LLM-PROMPT-INJECTION-<slug>.md`:

```markdown
# LLM Prompt Injection Review: <summary>

## Data Paths
| Source | LLM / Memory Sink | Control Present | Risk | Evidence |
|---|---|---|---|---|

## Findings
- <prompt injection or output validation risk>

## Required Tests
- <adversarial test cases>
```

## Quality Gates

- [ ] LLM calls and memory/document ingestion paths were inventoried
- [ ] User-controlled sources were traced to LLM and durable-memory sinks
- [ ] Output validation was checked
- [ ] High-risk paths have adversarial tests or blocking findings
