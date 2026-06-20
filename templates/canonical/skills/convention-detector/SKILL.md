---
name: convention-detector
description: Detects and codifies project conventions by analyzing naming patterns, import organization, code structure, API patterns, test patterns, git conventions, and architecture patterns. Produces a conventions document and enhances coding-patterns memory.
version: 3.0.0
---

# Convention Detector

Systematically analyze a codebase to detect, classify, and document conventions that are implicitly followed but not explicitly written down. Conventions are inferred from statistical patterns across the codebase — a pattern must appear in >70% of relevant files to be classified as a convention.

This capability does not modify product code.

## Inputs

- Repository root path
- Optional: scope constraints (specific package, service, or directory)
- Optional: output from `codebase-discovery-engine` (tech stack, framework, file patterns)

## Procedure

1. **Sample files** — Select a representative sample of at least 20 source files across different modules. Prioritize recently modified files and files by different contributors to capture team-wide conventions (not individual habits).

2. **Detect naming conventions** — Analyze the following naming patterns:

   | Target | What to Detect | Example Patterns |
   |---|---|---|
   | Variables | camelCase, snake_case, PascalCase, SCREAMING_SNAKE | `userName` vs `user_name` |
   | Functions | camelCase, snake_case, verb-first, noun-first | `getUser()` vs `user_get()` |
   | Classes/Types | PascalCase, suffixes (Service, Controller, Repository) | `UserService`, `AuthMiddleware` |
   | Files | kebab-case, camelCase, PascalCase, dot-separated | `user-service.ts` vs `UserService.ts` |
   | Directories | singular, plural, kebab-case, camelCase | `model/` vs `models/` |
   | Tests | `.test.`, `.spec.`, `_test`, `Test` suffix | `user.test.ts` vs `user.spec.ts` |
   | Constants | SCREAMING_SNAKE, PascalCase enum members | `MAX_RETRIES`, `HttpStatus.OK` |
   | Database | snake_case tables, camelCase columns, pluralization | `user_accounts` vs `UserAccount` |
   | API routes | kebab-case, snake_case, camelCase, plural resources | `/api/user-accounts` vs `/api/userAccounts` |

3. **Detect import organization** — Analyze import blocks for:

   | Pattern | What to Detect |
   |---|---|
   | **Grouping** | External → internal → relative? Alphabetical within groups? |
   | **Path style** | Absolute (`@/components/Button`) vs relative (`../../components/Button`) |
   | **Path aliases** | `@/`, `~/`, `#/` — check `tsconfig.json` paths, webpack aliases |
   | **Barrel files** | `index.ts` re-exports? Per-directory or selective? |
   | **Type imports** | Separate `import type` vs inline `type` keyword |
   | **Wildcard imports** | `import * as` usage frequency |
   | **Default vs named** | Preference for default or named exports |
   | **Side-effect imports** | CSS/style imports, polyfills |

4. **Detect code structure patterns** — Analyze:

   | Pattern | What to Detect |
   |---|---|
   | **Paradigm** | Functional vs class-based vs mixed |
   | **Error handling** | Try-catch, Result/Either types, error-first callbacks, custom error classes |
   | **Logging** | Logger library, log levels, structured logging, log format |
   | **Validation** | Zod, Joi, class-validator, manual checks, where validation lives |
   | **Configuration** | Environment variables, config files, feature flags, config patterns |
   | **Dependency injection** | Constructor injection, container-based, module-based, manual wiring |
   | **Async patterns** | async/await, Promises, callbacks, Observables |
   | **Null handling** | Optional chaining, null checks, Maybe/Option types, assertions |
   | **Comment style** | JSDoc, docstrings, inline comments, section headers |
   | **Function length** | Typical function LOC, max observed, decomposition style |
   | **Module exports** | Single responsibility per file? Multiple exports? |

5. **Detect API patterns** — Analyze API endpoints for:

   | Pattern | What to Detect |
   |---|---|
   | **REST conventions** | Resource naming, HTTP method usage, nested resources |
   | **Response envelope** | `{ data, error, meta }` vs raw responses vs `{ success, result }` |
   | **Error format** | Error codes, error messages, error detail structure |
   | **Pagination** | Cursor-based, offset-based, page-based, query params |
   | **Versioning** | URL path (`/v1/`), header-based, query param |
   | **Auth headers** | Bearer token, API key, cookie-based |
   | **Request validation** | Schema validation middleware, manual checks |
   | **Status codes** | Consistent status code usage patterns |
   | **Serialization** | camelCase vs snake_case in JSON responses |

6. **Detect test patterns** — Analyze test files for:

   | Pattern | What to Detect |
   |---|---|
   | **File placement** | Co-located (`__tests__/`, adjacent), separate `test/` tree, or `spec/` |
   | **Naming** | `*.test.*`, `*.spec.*`, `*_test.*`, `Test*` prefix |
   | **Structure** | `describe`/`it` nesting, flat tests, BDD-style, given-when-then |
   | **Assertion style** | `expect().toBe()`, `assert.*`, `should.*`, custom matchers |
   | **Mocking** | `jest.mock()`, `vi.mock()`, dependency injection, manual stubs |
   | **Fixtures** | Factory functions, fixture files, inline data, builders |
   | **Setup/teardown** | `beforeEach`/`afterEach`, `setup()`/`teardown()`, per-test setup |
   | **Coverage** | Coverage thresholds, ignored paths, branch vs line coverage |
   | **Integration tests** | Database setup, API testing, test containers |
   | **E2E tests** | Page objects, test selectors (`data-testid`), base URLs |

7. **Detect git patterns** — Analyze git history and config for:

   | Pattern | What to Detect |
   |---|---|
   | **Commit format** | Conventional commits, free-form, ticket references, emoji |
   | **Branch naming** | `feature/`, `fix/`, `chore/`, ticket number prefix, kebab-case |
   | **PR conventions** | PR templates, required reviewers, auto-merge, squash vs merge |
   | **Release process** | Tags, changelogs, release branches, semantic versioning |
   | **Hooks** | Husky, lefthook, pre-commit, lint-staged |
   | **Merge strategy** | Squash merge, merge commits, rebase, linear history |

8. **Detect architecture patterns** — Analyze structural boundaries:

   | Pattern | What to Detect |
   |---|---|
   | **Layer boundaries** | Clear separation of presentation/business/data layers |
   | **Module boundaries** | Feature-based, layer-based, domain-based organization |
   | **State management** | Redux, Zustand, Jotai, MobX, React Context, Vuex/Pinia, signals |
   | **Data fetching** | React Query, SWR, tRPC, REST clients, GraphQL clients |
   | **Middleware chains** | Ordered middleware, decorator patterns, interceptors |
   | **Event patterns** | Event emitters, pub/sub, event sourcing, domain events |
   | **Repository pattern** | Data access abstraction, query encapsulation |
   | **Service pattern** | Business logic isolation, service layer thickness |

9. **Calculate adherence scores** — For each detected convention, calculate:
   - **Adherence rate**: percentage of relevant files/instances following the convention
   - **Exceptions**: specific files or modules that deviate (and possible reasons)
   - **Confidence**: how certain the detection is (based on sample size)

   ## Convention Severity

   Classify violations with these blocking rules:

   | Severity | Meaning | Completion Rule |
   |---|---|---|
   | `critical` | Violates architectural boundary, security convention, data access rule, public API shape, or framework lifecycle rule | Blocks completion |
   | `major` | Breaks dominant project structure, error handling, logging, import style, or test pattern in a way that creates maintenance risk | Must fix or record review finding |
   | `minor` | Local naming/order/style mismatch that is mechanically fixable | Auto-correct when safe |
   | `exception` | Existing legacy or documented exception | Record but do not block |

   A pattern must exceed `>70%` adherence to be treated as a convention. Structural means the violation changes file placement, layer ownership, dependency direction, API envelope, persistence access, or lifecycle hook usage rather than simple naming.

10. **Write conventions document** — Generate `knowledge-base/16-conventions.md` following the output format below.

11. **Enhance coding patterns memory** — Update `.engineering-intelligence/memory/coding-patterns.md` with durable conventions that are unlikely to change.

## Output: `knowledge-base/16-conventions.md`

```markdown
# Project Conventions

Generated: <timestamp>
Sample size: <N files analyzed across M modules>

## Naming Conventions

| Target | Convention | Adherence | Exceptions | Evidence |
|---|---|---|---|---|
| Variables | camelCase | 98% | None | Sampled 150 variable declarations |
| Files | kebab-case | 94% | Legacy `utils/` dir uses camelCase | `src/components/user-profile.tsx` |
| ... | ... | ... | ... | ... |

## Import Organization

<detected import ordering rules, path conventions, barrel file usage>

## Code Structure

<paradigm, error handling, logging, validation patterns>

## API Conventions

<REST conventions, response format, error format>

## Test Conventions

<file placement, naming, assertion style, mocking approach>

## Git Conventions

<commit format, branch naming, merge strategy>

## Architecture Conventions

<layer boundaries, module organization, state management>

## Convention Violations

| Convention | Violation | Location | Severity | Blocks Completion | Recommended Action |
|---|---|---|---|---|---|
| ... | ... | ... | ... |
```

## Output: `.engineering-intelligence/memory/coding-patterns.md` (Enhanced)

Add a `## Conventions` section with only durable patterns that pass the durability check: "Will this convention still be relevant after 10+ more changes?"

## Quality Gates

- [ ] At least 20 source files sampled across different modules
- [ ] Naming convention detection covers files, variables, functions, and types
- [ ] Import organization patterns are documented with examples
- [ ] Test patterns include file placement and assertion style
- [ ] Git conventions are extracted from actual git history (not assumed)
- [ ] Each convention has an adherence rate and evidence citation
- [ ] Exceptions to conventions are listed (not hidden)
- [ ] Convention violations include severity and blocking decision
- [ ] `knowledge-base/16-conventions.md` exists and follows the output format
- [ ] `coding-patterns.md` is enhanced with a Conventions section
- [ ] Only patterns with >70% adherence are classified as conventions

## Cross-References

- Depends on: `codebase-discovery-engine` (tech stack context)
- Used by: `initialize-intelligence-skill`, `engineering-intelligence-skill`
- Feeds into: `knowledge-base/16-conventions.md`, `.engineering-intelligence/memory/coding-patterns.md`
- Consumed by: `ongoing-learning-engine` (for convention drift detection)

This capability does not modify product code.
