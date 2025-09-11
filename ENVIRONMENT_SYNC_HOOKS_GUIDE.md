# Environment Sync Hooks Guide

This guide explains the development hooks that help maintain consistency between database changes and the core schema file, ensuring anyone can deploy the Animal Research LIMS with a single command.

## Overview

The Animal Research LIMS uses a **single-command deployment** strategy where anyone who pulls from GitHub can set up the complete system by running:

```bash
psql -f db/schema.sql
```

This requires keeping `db/schema.sql` synchronized with all database changes made during development.

## Development Hooks

### Pre-commit Hook

**Purpose**: Reminds developers to update `db/schema.sql` when making database-related changes.

**Triggers when committing**:
- Route files that might contain database logic (`routes/`)
- Migration files (`db/migrations/`)
- Any files containing "schema" or "sql" in the name

**What it does**:
1. **Detects database-related changes** in your commit
2. **Shows a reminder checklist** of things to verify
3. **Warns if** `db/schema.sql` wasn't updated alongside database changes
4. **Allows override** for intentional exceptions

**Example output**:
```
⚠️  DATABASE-RELATED FILES DETECTED IN COMMIT:
routes/animals.js
db/migrations/add_animal_weights.sql

📋 REMINDER CHECKLIST:
┌─────────────────────────────────────────────────────────────────┐
│ □ Have you updated db/schema.sql with any new tables/columns?   │
│ □ Are all new tables included in the core schema?               │
│ □ Are all new indexes and triggers added to schema.sql?         │
│ □ Did you test that 'psql -f db/schema.sql' creates a working   │
│   database with all your changes?                               │
│ □ Are ID generation functions updated for new entities?         │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Automatic Installation
```bash
cd /path/to/animal-lims
./.githooks/install-hooks.sh
```

### Manual Installation
```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Usage

### Normal Development Flow

1. **Make database changes** (add routes, migrations, etc.)
2. **Update `db/schema.sql`** with your changes
3. **Test your schema**: `psql -f db/schema.sql` creates working database
4. **Commit as usual** - hook will verify and approve

### When Hook Triggers

If you commit database-related files without updating `db/schema.sql`:

1. **Hook shows warning** and checklist
2. **Choose your action**:
   - Type `no` → Abort commit, update schema first
   - Type `yes` → Continue (for intentional exceptions)

### Bypass Hook (if needed)
```bash
git commit --no-verify -m "Your commit message"
```

## Best Practices

### ✅ DO
- **Always update `db/schema.sql`** when adding new tables, columns, indexes, or functions
- **Test the schema** works standalone: `psql -f db/schema.sql`
- **Include all supporting elements**: indexes, triggers, functions, constraints
- **Update ID generation functions** when adding new entities

### ❌ DON'T
- Commit database changes without updating the core schema
- Rely only on migration files for new deployments
- Skip testing that fresh schema deployment works

## Schema Update Workflow

When making database changes:

1. **Develop your feature** with whatever approach works (migrations, direct changes)
2. **Update `db/schema.sql`** to include all your changes
3. **Test fresh deployment**:
   ```bash
   dropdb test_animal_lims
   createdb test_animal_lims
   psql test_animal_lims -f db/schema.sql
   # Verify all tables, functions, and data exist
   ```
4. **Commit everything together**

## Example Scenarios

### Adding New Animal Feature

```bash
# 1. You add animal_weights table via migration
psql -c "CREATE TABLE animal_weights (...)"

# 2. You update routes/animals.js with new endpoints
vim routes/animals.js

# 3. IMPORTANT: Update core schema
vim db/schema.sql  # Add the animal_weights table

# 4. Test fresh deployment works
psql fresh_test_db -f db/schema.sql

# 5. Commit - hook will approve since schema.sql was updated
git add .
git commit -m "Add animal weight tracking"
```

### Hook Catches Missing Schema Update

```bash
# 1. You modify routes/animals.js
git add routes/animals.js

# 2. You forgot to update db/schema.sql
git commit -m "Add weight endpoints"

# Hook output:
# ❌ WARNING: You're committing database changes but db/schema.sql
#    was not modified. This might break single-command deployment!
# Type 'yes' if you're sure this is intentional, or 'no' to abort:

# 3. Type 'no', update schema, then commit again
```

## Troubleshooting

### Hook Not Running
- **Check installation**: `ls -la .git/hooks/pre-commit`
- **Check permissions**: `chmod +x .git/hooks/pre-commit`
- **Reinstall**: `./.githooks/install-hooks.sh`

### False Positives
If the hook triggers incorrectly:
- **Override once**: `git commit --no-verify`
- **Report the issue** so we can improve the detection logic

### Schema Out of Sync
If you discover the schema is outdated:
1. **Create fresh database** from current codebase
2. **Export the schema**: `pg_dump -s > db/schema_new.sql`
3. **Compare and update** `db/schema.sql`
4. **Test the updated schema** works for fresh deployments

## Files

- `.githooks/pre-commit` - The pre-commit hook script
- `.githooks/install-hooks.sh` - Hook installation script
- `db/schema.sql` - Core database schema (keep this updated!)
- `db/migrations/` - Optional migration files (not used for fresh deployments)

---

This system ensures that the Animal Research LIMS maintains its **single-command deployment capability** while supporting active development. The hooks catch mistakes early and remind developers of the deployment requirements.