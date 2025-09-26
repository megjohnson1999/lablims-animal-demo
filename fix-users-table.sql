-- Fix users table by adding missing columns needed for authentication

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing users to have default values
UPDATE users SET 
  failed_login_attempts = 0,
  locked_until = NULL,
  last_login = NULL,
  password_changed_at = CURRENT_TIMESTAMP
WHERE failed_login_attempts IS NULL 
   OR password_changed_at IS NULL;