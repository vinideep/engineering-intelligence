# GitHub Action: PR impact comments

Turn every pull request into an evidence-backed impact review. The action builds
a real dependency + call graph of your repo, computes what the PR's changes
affect, and posts a sticky comment with:

- **Direct / indirect dependents** — modules and functions that call into the
  changed code (computed by reverse-walking the graph, not guessed).
- **Tests to run** — test files that transitively depend on the change.
- **Risk notes** — warnings when the change touches high-churn files.

Because it's computed from a deterministic graph, the comment is reproducible
and cites file:line evidence — no LLM in the loop.

## Setup

1. Copy the template into your repository:

   ```bash
   mkdir -p .github/workflows
   cp node_modules/engineering-intelligence/templates/github-action/engineering-intelligence-impact.yml \
      .github/workflows/
   ```

   Or download it directly from the repo and drop it in `.github/workflows/`.

2. Commit and push. The action runs on every `pull_request` (opened, updated,
   reopened).

No extra secrets are needed — it uses the default `GITHUB_TOKEN`. The workflow
grants itself `pull-requests: write` to post the comment.

## What it runs

Under the hood the workflow is just the CLI you can run locally:

```bash
engineering-intelligence map .
git diff --name-only origin/main...HEAD | xargs engineering-intelligence impact --json
```

## Customizing

- **Comment content** — edit the `github-script` step in the workflow.
- **Which events trigger it** — adjust the `on.pull_request.types` list.
- **Monorepos** — run `map` on a subdirectory and pass a scoped file list to
  `impact`.

## Local equivalent

Everything the action does is available locally:

```bash
# What breaks if I change these files?
engineering-intelligence impact src/graph/index.ts src/mcp/index.ts

# Who calls this function?
engineering-intelligence who-calls buildGraph

# Does the knowledge base still match the code?
engineering-intelligence verify --strict
```
