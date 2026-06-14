# Discovery: Vision

## Business Objective
`engineering-intelligence` is an NPM CLI that installs a reusable, graph-backed
Agile + AI-DLC engineering-orchestration toolkit into any software repository for
AI coding IDEs. It gives those IDEs the skills, agents, and slash-command workflows
to initialize an evidence-based project knowledge base, autonomously decompose
initiatives into a hierarchical backlog, and deliver that backlog under a
human-in-the-loop approval model.

## Target Personas
- **Developer using Claude Code** — wants slash commands that just work, forwarding
  their natural-language request directly into the right workflow.
- **Team using multiple IDEs** — needs one install command that produces native output
  for each IDE in a single pass.
- **Engineering lead** — wants autonomous decomposition of a large initiative into
  durable epics/features/tickets, gated delivery, and optional GitHub Issues sync.
- **Package maintainer** — needs a CI-safe test suite, predictable adapter contracts,
  and a straightforward path to adding new IDE adapters.

## Success Metrics
- Every IDE adapter correctly wires user input into request-driven commands (no dropped args).
- `decompose-backlog` + `deliver-backlog` generate valid, navigable backlog artifacts.
- `npm test` covers all adapter contracts, installation lifecycle, and template validity.
- `doctor` reports zero errors on a fresh install.
- Adding a new IDE adapter requires only one renderer function + one test block.
