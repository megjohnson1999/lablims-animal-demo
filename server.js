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

// Initialize database in production
async function initializeDatabase() {
  if (process.env.NODE_ENV === 'production') {
    try {
      const fs = require('fs');
      const schemaSQL = fs.readFileSync('./db/schema.sql', 'utf8');
      await pool.query(schemaSQL);
      logger.info('Core database schema applied successfully');
    } catch (error) {
      logger.error('Database schema error:', error);
      // Don't exit - let server start anyway for debugging
    }
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
      message: 'Pathogen Discovery Database API',
      dbConnection: 'Success',
      timestamp: dbRes.rows[0].now
    });
  } catch (err) {
    res.json({
      message: 'Pathogen Discovery Database API',
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

    await db.query(fixFunctions);
    
    const collaboratorNext = await db.query("SELECT get_next_number('collaborator') as next_id");
    const projectNext = await db.query("SELECT get_next_number('project') as next_id");
    
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
