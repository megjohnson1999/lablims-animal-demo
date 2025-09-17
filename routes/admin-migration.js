const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/admin/apply-animal-requests-migration
 * Apply the animal requests database migration (admin only)
 */
router.post('/apply-animal-requests-migration', authenticateToken, requireRole(['admin']), async (req, res) => {
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
router.get('/check-animal-requests-tables', authenticateToken, requireRole(['admin']), async (req, res) => {
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

module.exports = router;