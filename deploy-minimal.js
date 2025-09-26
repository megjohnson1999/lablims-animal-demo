const { Pool } = require('pg');
const fs = require('fs');

async function deployMinimalSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🚀 Deploying minimal schema...');
    const schema = fs.readFileSync('./minimal-schema.sql', 'utf8');
    
    await pool.query(schema);
    console.log('✅ Minimal schema deployed successfully!');
    
    // Test by checking for users table
    const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('📋 Created tables:', result.rows.map(r => r.table_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error deploying minimal schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  deployMinimalSchema();
}

module.exports = deployMinimalSchema;