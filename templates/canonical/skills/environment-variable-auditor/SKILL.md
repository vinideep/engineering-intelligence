---
name: environment-variable-auditor
description: Audits environment variable usage against examples, validation schemas, CI secrets, and deployment configuration.
version: 1.0.0
---

# Environment Variable Auditor

Use this skill when code adds, removes, or changes environment variables, configuration schemas, deployment manifests, or CI/CD secrets.

## Procedure

1. Detect environment variable reads:
   - Node: `process.env.*`
   - Python: `os.environ`, `os.getenv`
   - Go: `os.Getenv`
   - Ruby: `ENV[]`
   - Java/Kotlin/C#: equivalent environment APIs
2. Compare against `.env.example`, `.env.sample`, README setup docs, deployment manifests, CI secret declarations, and validation schemas such as Zod, envalid, pydantic, dotenv-safe, or custom config loaders.
3. Flag:
   - missing example entries
   - missing validation/default
   - stale example vars no longer used
   - required vars not present in CI/deployment docs
   - secrets accidentally committed or documented with real values
4. Block completion for newly required production env vars without docs and validation.

## Output

Write `.engineering-intelligence/aidlc/construction/<unit>/environment-variable-audit.md`:

```markdown
# Environment Variable Audit: <unit>

| Variable | Usage | Example Present | Validation Present | Deployment/CI Present | Risk |
|---|---|---|---|---|---|

## Required Fixes
- <missing or stale env handling>
```

## Quality Gates

- [ ] Env reads were scanned
- [ ] Example files and validation schemas were checked
- [ ] CI/deployment declarations were checked when present
- [ ] New required env vars are documented and validated
