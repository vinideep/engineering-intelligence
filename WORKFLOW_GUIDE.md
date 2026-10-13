# GraphWard Workflow Guide

This guide explains how to install and use GraphWard in a new or existing project.

## 1. Choose Your Adapter

Install the toolkit from the project root you want to enhance:

```bash
graphward install . --ide codex --yes
```

Common adapters:

```bash
graphward install . --ide commandcode --yes
graphward install . --ide cursor --yes
graphward install . --ide claude-code --yes
graphward install . --ide gemini-cli --yes
graphward install . --ide generic --yes
```

Multiple adapters can be installed together:

```bash
graphward install . --ide codex --ide commandcode --ide cursor --yes
```

## 2. Existing Project Setup

Use this flow for a brownfield repository.

1. Install the adapter:

   ```bash
   graphward install . --ide commandcode --yes
   ```

2. Open the project in your AI coding environment.

3. Initialize intelligence:

   ```text
   /initialize-graphward
   ```

4. Review generated artifacts:

   ```text
   .graphward/knowledge-base/
   .graphward/aidlc/
   .graphward/context/
   .graphward/memory/
   .graphward/graph/
   .graphward/changes/
   ```

5. Run a focused architecture map when needed:

   ```text
   /map-architecture
   ```

6. Before a major change, scope it:

   ```text
   /scope-requirement Add SSO login for enterprise customers
   ```

7. Implement through the main workflow:

   ```text
   /graphward Add SSO login for enterprise customers using the scoped requirement
   ```

The implementation workflow runs AI-DLC internally: freshness gate, impact report, Agile artifacts, safety gates, tests, sync, change history, and review when needed.

## 3. New Project Setup

Use this flow for a greenfield project.

1. Create or enter the empty project directory:

   ```bash
   mkdir my-product
   cd my-product
   ```

2. Install the toolkit:

   ```bash
   graphward install . --ide commandcode --yes
   ```

3. Start project creation:

   ```text
   /create-project Build a TypeScript API for subscription billing with PostgreSQL and Stripe
   ```

4. Initialize intelligence after scaffold generation:

   ```text
   /initialize-graphward
   ```

5. Scope the first feature:

   ```text
   /scope-requirement Add customer checkout session creation
   ```

6. Implement:

   ```text
   /graphward Add customer checkout session creation
   ```

## 4. Daily Development Flow

For each feature or bugfix:

1. Scope if the requirement is unclear:

   ```text
   /scope-requirement <feature or bug>
   ```

2. Preview impact without editing code when needed:

   ```text
   /graphward dry-run: <feature or bug>
   ```

3. Implement:

   ```text
   /graphward <feature or bug>
   ```

4. Review the change:

   ```text
   /review-engineering-change Review the current working-tree diff
   ```

5. Sync intelligence after manual edits:

   ```text
   /sync-graphward Review the current working-tree diff
   ```

   For a fast deterministic refresh when an IDE agent is not available, pass the
   changed source files directly. This updates the graph, provider indexes, and
   derived claims without rewriting canonical knowledge prose:

   ```bash
   graphward sync . --files src/routes/route-plan.ts,src/providers/carrier.ts
   ```

   A source change reports that model-assisted knowledge synchronization is
   required. Let the IDE workflow update only the affected knowledge sections.
   The native graph merge is incremental; provider-backed runs may still refresh
   their approved workspace index. Use native mode for the fastest deterministic
   local refresh.

## 5. Safety Gates Run By The Main Workflow

The main `/graphward` workflow applies these gates when relevant:

| Gate | Trigger |
|---|---|
| Freshness / drift | Any implementation request |
| Impact analysis | Any implementation request |
| Acceptance criteria mapping | Product behavior changes |
| Type safety | Typed projects |
| API compatibility | API, SDK, event, webhook, or schema contracts |
| API snapshots | Replayable API response behavior |
| Database migration safety | Migrations, schemas, ORM models, indexes |
| Dependency security | New or upgraded packages |
| Environment variable audit | Env vars, config schemas, CI/deploy secrets |
| ADR compliance | Architecture-governed areas |
| LLM prompt injection | User input reaches LLMs, RAG, tools, or durable memory |
| Rollback planning | Medium, high, or critical risk changes |
| Observability | New endpoints, jobs, services, or production paths |

## 6. Token Usage And Context Budget

The toolkit is designed to avoid loading every document into the AI IDE context.

For non-trivial workflows, `/graphward` should:

1. Run `context-budget-optimizer`.
2. Create `.graphward/context/context-manifest.md`.
3. Rank context by graph proximity to the change.
4. Load only relevant H2 sections, table rows, graph nodes/edges, and file snippets.
5. Keep initial intelligence loading under roughly 40% of available context budget.
6. Lazy-load API, migration, security, snapshot, ADR, and LLM evidence only when those gates are triggered.

This keeps token usage lower while preserving the same safety gates and final outputs.

## 7. Useful Direct Skill Invocations

If your environment supports direct skill invocation, use these for focused work:

```text
/type-safety-engine
/api-backward-compatibility-engine
/database-migration-safety-engine
/environment-variable-auditor
/adr-compliance-checker
/dead-code-detector
/llm-prompt-injection-guard
/context-budget-optimizer
```

Usually, you do not need to call them manually. `/graphward` invokes them when their trigger conditions apply.

## 8. Maintaining The Installation

Check installation health:

```bash
graphward doctor .
```

Update managed templates:

```bash
graphward update .
```

Preview an update:

```bash
graphward update . --dry-run
```

Generate a local dashboard:

```bash
graphward visualize .
```

Uninstall managed templates while preserving generated runtime intelligence:

```bash
graphward uninstall .
```

## 9. CommandCode Notes

For CommandCode terminal:

```bash
graphward install . --ide commandcode --yes
```

This writes:

```text
.commandcode/skills/
.commandcode/commands/
AGENTS.md
```

Use CommandCode slash commands such as:

```text
/initialize-graphward
/scope-requirement Add audit logging
/graphward Add audit logging
```

CommandCode also discovers `.agents/skills/`, but this toolkit uses `.commandcode/skills/` for the native project-level priority path.

## 10. Expected Outputs

After regular use, a healthy project contains:

```text
.graphward/knowledge-base/
.graphward/aidlc/
.graphward/context/
.graphward/context/context-manifest.md
.graphward/memory/
.graphward/graph/
.graphward/reports/
.graphward/snapshots/
.graphward/changes/
```

The most important files to review are:

```text
.graphward/aidlc/aidlc-state.md
.graphward/aidlc/execution-plan.md
.graphward/aidlc/checkpoints.md
.graphward/reports/IMP-XXX-*.md
.graphward/changes/CHG-XXX-*.md
.graphward/knowledge-base/15-validation-report.md
```
