---
name: security-audit-engine
description: Performs evidence-based security audits covering dependency vulnerabilities, auth/authz patterns, secrets detection, OWASP Top 10 compliance, and input validation. Use during initialization, before releases, or when security-sensitive changes are detected.
version: 3.0.0
---

# Security Audit Engine

Identify security risks through systematic, evidence-backed analysis of dependencies, authentication patterns, secrets hygiene, and input handling.

## Inputs

- Repository root path
- Mode: `full` (comprehensive audit) or `targeted` (specific area or post-change)
- Optional: scope constraints (specific modules, change diff)
- Optional: previous assessment (`knowledge-base/20-security-assessment.md`) for delta comparison

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
