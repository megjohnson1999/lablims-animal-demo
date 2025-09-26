const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

async function resetLocalAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Reset admin password to a known value
    const newPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update admin user
    const result = await pool.query(`
      UPDATE users 
      SET password = $1, 
          failed_login_attempts = 0,
          locked_until = NULL,
          force_password_change = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE username = 'admin'
      RETURNING username, email, role
    `, [hashedPassword]);

    if (result.rows.length > 0) {
      console.log('✅ Admin password reset successfully!');
      console.log('User:', result.rows[0]);
      console.log('New credentials:');
      console.log('  Username: admin');
      console.log('  Password: admin123');
    } else {
      console.log('❌ Admin user not found');
    }

    // Also reset facility_mgr as backup
    const result2 = await pool.query(`
      UPDATE users 
      SET password = $1,
          failed_login_attempts = 0,
          locked_until = NULL,
          force_password_change = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE username = 'facility_mgr'
      RETURNING username, email, role
    `, [hashedPassword]);

    if (result2.rows.length > 0) {
      console.log('✅ Facility manager password also reset!');
      console.log('User:', result2.rows[0]);
      console.log('Backup credentials:');
      console.log('  Username: facility_mgr');
      console.log('  Password: admin123');
    }

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
  } finally {
    await pool.end();
  }
}

resetLocalAdmin();