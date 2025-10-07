const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/temp-demo-data/apply
 * Apply rich demo data (groups, assignments, measurements)
 * TEMPORARY ENDPOINT - Remove after use
 */
router.post('/apply', auth, roleCheck(['admin', 'facility_manager']), async (req, res) => {
  try {
    console.log('Loading rich demo data...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'rich-demo-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await pool.query(sql);

    console.log('Rich demo data applied successfully');

    res.json({
      success: true,
      message: 'Rich demo data with groups, assignments, and measurements applied successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to apply demo data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply demo data',
      error: error.message
    });
  }
});

/**
 * POST /api/temp-demo-data/complete-migration
 * Complete the animal requests migration (create missing tables)
 * TEMPORARY ENDPOINT - Remove after use
 */
router.post('/complete-migration', auth, roleCheck(['admin', 'facility_manager']), async (req, res) => {
  try {
    console.log('Completing animal requests migration...');

    // Read the completion SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'migrations', '002_complete_animal_requests.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await pool.query(sql);

    console.log('Migration completed successfully');

    res.json({
      success: true,
      message: 'Animal requests migration completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to complete migration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete migration',
      error: error.message
    });
  }
});

module.exports = router;
