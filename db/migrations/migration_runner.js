const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class MigrationRunner {
  constructor(databaseUrl) {
    this.db = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async ensureMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations(filename);
    `;

    await this.db.query(createTableSQL);
    console.log('✅ Migrations table ready');
  }

  async getAppliedMigrations() {
    const result = await this.db.query('SELECT filename, checksum FROM migrations ORDER BY id');
    return result.rows;
  }

  async getPendingMigrations() {
    const migrationsDir = path.join(__dirname);
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== 'migration_runner.js')
      .sort(); // Ensure consistent ordering

    const appliedMigrations = await this.getAppliedMigrations();
    const appliedFilenames = new Set(appliedMigrations.map(m => m.filename));

    const pendingMigrations = [];

    for (const filename of migrationFiles) {
      if (!appliedFilenames.has(filename)) {
        const filePath = path.join(migrationsDir, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        const checksum = this.calculateChecksum(content);

        pendingMigrations.push({
          filename,
          filePath,
          content,
          checksum
        });
      } else {
        // Verify checksum for applied migrations
        const appliedMigration = appliedMigrations.find(m => m.filename === filename);
        const filePath = path.join(migrationsDir, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        const currentChecksum = this.calculateChecksum(content);

        if (appliedMigration.checksum !== currentChecksum) {
          throw new Error(`Migration ${filename} has been modified after being applied! ` +
                         `This is dangerous and not allowed.`);
        }
      }
    }

    return pendingMigrations;
  }

  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async runMigration(migration) {
    console.log(`🔄 Running migration: ${migration.filename}`);

    try {
      // Start transaction
      await this.db.query('BEGIN');

      // Run the migration SQL
      await this.db.query(migration.content);

      // Record the migration as applied
      await this.db.query(
        'INSERT INTO migrations (filename, checksum) VALUES ($1, $2)',
        [migration.filename, migration.checksum]
      );

      // Commit transaction
      await this.db.query('COMMIT');

      console.log(`✅ Migration completed: ${migration.filename}`);

    } catch (error) {
      // Rollback on error
      await this.db.query('ROLLBACK');
      console.error(`❌ Migration failed: ${migration.filename}`);
      console.error(error.message);
      throw error;
    }
  }

  async runAllPendingMigrations() {
    console.log('🚀 Starting database migrations...');

    await this.ensureMigrationsTable();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📦 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    console.log('🎉 All migrations completed successfully');
  }

  async close() {
    await this.db.end();
  }
}

module.exports = MigrationRunner;