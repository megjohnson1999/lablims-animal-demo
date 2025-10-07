const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/admin/apply-animal-requests-migration
 * Apply the animal requests database migration (admin only)
 */
router.post('/apply-animal-requests-migration', auth, roleCheck(['admin']), async (req, res) => {
  try {
    console.log('Starting animal requests migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '001_add_animal_requests.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await db.query(migrationSQL);

    console.log('Animal requests migration completed successfully');

    res.json({
      success: true,
      message: 'Animal requests migration applied successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/check-animal-requests-tables
 * Check if animal requests tables exist (admin only)
 */
router.get('/check-animal-requests-tables', auth, roleCheck(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('animal_requests', 'animal_request_allocations', 'animal_request_status_history', 'animal_request_notifications')
      ORDER BY table_name
    `);

    const existingTables = result.rows.map(row => row.table_name);
    const expectedTables = ['animal_requests', 'animal_request_allocations', 'animal_request_status_history', 'animal_request_notifications'];
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));

    res.json({
      expectedTables,
      existingTables,
      missingTables,
      allTablesExist: missingTables.length === 0
    });

  } catch (error) {
    console.error('Error checking tables:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/admin/apply-time-series-migration
 * Apply the time series measurements database migration (admin only)
 */
router.post('/apply-time-series-migration', auth, roleCheck(['admin', 'facility_manager']), async (req, res) => {
  try {
    console.log('Starting time series measurements migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', 'add_time_series_measurements.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await db.query(migrationSQL);

    console.log('Time series measurements migration completed successfully');

    res.json({
      success: true,
      message: 'Time series measurements migration applied successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Time series migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Time series measurements migration failed',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/check-time-series-tables
 * Check if time series measurement tables exist (admin only)
 */
router.get('/check-time-series-tables', auth, roleCheck(['admin', 'facility_manager']), async (req, res) => {
  try {
    // Check if the time series tables exist
    const tables = ['animal_measurements', 'measurement_schedules', 'measurement_types'];
    const results = {};

    for (const tableName of tables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `, [tableName]);
      results[tableName] = result.rows[0].exists;
    }

    // Check measurement types data
    if (results.measurement_types) {
      const countResult = await db.query('SELECT COUNT(*) as count FROM measurement_types');
      results.measurement_types_count = parseInt(countResult.rows[0].count);
    }

    const allTablesExist = tables.every(table => results[table]);

    res.json({
      tables: results,
      allTablesExist: allTablesExist,
      message: allTablesExist ?
        'All time series measurement tables exist' :
        'Some time series measurement tables are missing'
    });

  } catch (error) {
    console.error('Error checking time series tables:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/admin/apply-measurement-session-migration
 * Apply the measurement session support migration (admin only)
 */
router.post('/apply-measurement-session-migration', auth, roleCheck(['admin', 'facility_manager']), async (req, res) => {
  try {
    console.log('Starting measurement session support migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '002_add_measurement_session_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await db.query(migrationSQL);

    console.log('Measurement session support migration completed successfully');

    res.json({
      success: true,
      message: 'Measurement session support migration applied successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Measurement session migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Measurement session migration failed',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/check-measurement-session-support
 * Check if measurement session support is available (admin only)
 */
router.get('/check-measurement-session-support', auth, roleCheck(['admin']), async (req, res) => {
  try {
    // Check if the required views exist
    const views = ['recent_measurement_sessions', 'animals_with_measurement_context'];
    const results = {};

    for (const viewName of views) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.views
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `, [viewName]);
      results[viewName] = result.rows[0].exists;
    }

    // Check if specific indexes exist
    const indexes = [
      'idx_animal_measurements_study_date',
      'idx_animal_measurements_study_animal_date',
      'idx_animal_measurements_recent'
    ];

    for (const indexName of indexes) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes
          WHERE schemaname = 'public'
          AND indexname = $1
        );
      `, [indexName]);
      results[`${indexName}_exists`] = result.rows[0].exists;
    }

    const allViewsExist = views.every(view => results[view]);
    const allIndexesExist = indexes.every(index => results[`${index}_exists`]);

    res.json({
      views: results,
      allViewsExist,
      allIndexesExist,
      sessionSupportReady: allViewsExist && allIndexesExist,
      message: (allViewsExist && allIndexesExist) ?
        'Measurement session support is ready' :
        'Measurement session support migration needed'
    });

  } catch (error) {
    console.error('Error checking measurement session support:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;