-- Migration: Add Animal Management Phase 1
-- Date: 2025-01-11
-- Description: Adds core animal management tables for Phase 1 implementation

-- ================================================================================
-- PHASE 1: CORE ANIMAL MANAGEMENT TABLES
-- ================================================================================

-- Core animal records table
CREATE TABLE IF NOT EXISTS animals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_number INTEGER UNIQUE,
  species VARCHAR(100) NOT NULL,
  strain VARCHAR(100),
  sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'Unknown')),
  birth_date DATE,
  death_date DATE,
  source VARCHAR(255), -- Vendor, breeding, etc.
  genotype TEXT,
  housing_id UUID REFERENCES housing(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deceased', 'transferred', 'retired')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Housing/Cage management table  
CREATE TABLE IF NOT EXISTS housing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  housing_number INTEGER UNIQUE,
  location VARCHAR(100) NOT NULL, -- Room/facility
  cage_type VARCHAR(50),
  capacity INTEGER DEFAULT 1,
  current_occupancy INTEGER DEFAULT 0,
  environmental_conditions JSONB, -- Temperature, humidity, lighting
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'quarantine')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add animal linkage to existing specimens table
ALTER TABLE specimens ADD COLUMN IF NOT EXISTS animal_id UUID REFERENCES animals(id);
ALTER TABLE specimens ADD COLUMN IF NOT EXISTS collection_timepoint VARCHAR(100); -- Day 0, Week 2, etc.
ALTER TABLE specimens ADD COLUMN IF NOT EXISTS anatomical_site VARCHAR(100); -- Blood, tissue, urine, etc.

-- ================================================================================
-- SEQUENCES AND ID GENERATION
-- ================================================================================

-- Create sequences for auto-generated IDs
CREATE SEQUENCE IF NOT EXISTS animal_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS housing_number_seq START 1;

-- ID generation functions following existing pattern
CREATE OR REPLACE FUNCTION generate_animal_number() RETURNS INTEGER AS $$
BEGIN
    RETURN nextval('animal_number_seq');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_housing_number() RETURNS INTEGER AS $$
BEGIN
    RETURN nextval('housing_number_seq');
END;
$$ LANGUAGE plpgsql;

-- Auto-populate animal_number on insert (following existing pattern)
CREATE OR REPLACE FUNCTION set_animal_number() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.animal_number IS NULL THEN
        NEW.animal_number := generate_animal_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_animal_number
    BEFORE INSERT ON animals
    FOR EACH ROW EXECUTE FUNCTION set_animal_number();

-- Auto-populate housing_number on insert
CREATE OR REPLACE FUNCTION set_housing_number() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.housing_number IS NULL THEN
        NEW.housing_number := generate_housing_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_housing_number
    BEFORE INSERT ON housing
    FOR EACH ROW EXECUTE FUNCTION set_housing_number();

-- ================================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================================

-- Indexes for animals table
CREATE INDEX IF NOT EXISTS idx_animals_animal_number ON animals(animal_number);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);
CREATE INDEX IF NOT EXISTS idx_animals_housing_id ON animals(housing_id);

-- Indexes for housing table  
CREATE INDEX IF NOT EXISTS idx_housing_housing_number ON housing(housing_number);
CREATE INDEX IF NOT EXISTS idx_housing_location ON housing(location);
CREATE INDEX IF NOT EXISTS idx_housing_status ON housing(status);

-- Indexes for new specimen columns
CREATE INDEX IF NOT EXISTS idx_specimens_animal_id ON specimens(animal_id);
CREATE INDEX IF NOT EXISTS idx_specimens_timepoint ON specimens(collection_timepoint);

-- ================================================================================
-- UPDATE TRIGGERS FOR TIMESTAMP MANAGEMENT
-- ================================================================================

-- Update timestamp triggers (following existing pattern)
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_animals_updated_at
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_housing_updated_at
    BEFORE UPDATE ON housing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================================
-- SYSTEM OPTIONS FOR ANIMAL MODULE
-- ================================================================================

-- Add animal-specific system options (following existing pattern)
INSERT INTO system_options (category, option_key, option_value, display_order, is_active) VALUES
('animal_species', 'mouse', 'Mouse', 1, true),
('animal_species', 'rat', 'Rat', 2, true),
('animal_species', 'rabbit', 'Rabbit', 3, true),
('animal_species', 'guinea_pig', 'Guinea Pig', 4, true),
('animal_species', 'hamster', 'Hamster', 5, true),
('animal_species', 'other', 'Other', 6, true);

INSERT INTO system_options (category, option_key, option_value, display_order, is_active) VALUES
('animal_sex', 'M', 'M', 1, true),
('animal_sex', 'F', 'F', 2, true),
('animal_sex', 'unknown', 'Unknown', 3, true);

INSERT INTO system_options (category, option_key, option_value, display_order, is_active) VALUES
('animal_status', 'active', 'Active', 1, true),
('animal_status', 'deceased', 'Deceased', 2, true),
('animal_status', 'transferred', 'Transferred', 3, true),
('animal_status', 'retired', 'Retired', 4, true);

INSERT INTO system_options (category, option_key, option_value, display_order, is_active) VALUES
('cage_type', 'standard', 'Standard', 1, true),
('cage_type', 'breeding', 'Breeding', 2, true),
('cage_type', 'ivc', 'IVC', 3, true),
('cage_type', 'isolation', 'Isolation', 4, true);

INSERT INTO system_options (category, option_key, option_value, display_order, is_active) VALUES
('anatomical_site', 'blood', 'Blood', 1, true),
('anatomical_site', 'serum', 'Serum', 2, true),
('anatomical_site', 'plasma', 'Plasma', 3, true),
('anatomical_site', 'urine', 'Urine', 4, true),
('anatomical_site', 'feces', 'Feces', 5, true),
('anatomical_site', 'tissue', 'Tissue', 6, true),
('anatomical_site', 'saliva', 'Saliva', 7, true),
('anatomical_site', 'other', 'Other', 8, true);

-- ================================================================================
-- COMPLETION MESSAGE
-- ================================================================================

-- Migration completion log
INSERT INTO audit_log (table_name, action, record_id, changed_fields, user_id, timestamp)
VALUES ('system', 'migration', uuid_generate_v4(), 
        '{"migration": "add_animal_management_phase1", "status": "completed", "tables_added": ["animals", "housing"], "columns_added": {"specimens": ["animal_id", "collection_timepoint", "anatomical_site"]}}', 
        NULL, CURRENT_TIMESTAMP);