-- Extend minimal schema with missing tables that frontend needs
-- This is safe to run multiple times (uses IF NOT EXISTS)

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Experimental studies table (simplified version)  
CREATE TABLE IF NOT EXISTS experimental_studies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_number INTEGER UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  principal_investigator UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_experimental_studies_pi ON experimental_studies(principal_investigator);

-- Add some sample data
INSERT INTO notifications (user_id, title, message, type) 
SELECT id, 'Welcome to Animal LIMS', 'Your account has been set up successfully.', 'success'
FROM users WHERE username = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO experimental_studies (study_number, title, description, principal_investigator, status)
SELECT 1001, 'Sample Research Study', 'Example study for testing purposes', id, 'planning'
FROM users WHERE username = 'admin'
ON CONFLICT (study_number) DO NOTHING;