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

## Procedure

1. **Dependency Vulnerability Scanning** — Parse lock files and manifests:

   | File | Ecosystem |
   |---|---|
   | `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` | npm |
   | `Pipfile.lock` / `requirements.txt` | Python |
   | `Cargo.lock` | Rust |
   | `go.sum` | Go |
   | `Gemfile.lock` | Ruby |
   | `composer.lock` | PHP |

   For each dependency:
   - Check version against known CVE databases (cite CVE IDs)
   - Flag dependencies with no updates in >12 months (abandonment risk)
   - Identify transitive dependencies with known vulnerabilities
   - Check license compatibility against the project license
   - Check maintenance health (days since last release/commit when available)
   - For frontend packages, estimate bundle size impact or require a bundle-size check
   - Note severity: critical, high, medium, low

   Trigger this targeted dependency risk review whenever manifests add a new package. Critical CVEs block completion before commit. Unknown license or maintenance data must be recorded as risk, not ignored.

2. **Auth/Authz Pattern Review** — Analyze authentication and authorization:

   | Check | What to Look For |
   |---|---|
   | Auth mechanism | JWT, session, OAuth, API keys — identify which is used |
   | Token handling | Storage (cookies, localStorage), expiration, refresh flow |
   | Password handling | Hashing algorithm, salt usage, strength validation |
   | Permission model | RBAC, ABAC, ACL — identify and assess |
   | Route protection | Unprotected endpoints that should require auth |
   | Privilege escalation | Missing authorization checks on sensitive operations |
   | Session management | Fixation prevention, timeout, invalidation |

3. **Secrets Detection** — Scan for exposed credentials:

   | Pattern | Risk |
   |---|---|
   | Hardcoded API keys / tokens | Critical |
   | Database connection strings with passwords | Critical |
   | Private keys committed to repository | Critical |
   | `.env` files without `.gitignore` coverage | High |
   | Secrets in CI/CD configuration | High |
   | Default/test credentials in non-test code | Medium |
   | Comments containing sensitive URLs or tokens | Medium |

   Check `.gitignore` for adequate secret file exclusions.

4. **OWASP Top 10 Checklist** — Assess against current OWASP Top 10:

   | # | Category | Assessment |
   |---|---|---|
   | A01 | Broken Access Control | Check route guards, CORS, directory traversal |
   | A02 | Cryptographic Failures | Check TLS, hashing, encryption at rest |
   | A03 | Injection | Check SQL, NoSQL, OS command, LDAP injection |
   | A04 | Insecure Design | Check business logic flaws, missing rate limits |
   | A05 | Security Misconfiguration | Check default configs, verbose errors, headers |
   | A06 | Vulnerable Components | Cross-ref with dependency scan results |
   | A07 | Auth Failures | Cross-ref with auth/authz review |
   | A08 | Data Integrity Failures | Check deserialization, CI/CD pipeline integrity |
   | A09 | Logging Failures | Check audit logging, sensitive data in logs |
   | A10 | SSRF | Check URL handling, outbound request validation |

   Rate each as: `pass`, `concern`, `fail`, or `not-applicable`.

5. **Input Validation Pattern Review** — Assess input handling:

   | Check | Description |
   |---|---|
   | Schema validation | Are API inputs validated against schemas? |
   | Sanitization | Is user input sanitized before use? |
   | File upload | Are uploads validated (type, size, content)? |
   | Query parameters | Are query params validated and typed? |
   | Output encoding | Is output encoded to prevent XSS? |
   | Rate limiting | Are endpoints rate-limited? |

6. **Generate Assessment** — Write findings to `knowledge-base/20-security-assessment.md`.

## Output Format

Write `knowledge-base/20-security-assessment.md`:

```markdown
# Security Assessment

## Meta
- Generated: <ISO timestamp>
- Mode: full | targeted
- Scope: <what was examined>
- Overall risk: low | medium | high | critical

## Dependency Vulnerabilities
| Dependency | Version | CVE | Severity | Fix Available | License | Maintenance | Bundle Impact |
|---|---|---|---|---|---|---|---|
| lodash | 4.17.15 | CVE-2020-8203 | High | Yes (4.17.21) | MIT | maintained | n/a |

## Auth/Authz Assessment
- Mechanism: <description>
- Findings: <issues found>
- Risk: <level>

## Secrets Scan
| Finding | File | Risk | Remediation |
|---|---|---|---|
| Hardcoded API key | src/config.ts:42 | Critical | Move to env variable |

## OWASP Top 10
| # | Category | Status | Evidence |
|---|---|---|---|
| A01 | Broken Access Control | concern | <finding> |

## Input Validation
| Area | Status | Evidence |
|---|---|---|
| API schema validation | pass | Uses Zod on all endpoints |

## Recommendations
1. <prioritized remediation actions>

## Evidence
- <file path citations for all findings>

---
*This security assessment did not modify product code.*
```

## Rules

- Never assume a vulnerability exists without evidence — cite file paths and line numbers
- Flag severity honestly — do not inflate or suppress findings
- Secrets detection must not log or expose the actual secret values in reports
- Mark `not-applicable` for OWASP categories genuinely irrelevant to the project
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] All dependency vulnerabilities cite CVE IDs and affected versions
- [ ] New package additions include CVE, license, maintenance, and bundle-size risk where applicable
- [ ] Critical CVEs block completion
- [ ] Auth/authz review covers both authentication and authorization
- [ ] Secrets scan does not expose actual secret values in the report
- [ ] OWASP Top 10 items each have a status with evidence or rationale
- [ ] Input validation assessment covers API boundaries
- [ ] Recommendations are prioritized by severity
- [ ] Report ends with the "did not modify product code" statement

## Cross-References

- Depends on: `deep-project-knowledge-extractor` (project structure understanding)
- Used by: `engineering-intelligence-skill`, `impact-analysis-engine` (security risk scoring)
- Updates: `knowledge-base/20-security-assessment.md`

This capability is analytical only. It must not modify product code.
