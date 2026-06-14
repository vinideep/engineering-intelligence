> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: operations-readiness-engine
description: Produces deployment, observability, rollback, and runbook readiness artifacts for production-bound AI-DLC changes.
version: 1.0.0
---

# Operations Readiness Engine

Use this skill when a change affects deployment, infrastructure, runtime behavior, SLOs, data migrations, incident response, or production monitoring.

For medium-and-above risk changes, use the rollback planning section even when the change is not deployment-bound. Rollback planning is a release safety gate, not only an infrastructure concern.

## Procedure

1. Identify deployment target, environment variables, infrastructure files, CI/CD gates, and runtime services.
2. Define release strategy: normal deploy, canary, blue/green, feature flag, or manual rollout.
3. Define rollback plan and data recovery constraints.
4. Define observability: metrics, traces, logs, dashboards, alerts, and ownership.
5. Inject or flag observability gaps for new functions, endpoints, jobs, service interactions, and business events.
6. Confirm production readiness with objective gates.

## Outputs

Write `$AIDLCoperations/operations-readiness.md`:

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

## Observability Injection
| New / Changed Path | Entry Log | Exit Log | Trace Span | Error Metric | Business Event | Status |
|---|---|---|---|---|---|---|

## Rollback
- Code rollback: `git revert <commit>` or <branch rollback sequence>
- Data rollback: <down migration / compensating SQL / irreversible approval>
- Feature flag rollback: <toggle and expected effect>
- Infrastructure rollback: <IaC rollback sequence>
- External dependency rollback: <vendor/config rollback>

## Readiness Gates
- [ ] Build passes
- [ ] Tests pass
- [ ] Migrations are backward compatible or downtime is approved
- [ ] Alerts/runbooks exist for changed failure modes
- [ ] Rollback planner covers code, data, feature flag, and infrastructure rollback for medium+ risk
- [ ] New endpoints/functions/services have logging, tracing, metrics, and business-event coverage or explicit gaps
- [ ] Secrets and environment variables are documented securely
```

## Rules

- Never execute production deployment without explicit user approval.
- Mark unknown production constraints in `open-questions.md`.
- For database changes, require backward-compatible migration planning unless downtime is approved.
- Medium-and-above risk changes require rollback procedures in both `operations-readiness.md` and the CHG record.
- Irreversible steps require explicit human approval.
