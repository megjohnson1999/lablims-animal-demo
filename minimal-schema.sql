-- MINIMAL WORKING SCHEMA FOR RAILWAY DEPLOYMENT
-- This creates just the essential tables without the problematic INSERT statements

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (essential for login)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'researcher' CHECK (role IN ('admin', 'facility_manager', 'veterinarian', 'researcher', 'technician')),
  active BOOLEAN DEFAULT TRUE,
  force_password_change BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login TIMESTAMP NULL,
  password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System options table (simplified)
CREATE TABLE IF NOT EXISTS system_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  option_key VARCHAR(100) NOT NULL,
  option_value VARCHAR(255) NOT NULL,
  display_text VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animals table
CREATE TABLE IF NOT EXISTS animals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_number INTEGER UNIQUE,
  species VARCHAR(255) NOT NULL,
  strain VARCHAR(255),
  sex VARCHAR(10) DEFAULT 'Unknown' CHECK (sex IN ('M', 'F', 'Unknown')),
  birth_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deceased', 'transferred', 'retired')),
  availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN ('available', 'claimed', 'reserved', 'breeding', 'retired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal requests table
CREATE TABLE IF NOT EXISTS animal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number INTEGER UNIQUE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  justification TEXT NOT NULL,
  species VARCHAR(255) NOT NULL,
  strain VARCHAR(255),
  sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'any')),
  quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
  needed_by_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'partially_fulfilled', 'fulfilled', 'waitlisted', 'cancelled', 'denied')),
  quantity_allocated INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Housing table
CREATE TABLE IF NOT EXISTS housing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  housing_number VARCHAR(100),
  location VARCHAR(255) NOT NULL,
  capacity INTEGER,
  current_occupancy INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Essential indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_options_category_key ON system_options(category, option_key);
CREATE INDEX IF NOT EXISTS idx_animals_number ON animals(animal_number);
CREATE INDEX IF NOT EXISTS idx_animal_requests_requested_by ON animal_requests(requested_by);

-- Auto-increment functions (simplified)
CREATE OR REPLACE FUNCTION get_next_number(entity_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'animal' THEN
      SELECT COALESCE(MAX(animal_number), 0) + 1 INTO next_val FROM animals WHERE animal_number > 0;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Notifications table (required by frontend)
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

-- Experimental studies table (required by frontend)
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

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_experimental_studies_pi ON experimental_studies(principal_investigator);

-- Basic system options (minimal set)
INSERT INTO system_options (category, option_key, option_value, description) VALUES
('animal_species', 'mouse', 'Mus musculus', 'Laboratory mouse'),
('animal_species', 'rat', 'Rattus norvegicus', 'Laboratory rat')
ON CONFLICT (category, option_key) DO NOTHING;