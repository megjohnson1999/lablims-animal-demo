const { Pool } = require('pg');
const fs = require('fs');

async function deploySchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Reading schema file...');
    const schema = fs.readFileSync('./db/schema.sql', 'utf8');
    
    console.log('Applying schema to database...');
    await pool.query(schema);
    
    console.log('✅ Schema applied successfully!');
    
    // Test by checking for users table
    const result = await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users'");
    console.log('Users table exists:', result.rows[0].count > 0);
    
  } catch (error) {
    console.error('❌ Error applying schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

deploySchema();