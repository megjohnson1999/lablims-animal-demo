const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { Pool } = require('pg');
const logger = require('./utils/logger');
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { 
    missingVars: missingEnvVars,
    message: 'Please check your .env file and ensure these variables are set.'
  });
  process.exit(1);
}

// Initialize Express app
const app = express();

// Connect to PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database - apply time series migration if needed
async function initializeDatabase() {
  try {
    console.log('🚀 Database initialization - checking for time series tables...');

    // Check if measurement tables exist
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'animal_measurements'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📊 Time series tables missing - applying migration...');

      // Read and apply the migration
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, 'db', 'migrations', 'add_time_series_measurements.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      await pool.query(migrationSQL);

      console.log('✅ Time series measurement system migration applied successfully');
    } else {
      console.log('✅ Time series tables already exist - skipping migration');
    }

  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    // Don't fail startup if migration fails - just log it
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for large metadata uploads
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Health check endpoint for API testing
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({
      message: 'Animal Research LIMS API',
      dbConnection: 'Success',
      timestamp: dbRes.rows[0].now
    });
  } catch (err) {
    res.json({
      message: 'Animal Research LIMS API',
      dbConnection: 'Failed',
      error: err.message
    });
  }
});

// Fix ID generation functions to use MAX+1 approach (fixes duplicate ID issue)
app.post('/api/admin/fix-id-functions', async (req, res) => {
  try {
    const fixFunctions = `
      CREATE OR REPLACE FUNCTION get_next_number(entity_type VARCHAR)
      RETURNS INTEGER AS $$
      DECLARE next_val INTEGER;
      BEGIN
        CASE entity_type
          WHEN 'collaborator' THEN
            SELECT COALESCE(MAX(collaborator_number), 0) + 1 INTO next_val FROM collaborators WHERE collaborator_number > 0;
          WHEN 'project' THEN  
            SELECT COALESCE(MAX(project_number), 0) + 1 INTO next_val FROM projects WHERE project_number > 0;
          WHEN 'specimen' THEN
            SELECT COALESCE(MAX(specimen_number), 0) + 1 INTO next_val FROM specimens WHERE specimen_number > 0;
          WHEN 'patient' THEN
            SELECT COALESCE(MAX(patient_number), 0) + 1 INTO next_val FROM patients WHERE patient_number > 0;
          WHEN 'protocol' THEN
            SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
          WHEN 'inventory' THEN
            SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
          WHEN 'experiment' THEN
            SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
          ELSE RAISE EXCEPTION 'Invalid entity type: %', entity_type;
        END CASE;
        RETURN next_val;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION peek_next_number(entity_type VARCHAR)
      RETURNS INTEGER AS $$
      DECLARE next_val INTEGER;
      BEGIN
        CASE entity_type
          WHEN 'collaborator' THEN
            SELECT COALESCE(MAX(collaborator_number), 0) + 1 INTO next_val FROM collaborators WHERE collaborator_number > 0;
          WHEN 'project' THEN
            SELECT COALESCE(MAX(project_number), 0) + 1 INTO next_val FROM projects WHERE project_number > 0;
          WHEN 'specimen' THEN
            SELECT COALESCE(MAX(specimen_number), 0) + 1 INTO next_val FROM specimens WHERE specimen_number > 0;
          WHEN 'patient' THEN
            SELECT COALESCE(MAX(patient_number), 0) + 1 INTO next_val FROM patients WHERE patient_number > 0;
          WHEN 'protocol' THEN
            SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
          WHEN 'inventory' THEN
            SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
          WHEN 'experiment' THEN
            SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
          ELSE RAISE EXCEPTION 'Invalid entity type: %', entity_type;
        END CASE;
        RETURN next_val;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await pool.query(fixFunctions);
    
    const collaboratorNext = await pool.query("SELECT get_next_number('collaborator') as next_id");
    const projectNext = await pool.query("SELECT get_next_number('project') as next_id");
    
    res.json({
      success: true,
      message: 'ID functions fixed - now using MAX+1',
      results: {
        next_collaborator: collaboratorNext.rows[0].next_id,
        next_project: projectNext.rows[0].next_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint to fix schema INSERT issues (Railway-specific)
app.post('/api/admin/fix-schema-inserts', async (req, res) => {
  try {
    const fs = require('fs');
    const fixSQL = fs.readFileSync('./fix-schema-inserts.sql', 'utf8');
    await pool.query(fixSQL);
    
    res.json({
      success: true,
      message: 'Schema INSERT statements fixed successfully!'
    });
  } catch (error) {
    logger.error('Schema fix error:', error);
    res.status(500).json({
      success: false,
      message: 'Schema fix error',
      error: error.message
    });
  }
});

// Admin endpoint to reset and deploy full schema (clean slate)
app.post('/api/admin/reset-and-deploy', async (req, res) => {
  try {
    // Drop all tables to start fresh
    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    
    // Deploy core schema first (without problematic inserts)
    const fs = require('fs');
    let schemaSQL = fs.readFileSync('./db/schema.sql', 'utf8');
    
    // Remove the problematic INSERT statements that cause NULL violations
    schemaSQL = schemaSQL.replace(/INSERT INTO system_options \(category, option_key, option_value, display_text, description, is_active\) VALUES[\s\S]*?ON CONFLICT \(category, option_key\) DO NOTHING;/g, '-- Problematic inserts removed');
    
    await pool.query(schemaSQL);
    
    // Now apply the fixed inserts
    const fixSQL = fs.readFileSync('./fix-schema-inserts.sql', 'utf8');
    await pool.query(fixSQL);
    
    res.json({
      success: true,
      message: 'Database reset and full schema deployed successfully with fixes!'
    });
  } catch (error) {
    logger.error('Reset and deploy error:', error);
    res.status(500).json({
      success: false,
      message: 'Reset and deploy error',
      error: error.message
    });
  }
});

// Admin endpoint to deploy minimal working schema
app.post('/api/admin/deploy-minimal-schema', async (req, res) => {
  try {
    const fs = require('fs');
    const schemaSQL = fs.readFileSync('./minimal-schema.sql', 'utf8');
    await pool.query(schemaSQL);
    
    res.json({
      success: true,
      message: 'Minimal database schema deployed successfully!'
    });
  } catch (error) {
    logger.error('Minimal schema deployment error:', error);
    res.status(500).json({
      success: false,
      message: 'Minimal schema deployment error',
      error: error.message
    });
  }
});

// Admin endpoint to fix users table with missing columns
app.post('/api/admin/fix-users-table', async (req, res) => {
  try {
    const fs = require('fs');
    const fixSQL = fs.readFileSync('./fix-users-table.sql', 'utf8');
    await pool.query(fixSQL);
    
    res.json({
      success: true,
      message: 'Users table fixed successfully! Missing authentication columns added.'
    });
  } catch (error) {
    logger.error('Users table fix error:', error);
    res.status(500).json({
      success: false,
      message: 'Users table fix error',
      error: error.message
    });
  }
});

// Admin endpoint to deploy full schema using core schema.sql
app.post('/api/admin/deploy-schema', async (req, res) => {
  try {
    const fs = require('fs');
    const schemaSQL = fs.readFileSync('./db/schema.sql', 'utf8');
    await pool.query(schemaSQL);
    
    res.json({
      success: true,
      message: 'Core database schema deployed successfully!'
    });
  } catch (error) {
    logger.error('Schema deployment error:', error);
    res.status(500).json({
      success: false,
      message: 'Schema deployment error',
      error: error.message
    });
  }
});

// Admin endpoint to apply missing schema migration 
app.post('/api/admin/fix-missing-schema', async (req, res) => {
  try {
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./fix-missing-schema-simple.sql', 'utf8');
    await pool.query(migrationSQL);
    
    res.json({
      success: true,
      message: 'Missing schema elements fixed successfully! Housing and Biological Samples should now work.'
    });
  } catch (error) {
    logger.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration error',
      error: error.message
    });
  }
});

// Admin endpoint to apply new schema changes for animal claiming
app.post('/api/admin/apply-schema-changes', async (req, res) => {
  try {
    const fs = require('fs');
    const schemaChangesSQL = fs.readFileSync('./apply-schema-changes.sql', 'utf8');
    await pool.query(schemaChangesSQL);
    
    res.json({
      success: true,
      message: 'Schema changes applied successfully! Animal claiming system is ready.'
    });
  } catch (error) {
    logger.error('Schema changes error:', error);
    res.status(500).json({
      success: false,
      message: 'Schema changes error',
      error: error.message
    });
  }
});

// Admin endpoint to load sample data for development/testing
app.post('/api/admin/load-sample-data', async (req, res) => {
  try {
    const fs = require('fs');
    const sampleDataSQL = fs.readFileSync('./db/sample-data.sql', 'utf8');
    await pool.query(sampleDataSQL);
    
    res.json({
      success: true,
      message: 'Sample data loaded successfully! You now have test animals, users, housing, and studies.'
    });
  } catch (error) {
    logger.error('Sample data loading error:', error);
    res.status(500).json({
      success: false,
      message: 'Sample data loading error',
      error: error.message
    });
  }
});

// Admin endpoint to load minimal sample data for Railway
app.post('/api/admin/load-minimal-data', async (req, res) => {
  try {
    // Insert sample animals that work with minimal schema
    await pool.query(`
      INSERT INTO animals (animal_number, species, strain, sex, birth_date, status, availability_status) VALUES
      (1001, 'Mus musculus', 'C57BL/6J', 'M', '2024-08-01', 'active', 'available'),
      (1002, 'Mus musculus', 'C57BL/6J', 'F', '2024-08-01', 'active', 'available'),
      (1003, 'Mus musculus', 'BALB/c', 'M', '2024-08-15', 'active', 'available'),
      (1004, 'Mus musculus', 'BALB/c', 'F', '2024-08-15', 'active', 'available'),
      (1005, 'Rattus norvegicus', 'Wistar', 'M', '2024-07-20', 'active', 'available')
      ON CONFLICT (animal_number) DO NOTHING
    `);
    
    // Insert sample housing
    await pool.query(`
      INSERT INTO housing (housing_number, location, capacity, current_occupancy, status) VALUES
      ('R1-A1', 'Room 1, Rack A, Level 1', 5, 2, 'active'),
      ('R1-A2', 'Room 1, Rack A, Level 2', 5, 1, 'active'),
      ('R2-B1', 'Room 2, Rack B, Level 1', 10, 0, 'active')
      ON CONFLICT DO NOTHING
    `);
    
    // Add some basic system options
    await pool.query(`
      INSERT INTO system_options (category, option_key, option_value, description) VALUES
      ('animal_species', 'mouse', 'Mus musculus', 'Laboratory mouse'),
      ('animal_species', 'rat', 'Rattus norvegicus', 'Laboratory rat'),
      ('animal_strains', 'c57bl6j', 'C57BL/6J', 'Common inbred mouse strain'),
      ('animal_strains', 'balbc', 'BALB/c', 'Albino inbred mouse strain'),
      ('animal_strains', 'wistar', 'Wistar', 'Outbred rat strain')
      ON CONFLICT (category, option_key) DO NOTHING
    `);
    
    res.json({
      success: true,
      message: 'Minimal sample data loaded successfully! Added 5 animals and 3 housing units.'
    });
  } catch (error) {
    logger.error('Minimal sample data loading error:', error);
    res.status(500).json({
      success: false,
      message: 'Minimal sample data loading error',
      error: error.message
    });
  }
});

// Admin endpoint to load basic sample data (animals and housing only)
app.post('/api/admin/load-basic-sample-data', async (req, res) => {
  try {
    const fs = require('fs');
    const sampleDataSQL = fs.readFileSync('./load-basic-sample-data.sql', 'utf8');
    await pool.query(sampleDataSQL);
    
    res.json({
      success: true,
      message: 'Basic sample data loaded successfully! You now have test animals and housing.'
    });
  } catch (error) {
    logger.error('Basic sample data loading error:', error);
    res.status(500).json({
      success: false,
      message: 'Basic sample data loading error',
      error: error.message
    });
  }
});

// Debug endpoint to check users table (no auth required)
app.get('/api/admin/debug-users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, role, active, force_password_change, 
             failed_login_attempts, locked_until, 
             CASE WHEN password IS NOT NULL THEN 'has_password' ELSE 'no_password' END as password_status,
             created_at
      FROM users 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Working GET login endpoint (temporary workaround for Railway POST middleware issue)
app.get('/api/auth/alt-login', async (req, res) => {
  try {
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.json({ 
        success: false,
        message: 'Username and password required as query params',
        example: '/api/auth/alt-login?username=admin&password=yourpassword'
      });
    }
    
    // Get user from database (same logic as main login route)
    const userResult = await pool.query(`
      SELECT id, username, password, role, active, force_password_change,
             failed_login_attempts, locked_until, first_name, last_name, email
      FROM users 
      WHERE username = $1
    `, [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    
    // Check if account is active
    if (!user.active) {
      return res.status(400).json({ msg: 'Account is deactivated. Please contact your lab manager.' });
    }
    
    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const lockUntil = new Date(user.locked_until);
      const remainingMinutes = Math.ceil((lockUntil - new Date()) / 60000);
      return res.status(400).json({ 
        msg: `Account is locked due to multiple failed login attempts. Try again in ${remainingMinutes} minutes.` 
      });
    }
    
    // Verify password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Increment failed attempts (simplified)
      await pool.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1', 
        [user.id]
      );
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Success - reset failed attempts and create JWT
    await pool.query(`
      UPDATE users 
      SET failed_login_attempts = 0, 
          locked_until = NULL,
          last_login = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [user.id]);
    
    // Create JWT (same as main login route)
    const jwt = require('jsonwebtoken');
    const payload = {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        
        res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            force_password_change: user.force_password_change
          }
        });
      }
    );
    
  } catch (error) {
    logger.error('Alternative login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
});

// Debug endpoint to test password verification (no auth required)
app.post('/api/admin/debug-password', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const userResult = await pool.query(`
      SELECT id, username, password, role, active, force_password_change
      FROM users 
      WHERE username = $1
    `, [username]);
    
    if (userResult.rows.length === 0) {
      return res.json({
        success: false,
        message: 'User not found',
        username
      });
    }
    
    const user = userResult.rows[0];
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    
    res.json({
      success: true,
      user_found: true,
      password_match: isMatch,
      user_active: user.active,
      force_password_change: user.force_password_change,
      password_length: user.password.length,
      password_starts_with: user.password.substring(0, 7) + '...'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simple login test endpoint without JWT generation (bypass JWT issues)
app.post('/api/admin/test-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Get user from database
    const userResult = await pool.query(`
      SELECT id, username, password, role, active, force_password_change,
             failed_login_attempts, locked_until
      FROM users 
      WHERE username = $1
    `, [username]);
    
    if (userResult.rows.length === 0) {
      return res.json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.json({
        success: false,
        message: 'Account is locked'
      });
    }
    
    // Verify password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Success - return user info (no JWT for this test)
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        active: user.active
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check available animals (no auth required)
app.get('/api/admin/debug-animals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id, a.animal_number, a.species, a.strain, a.availability_status, a.status,
        a.sex, a.birth_date, a.created_at
      FROM animals a
      WHERE a.availability_status = 'available' AND a.status = 'active'
      ORDER BY a.animal_number
      LIMIT 10
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      animals: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simplified animals endpoint that works with minimal schema (no auth for now)
app.get('/api/animals/simple', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, animal_number, species, strain, sex, birth_date,
        status, availability_status, created_at
      FROM animals 
      ORDER BY animal_number
      LIMIT 50
    `);
    
    res.json({
      success: true,
      animals: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Admin endpoint to create initial admin user
app.post('/api/admin/create-admin', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    
    // Check if any admin users already exist
    const existingAdmins = await pool.query(
      "SELECT id, username FROM users WHERE role = 'admin' OR role = 'facility_manager'"
    );

    if (existingAdmins.rows.length > 0) {
      return res.json({
        success: false,
        message: 'Admin users already exist',
        existingAdmins: existingAdmins.rows.map(admin => admin.username)
      });
    }

    // Generate secure password
    function generateSecurePassword() {
      const length = 16;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let password = '';
      
      password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
      password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      password += '0123456789'[Math.floor(Math.random() * 10)];
      password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
      
      for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
      }
      
      return password.split('').sort(() => 0.5 - Math.random()).join('');
    }

    const adminPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
    const generatedPassword = !process.env.ADMIN_PASSWORD;
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    // Insert admin user
    const result = await pool.query(`
      INSERT INTO users (
        username, email, password, first_name, last_name, role, 
        force_password_change, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, username, email, role
    `, [
      'admin', 
      'admin@lab.local', 
      hashedPassword, 
      'Lab', 
      'Administrator', 
      'facility_manager', 
      generatedPassword,
      true
    ]);
    
    res.json({
      success: true,
      message: 'Admin user created successfully',
      user: result.rows[0],
      credentials: {
        username: 'admin',
        password: adminPassword,
        forcePasswordChange: generatedPassword
      }
    });
    
  } catch (error) {
    logger.error('Admin creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin creation error',
      error: error.message
    });
  }
});

// Admin endpoint to run specific schema fixes
app.post('/api/admin/fix-missing-schema', async (req, res) => {
  try {
    const fs = require('fs');
    const fixSchemaSQL = fs.readFileSync('./fix-missing-schema.sql', 'utf8');
    await pool.query(fixSchemaSQL);
    
    res.json({
      success: true,
      message: 'Missing schema elements added successfully!'
    });
  } catch (error) {
    logger.error('Schema fix error:', error);
    res.status(500).json({
      success: false,
      message: 'Schema fix error',
      error: error.message
    });
  }
});

// Define routes - Streamlined for Animal Research LIMS
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// Core Animal Research LIMS sections
app.use('/api/animals', require('./routes/animals'));
app.use('/api/animal-claims', require('./routes/animalClaims'));
app.use('/api/animal-requests', require('./routes/animalRequests'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/measurements', require('./routes/measurements'));
app.use('/api/housing', require('./routes/housing'));
app.use('/api/studies', require('./routes/experimentalStudies')); // Unified studies (was experimental-studies)
app.use('/api/groups', require('./routes/experimentalGroups')); // Unified groups (was experimental-groups)
app.use('/api/specimens', require('./routes/specimens'));
app.use('/api/biological-samples', require('./routes/biologicalSamples')); // New research organism samples system
app.use('/api/samples', require('./routes/specimens')); // Animal research terminology
app.use('/api/procedures', require('./routes/protocols')); // Unified procedures (protocols part)
app.use('/api/protocols', require('./routes/protocols')); // Legacy alias for compatibility
app.use('/api/experiments', require('./routes/experiments')); // Part of procedures
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/labels', require('./routes/labels'));

// System functionality
app.use('/api/audit', require('./routes/audit'));
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/import'));
app.use('/api/admin', require('./routes/admin-migration'));
app.use('/api/unified-import', require('./routes/unifiedImport'));
app.use('/api/metadata', require('./routes/metadata'));
app.use('/api/system-options', require('./routes/systemOptions'));
app.use('/api/ids', require('./routes/ids'));
app.use('/api/errors', require('./routes/errors'));

// Legacy routes removed for streamlined animal research:
// - /api/collaborators (now handled within studies)
// - /api/projects (consolidated into /api/studies)
// - /api/templates (simplified system)
// - /api/import/comprehensive (consolidated)
// - /api/import/multi-file (consolidated)

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // Handle React routing - this MUST come after API routes
  app.get('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.url.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const buildPath = path.join(__dirname, 'client/build', 'index.html');
    try {
      res.sendFile(buildPath);
    } catch (error) {
      logger.error('Failed to serve React app:', error);
      res.status(500).send('Application temporarily unavailable');
    }
  });
}

// Error handling middleware
const { errorMiddleware } = require('./utils/errorHandler');
app.use(errorMiddleware);

// Set port
const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
  
  // Initialize database after server starts (non-blocking)
  initializeDatabase().catch(error => {
    logger.error('Database initialization failed during startup:', error);
  });
});

// Keep server alive
server.keepAliveTimeout = 61000;
server.headersTimeout = 65000;

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});
