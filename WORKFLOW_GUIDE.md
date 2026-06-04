# Engineering Intelligence Workflow Guide

This guide explains how to install and use Engineering Intelligence in a new or existing project.

## 1. Choose Your Adapter

Install the toolkit from the project root you want to enhance:

```bash
npx engineering-intelligence install . --ide codex --yes
```

Common adapters:

```bash
npx engineering-intelligence install . --ide commandcode --yes
npx engineering-intelligence install . --ide cursor --yes
npx engineering-intelligence install . --ide claude-code --yes
npx engineering-intelligence install . --ide gemini-cli --yes
npx engineering-intelligence install . --ide generic --yes
```

Multiple adapters can be installed together:

```bash
npx engineering-intelligence install . --ide codex --ide commandcode --ide cursor --yes
```

## 2. Existing Project Setup

Use this flow for a brownfield repository.

1. Install the adapter:

   ```bash
   npx engineering-intelligence install . --ide commandcode --yes
   ```

2. Open the project in your AI coding environment.

3. Initialize intelligence:

   ```text
   /initialize-engineering-intelligence
   ```

4. Review generated artifacts:

   ```text
   knowledge-base/
   .engineering-intelligence/aidlc/
   .engineering-intelligence/context/
   .engineering-intelligence/memory/
   .engineering-intelligence/graph/
   .changes/
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
   /engineering-intelligence Add SSO login for enterprise customers using the scoped requirement
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
   npx engineering-intelligence install . --ide commandcode --yes
   ```

3. Start project creation:

   ```text
   /create-project Build a TypeScript API for subscription billing with PostgreSQL and Stripe
   ```

4. Initialize intelligence after scaffold generation:

   ```text
   /initialize-engineering-intelligence
   ```

5. Scope the first feature:

   ```text
   /scope-requirement Add customer checkout session creation
   ```

6. Implement:

   ```text
   /engineering-intelligence Add customer checkout session creation
   ```

## 4. Daily Development Flow

For each feature or bugfix:

1. Scope if the requirement is unclear:

   ```text
   /scope-requirement <feature or bug>
   ```

2. Preview impact without editing code when needed:

   ```text
   /engineering-intelligence dry-run: <feature or bug>
   ```

3. Implement:

   ```text
   /engineering-intelligence <feature or bug>
   ```

4. Review the change:

   ```text
   /review-engineering-change Review the current working-tree diff
   ```

5. Sync intelligence after manual edits:

   ```text
   /sync-engineering-intelligence Review the current working-tree diff
   ```

## 5. Safety Gates Run By The Main Workflow

The main `/engineering-intelligence` workflow applies these gates when relevant:

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

For non-trivial workflows, `/engineering-intelligence` should:

1. Run `context-budget-optimizer`.
2. Create `.engineering-intelligence/context/context-manifest.md`.
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
/api-snapshot-testing-engine
/database-migration-safety-engine
/environment-variable-auditor
/adr-compliance-checker
/dead-code-detector
/llm-prompt-injection-guard
/context-budget-optimizer
```

Usually, you do not need to call them manually. `/engineering-intelligence` invokes them when their trigger conditions apply.

## 8. Maintaining The Installation

Check installation health:

```bash
npx engineering-intelligence doctor .
```

Update managed templates:

```bash
npx engineering-intelligence update .
```

Preview an update:

```bash
npx engineering-intelligence update . --dry-run
```

Generate a local dashboard:

```bash
npx engineering-intelligence visualize .
```

Uninstall managed templates while preserving generated runtime intelligence:

```bash
npx engineering-intelligence uninstall .
```

## 9. CommandCode Notes

For CommandCode terminal:

```bash
npx engineering-intelligence install . --ide commandcode --yes
```

This writes:

```text
.commandcode/skills/
.commandcode/commands/
AGENTS.md
```

Use CommandCode slash commands such as:

```text
/initialize-engineering-intelligence
/scope-requirement Add audit logging
/engineering-intelligence Add audit logging
```

CommandCode also discovers `.agents/skills/`, but this toolkit uses `.commandcode/skills/` for the native project-level priority path.

## 10. Expected Outputs

After regular use, a healthy project contains:

```text
knowledge-base/
.engineering-intelligence/aidlc/
.engineering-intelligence/context/
.engineering-intelligence/context/context-manifest.md
.engineering-intelligence/memory/
.engineering-intelligence/graph/
.engineering-intelligence/reports/
.engineering-intelligence/snapshots/
.changes/
```

The most important files to review are:

```text
.engineering-intelligence/aidlc/aidlc-state.md
.engineering-intelligence/aidlc/execution-plan.md
.engineering-intelligence/aidlc/checkpoints.md
.engineering-intelligence/reports/IMP-XXX-*.md
.changes/CHG-XXX-*.md
knowledge-base/15-validation-report.md
```
