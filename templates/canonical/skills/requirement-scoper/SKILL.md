---
name: requirement-scoper
description: Iteratively scopes product requirements by acting as a detailed business and technical analyst, asking clarifying questions, and generating a finalized requirement prompt.
version: 1.0.0
---

# Requirement Scoper

Act as a detailed Business Analyst and Technical Architect persona. Analyze the user's initial high-level feature, bug report, or change request. Cross-reference it against existing project intelligence, documentation, graph structures, and codebase patterns to draft clarifying questions and generate an accurate requirement prompt.

## Inputs

- User initial request (scope, feature, or bug details)
- `knowledge-base/` (existing project domain context)
- `.engineering-intelligence/graph/` (dependency graphs)
- `.engineering-intelligence/memory/` (durable architecture/business decisions)

## Procedure

1. **Analyze Current Knowledge** — Consult all intelligence inputs:
   - Identify domain logic in `knowledge-base/` matching the request category
   - Query dependency/service graphs to locate related modules and boundaries
   - Read architecture memory to understand tech constraints and guidelines
   - Scan relevant modules for implicit invariants and dominant implementation constraints before asking questions:
     - retry strategies, timeout values, rate limits, pagination defaults
     - locking/idempotency patterns
     - validation style and error codes
     - logging/tracing conventions
     - framework patterns used in 80% or more of similar code
   - Surface confirmed dominant patterns as constraints in the requirements document.

2. **Formulate Scoping Questions** — Determine clarity level from the analysis:

   | Clarity | Undefined ambiguities | Action |
   |---|---|---|
   | Clear | 0–2 minor gaps | Ask inline; proceed after user responds |
   | Vague | 3–5 gaps or unclear scope | Use `question-file-engine` to write a structured question file; **stop and wait** |
   | Incomplete | Missing critical info | Use `question-file-engine`; do not proceed until all critical questions are answered |

   When using `question-file-engine`, invoke it now and stop. Do not continue this procedure until the user signals answers are ready.

   When asking inline (Clear clarity), keep to 3–5 targeted questions covering:
   - **Business Value & Scope**: What are the limits of the MVP?
   - **Agile Story Shape**: Which user role, goal, priority, dependencies, and release expectation apply?
   - **Technical Strategy**: Which specific database, caching, or third-party integrations are expected?
   - **Edge Cases**: How should errors, rate limits, or validation failures be handled?
   - **UI/UX (if applicable)**: What configuration or user feedback is expected?

3. **Iterate with User** — Wait for user responses. Adjust assumptions based on their answers.

4. **Generate Final Requirement Prompt** — Once requirements are clear, output a comprehensive requirements document to `knowledge-base/19-requirements.md`, update Agile artifacts under `.engineering-intelligence/aidlc/agile/`, and formulate the finalized prompt for the development agent.

## Output Format

The final requirements document `knowledge-base/19-requirements.md` must follow this structure:

```markdown
# Requirements: <Feature Name>

## 1. Business Context & Objective
<Summary of the goal, business value, and target scope>

## 2. Technical Requirements
- **Logic & Configuration**: <Exact details on implementation strategy, libraries, config parameters>
- **System Boundaries & Dependencies**: <Files/modules affected based on graph mappings>
- **Edge Cases & Failure Modes**: <Exactly how to handle failures, retries, limits>
- **Implicit Codebase Constraints**: <Dominant existing patterns discovered from relevant modules, with evidence paths>

## 3. Agile Delivery Model
- **Epic**: <epic or initiative>
- **User Story**: As a <persona>, I want <capability>, so that <outcome>.
- **Priority**: <P0/P1/P2 or project convention>
- **Acceptance Criteria**:
  - Given <context>, when <action>, then <observable result>.
- **Definition of Ready**:
  - <ready gate status>
- **Definition of Done**:
  - <done gate expectations>

## 4. Iterated QA Log
<Questions asked and answers received during scoping>

## 5. Finalized Implementation Prompt
Provide the exact prompt to pass to the coding agent to execute this change:
```text
/engineering-intelligence <Fully detailed requirements and file scope here>
```
```

## Rules

- **Do not modify product code** — this skill is strictly for scoping and analysis.
- Do not make assumptions on ambiguities; always ask clarifying questions.
- Base questions and plans on project graph mappings and existing memory files.
- Keep Agile artifacts synchronized with the final requirement prompt.

## Quality Gates

- [ ] Clear business goals and technical boundaries defined.
- [ ] At least 3 scoping questions asked and logged.
- [ ] User story, acceptance criteria, priority, dependencies, and Ready/Done gates are documented.
- [ ] Implicit codebase constraints were mined and cited before questions were finalized.
- [ ] Finalized prompt maps exact files and modules.
- [ ] Output does not contain any code modification.
