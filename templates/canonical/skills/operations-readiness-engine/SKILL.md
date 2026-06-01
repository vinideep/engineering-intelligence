---
name: operations-readiness-engine
description: Produces deployment, observability, rollback, and runbook readiness artifacts for production-bound AI-DLC changes.
version: 1.0.0
---

# Operations Readiness Engine

Use this skill when a change affects deployment, infrastructure, runtime behavior, SLOs, data migrations, incident response, or production monitoring.

## Procedure

1. Identify deployment target, environment variables, infrastructure files, CI/CD gates, and runtime services.
2. Define release strategy: normal deploy, canary, blue/green, feature flag, or manual rollout.
3. Define rollback plan and data recovery constraints.
4. Define observability: metrics, traces, logs, dashboards, alerts, and ownership.
5. Confirm production readiness with objective gates.

## Outputs

Write `.engineering-intelligence/aidlc/operations/operations-readiness.md`:

```markdown
# Operations Readiness

## Deployment Scope
- <services, packages, infrastructure>

## Release Strategy
- Strategy: <normal|canary|blue-green|feature-flag|manual>
- Human approvals required: <yes/no and why>

## Observability
| Signal | Source | Threshold | Owner | Runbook |
|---|---|---|---|---|

## Rollback
- Code rollback:
- Data rollback:
- Configuration rollback:

## Readiness Gates
- [ ] Build passes
- [ ] Tests pass
- [ ] Migrations are backward compatible or downtime is approved
- [ ] Alerts/runbooks exist for changed failure modes
- [ ] Secrets and environment variables are documented securely
```

## Rules

- Never execute production deployment without explicit user approval.
- Mark unknown production constraints in `open-questions.md`.
- For database changes, require backward-compatible migration planning unless downtime is approved.
