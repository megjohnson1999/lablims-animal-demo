# Database Changes Workflow

## 🎯 Goal: Zero-Downtime Schema Evolution

We maintain **two paths** to the same database structure:
1. **Fresh installations** → `db/schema.sql`
2. **Existing databases** → `db/migrations/`

## 📋 Required Steps for ANY Database Change

### 1. Create Migration First
```bash
# Create new migration file with next number
cp db/migrations/001_add_animal_requests.sql db/migrations/002_your_changes.sql

# Edit the migration file with your changes
vim db/migrations/002_your_changes.sql
```

### 2. Update Core Schema
```bash
# Apply the SAME changes to schema.sql
vim db/schema.sql
```

### 3. Verify Consistency
```bash
# Both paths should result in identical database structure
# Migration should match what new installations get
```

### 4. Test Both Paths
```bash
# Test 1: Fresh installation
createdb test_fresh
psql test_fresh -f db/schema.sql

# Test 2: Migration path
createdb test_migration
psql test_migration -f db/schema.sql  # Apply base
node -e "
const MigrationRunner = require('./db/migrations/migration_runner');
const runner = new MigrationRunner('postgresql://localhost/test_migration');
runner.runAllPendingMigrations().then(() => runner.close());
"
```

## 🚫 Anti-Patterns (Don't Do This)

❌ **Schema-only changes** (breaks existing databases)
❌ **Migration-only changes** (breaks fresh installs)
❌ **Inconsistent migration vs schema** (divergent state)
❌ **Manual database changes** (not reproducible)

## ✅ Best Practices

✅ **Migration-first development** (create migration, then update schema)
✅ **Descriptive migration names** (`001_add_animal_requests.sql`)
✅ **Atomic migrations** (one logical change per migration)
✅ **Rollback planning** (know how to undo if needed)
✅ **Test both paths** (fresh install + migration)

## 🔧 Tools and Automation

- **Pre-commit hook** prevents schema-only commits
- **Migration runner** applies changes automatically
- **Checksum verification** prevents tampering
- **Transaction safety** (rollback on failure)

## 📊 Migration Naming Convention

```
001_add_animal_requests.sql
002_add_user_preferences.sql
003_modify_inventory_units.sql
004_add_sample_tracking.sql
```

## 🚨 Emergency Procedures

### If Migration Fails in Production
```bash
# 1. Check Railway logs for specific error
railway logs

# 2. Connect to database and investigate
railway connect

# 3. Manual intervention if needed (rare)
# Fix data issues, then retry migration
```

### If Schema Divergence Detected
```bash
# 1. Compare structures
pg_dump --schema-only fresh_db > fresh_schema.sql
pg_dump --schema-only migrated_db > migrated_schema.sql
diff fresh_schema.sql migrated_schema.sql

# 2. Fix divergence in next migration
# 3. Update documentation
```

## 🎓 Example: Adding a New Table

### Step 1: Create Migration
```sql
-- db/migrations/005_add_user_notifications.sql
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);
```

### Step 2: Update Schema
```sql
-- Add to db/schema.sql in appropriate section
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index in indexes section
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
```

### Step 3: Commit Both
```bash
git add db/migrations/005_add_user_notifications.sql
git add db/schema.sql
git commit -m "Add user notifications table

- Migration: 005_add_user_notifications.sql
- Updated core schema for fresh installations
- Both paths now create identical structure"
```

This workflow ensures **zero production surprises** and **consistent database state** across all environments.