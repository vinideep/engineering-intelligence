> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: mcp-security-governor
description: Reviews MCP tools and external execution surfaces for scoped authorization, schema integrity, sandboxing, and human approval gates.
---

# MCP Security Governor

Use this skill when a project configures MCP servers, external tool execution, CI/CD automation, database access, deployment tools, or any agent-callable side effect.

## Security Model

Check for defense in depth:
- OAuth 2.1 or equivalent modern authorization for remote servers
- PKCE for public clients where applicable
- Server metadata validation before authorization
- Tool-level permissions rather than server-level blanket permissions
- Explicit user approval for destructive or irreversible actions
- Tool schema hashing or pinning to detect schema drift
- Sandboxed local execution with workspace-scoped filesystem access
- Secrets kept out of prompts, logs, artifacts, and generated documentation

## MCP Review Artifact

Write `$AIDLCoperations/mcp-security-review.md`:

```markdown
# MCP Security Review

## Configurations Reviewed
- <path or Not detected>

## Tool Inventory
| Server | Tool | Capability | Permission Scope | Destructive | Approval Required |
|---|---|---|---|---|---|

## Risks
- <risk, evidence, severity>

## Required Controls
- <control and implementation owner>

## Approval Boundaries
- <actions that must never run without human confirmation>
```

## Rules

- Do not grant a tool broader filesystem, network, or deployment permission than the task requires.
- Treat changed tool definitions as untrusted until revalidated.
- Destructive actions must expose raw parameters to the user before execution.
