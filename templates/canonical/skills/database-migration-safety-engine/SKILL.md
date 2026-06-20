---
name: database-migration-safety-engine
description: Reviews database migrations for backward compatibility, rollback coverage, locks, destructive operations, and production-dangerous changes.
version: 1.0.0
---

# Database Migration Safety Engine

Use this skill whenever schemas, migrations, ORM models, data stores, indexes, or persistence contracts change.

## Procedure

1. **Detect Migration System**
   - Prisma, Drizzle, TypeORM, Sequelize, Alembic, Django migrations, Rails migrations, Flyway, Liquibase, Knex, raw SQL, Terraform-managed database resources.

2. **Classify Operations**
   - Additive: new nullable column, new table, additive index
   - Backward-compatible with caution: new non-null column with default, enum expansion, trigger change
   - Dangerous: column/table drop, rename without compatibility window, type narrowing, destructive data rewrite, full table lock, index without `CONCURRENTLY` for PostgreSQL production tables
   - Irreversible: data deletion, lossy transform, externalized state mutation

3. **Validate Rollback**
   - Check for a down migration or rollback equivalent.
   - Generate down migration stubs when missing, but mark them for human review.
   - Record irreversible steps explicitly.

4. **Check Zero-Downtime Safety**
   - Prefer expand/contract migrations.
   - Require deprecation windows for drops/renames.
   - Require online index creation where supported, such as PostgreSQL `CREATE INDEX CONCURRENTLY`.
   - Require explicit approval for production-dangerous operations.

5. **Map Query Impact**
   - Parse ORM model definitions and raw SQL strings.
   - Build or update a schema-to-query map.
   - Flag queries referencing changed columns/tables as directly impacted.

## Output

Write `.engineering-intelligence/aidlc/construction/<unit>/database-migration-safety.md`:

```markdown
# Database Migration Safety: <unit>

## Migration Files
- <path>

## Operation Classification
| Operation | Object | Classification | Risk | Evidence |
|---|---|---|---|---|

## Rollback / Down Migration
- Exists: <yes/no>
- Stub generated: <yes/no>
- Irreversible steps: <list or none>

## Schema-To-Query Impact
| Changed Schema Object | Query / ORM Usage | Impact | Evidence |
|---|---|---|---|

## Approval Required
- <dangerous operation requiring explicit approval>
```

## Blocking Conditions

- Missing down migration for medium-or-higher risk migration
- Drop/rename without deprecation window
- Full table lock risk not acknowledged
- Production-dangerous operation without explicit approval
- Changed column referenced by unupdated query

## Quality Gates

- [ ] Migration system was detected
- [ ] Operations were classified
- [ ] Down migration or rollback strategy exists
- [ ] Schema-to-query impacts are listed
- [ ] Explicit approval is recorded for dangerous operations
