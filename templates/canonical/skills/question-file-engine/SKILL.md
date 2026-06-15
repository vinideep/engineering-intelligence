---
name: question-file-engine
description: Writes structured MCQ clarification files to .engineering-intelligence/aidlc/open-questions/ instead of asking questions inline. Creates durable decision artifacts and enables context reset between question creation and answer processing. Use when a request has 3+ ambiguities or scope is unclear.
version: 1.0.0
---

# Question File Engine

Write structured clarification question files rather than asking questions inline in chat. This pattern creates durable decision artifacts, lets users answer thoughtfully with full context visible, and enables a context reset between question creation and answer processing — so each phase starts with a fresh focused context.

## When to Use

- Request has clarity: Vague, Incomplete, or Contradictory
- 3 or more clarifications are needed before proceeding
- Questions involve trade-offs the user must decide (not resolvable from codebase alone)
- Starting a long workflow where misaligned assumptions cost significant rework

## Inputs

- Original request or initiative description
- Ambiguity analysis from calling skill (requirement-scoper, backlog-decomposition-engine)
- Optional: project architecture from `knowledge-base/`, `$EI graph/`

## Procedure

### 1. Identify Ambiguities

Group unknowns into categories before writing:

| Category | Examples |
|---|---|
| Scope | In/out of MVP, affected modules, integration boundaries |
| Strategy | Which implementation approach, library, or architecture pattern |
| Risk | Tolerance for breaking changes, migration complexity |
| Priority | Ship now vs. defer, dependency ordering |

Cap at 8 questions per file. Write a second file for additional batches.

### 2. Write the Question File

Save to `$AIDLC open-questions/YYYYMMDD-{slug}.md`:

```markdown
# Clarification Questions: {topic}

**Instructions:** Check boxes to select answers. Multiple selections are fine. Write a custom answer after "Custom:" when no option fits.
Return to chat and say **"questions answered, continue"** when done.

---

## Q1: {Question?}

**Context:** {1–2 sentences explaining why this matters for the implementation.}

- [ ] A) {Option A}
- [ ] B) {Option B}
- [ ] C) {Option C}
- [ ] D) Custom: _______________

---

## Q2: {Question?}

**Context:** {why this matters}

- [ ] A) {Option A}
- [ ] B) {Option B}
- [ ] C) Custom: _______________

---

_Created: {ISO date} | Topic: {original request summary}_
```

Guidelines for good questions:
- Every question must have a concrete impact on the implementation plan
- Include 2–4 options with brief descriptions; always include a "Custom" option
- Order questions: scope first, then strategy, then risk
- State the default assumption in option A if the user skips the question

### 3. Stop and Signal

After writing the file, output exactly this and nothing else:

> Questions written to `$AIDLC open-questions/{filename}`.
>
> **Next step:** Open the file, check boxes to select your answers (you may select multiple), then return here and say **"questions answered, continue"**.

**Stop. Do not proceed. Do not guess answers. Wait for explicit user signal.**

### 4. Resume Protocol

When user signals answers are ready:

1. **Re-read the question file from disk.** Never rely on in-context memory of the questions — always use the Read tool to load the current file content.
2. Validate every question has at least one checked box or a "Custom:" response.
3. If any critical question is unanswered, ask inline (one concise message, not another file).
4. Extract confirmed decisions and carry them forward. Reference the question file path in all generated artifacts and the QA log.

## Output

- `$AIDLC open-questions/YYYYMMDD-{slug}.md` — question file (before resume)
- On resume: confirmed decision set, referenced by path in the calling skill's output

## Rules

- Never ask 3+ questions inline — always write a question file.
- Never guess or assume answers to unresolved questions.
- Always re-read the file from disk on resume; never trust in-memory question content.
- Log confirmed decisions in `knowledge-base/19-requirements.md` section `## 4. Iterated QA Log`.
