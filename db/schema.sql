-- COMPLETE LIMS DATABASE SCHEMA
-- Generated from working database on 2025-08-13
-- This schema includes ALL functionality present in the working system
-- No additional migrations needed for fresh installations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================================
-- CORE ENTITY TABLES
-- ================================================================================

-- Users table for authentication with lab-specific roles and security features
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
  notification_preferences JSONB DEFAULT '{
    "email_notifications": true,
    "browser_notifications": true,
    "request_status_changes": true,
    "animal_assignments": true,
    "system_announcements": true
  }'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaborator table
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collaborator_number INTEGER UNIQUE,
  irb_id VARCHAR(50),
  pi_name VARCHAR(255) NOT NULL,
  pi_institute VARCHAR(255) NOT NULL,
  pi_email VARCHAR(255),
  pi_phone VARCHAR(50),
  pi_fax VARCHAR(50),
  internal_contact VARCHAR(255),
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_number INTEGER UNIQUE,
  collaborator_id UUID REFERENCES collaborators(id) ON DELETE CASCADE,
  disease VARCHAR(255),
  specimen_type VARCHAR(255),
  source VARCHAR(255),
  date_received DATE,
  feedback_date DATE,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_number INTEGER UNIQUE,
  external_id VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  date_of_birth VARCHAR(255),
  diagnosis VARCHAR(255),
  physician_first_name VARCHAR(255),
  physician_last_name VARCHAR(255),
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animals table for animal research LIMS
CREATE TABLE IF NOT EXISTS animals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_number INTEGER UNIQUE,
  species VARCHAR(255) NOT NULL,
  strain VARCHAR(255),
  sex VARCHAR(10) DEFAULT 'Unknown' CHECK (sex IN ('M', 'F', 'Unknown')),
  birth_date DATE,
  death_date DATE,
  source VARCHAR(255),
  genotype VARCHAR(500),
  housing_id UUID,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deceased', 'transferred', 'retired')),
  availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN ('available', 'claimed', 'reserved', 'breeding', 'retired')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Breeding information
  dam_id UUID REFERENCES animals(id),
  sire_id UUID REFERENCES animals(id),
  -- Additional tracking fields
  identification_method VARCHAR(50) DEFAULT 'ear_tag',
  identification_number VARCHAR(100),
  vendor VARCHAR(255),
  arrival_date DATE,
  -- Legacy identification fields (for compatibility)
  ear_tag VARCHAR(50),
  tattoo VARCHAR(50),
  microchip VARCHAR(50),
  vendor_lot VARCHAR(50),
  acquisition_date DATE
);

-- Animal weights table for tracking weight history
CREATE TABLE IF NOT EXISTS animal_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  weight_grams DECIMAL(8,2) NOT NULL,
  body_condition_score INTEGER CHECK (body_condition_score BETWEEN 1 AND 5),
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  measured_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal observations table for health monitoring
CREATE TABLE IF NOT EXISTS animal_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  observation_type VARCHAR(100) NOT NULL,
  finding VARCHAR(255) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT,
  action_taken TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observed_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Housing table for animal housing management
CREATE TABLE IF NOT EXISTS housing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  housing_number VARCHAR(100),
  location VARCHAR(255) NOT NULL,
  cage_type VARCHAR(100),
  capacity INTEGER,
  current_occupancy INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  environmental_conditions TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Experimental studies table
CREATE TABLE IF NOT EXISTS experimental_studies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_number INTEGER UNIQUE,
  study_name VARCHAR(255) NOT NULL,
  description TEXT,
  principal_investigator VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'paused', 'terminated')),
  study_type VARCHAR(100),
  objective TEXT,
  start_date DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  iacuc_protocol_number VARCHAR(100),
  species_required VARCHAR(255),
  total_animals_planned INTEGER,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Experimental groups table
CREATE TABLE IF NOT EXISTS experimental_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_number INTEGER UNIQUE,
  study_id UUID NOT NULL REFERENCES experimental_studies(id) ON DELETE CASCADE,
  group_name VARCHAR(255) NOT NULL,
  group_type VARCHAR(50) DEFAULT 'treatment' CHECK (group_type IN ('control', 'treatment', 'sham', 'baseline')),
  description TEXT,
  target_animal_count INTEGER,
  current_animal_count INTEGER DEFAULT 0,
  treatment_description TEXT,
  dosage_regimen TEXT,
  schedule_description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'active', 'completed', 'terminated')),
  randomization_method VARCHAR(100),
  inclusion_criteria TEXT,
  exclusion_criteria TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal group assignments table
CREATE TABLE IF NOT EXISTS animal_group_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES experimental_groups(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_by UUID REFERENCES users(id),
  randomization_number INTEGER,
  baseline_weight DECIMAL(8,2),
  baseline_age_days INTEGER,
  assignment_notes TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'completed', 'deceased')),
  withdrawal_date DATE,
  withdrawal_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(animal_id, group_id)
);

-- Group treatments/interventions tracking
CREATE TABLE IF NOT EXISTS group_treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES experimental_groups(id) ON DELETE CASCADE,
  treatment_name VARCHAR(255) NOT NULL,
  treatment_type VARCHAR(100),
  description TEXT,
  dosage VARCHAR(255),
  route VARCHAR(100),
  frequency VARCHAR(255),
  duration_days INTEGER,
  start_date DATE,
  end_date DATE,
  administered_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group measurements/data collection points
CREATE TABLE IF NOT EXISTS group_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES experimental_groups(id) ON DELETE CASCADE,
  measurement_name VARCHAR(255) NOT NULL,
  measurement_type VARCHAR(100),
  description TEXT,
  collection_schedule VARCHAR(255),
  measurement_units VARCHAR(50),
  normal_range_min DECIMAL(10,4),
  normal_range_max DECIMAL(10,4),
  methodology TEXT,
  equipment_used TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual animal measurements within groups
CREATE TABLE IF NOT EXISTS animal_group_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES animal_group_assignments(id) ON DELETE CASCADE,
  measurement_id UUID NOT NULL REFERENCES group_measurements(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  measurement_time TIME,
  value DECIMAL(12,4),
  text_value TEXT,
  measured_by VARCHAR(255),
  quality_flag VARCHAR(50) CHECK (quality_flag IN ('good', 'questionable', 'poor', 'excluded')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal claims table for researcher claiming system
CREATE TABLE IF NOT EXISTS animal_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  justification TEXT NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  approved_until DATE, -- Optional: automatic release date
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Specimen table with ALL functionality (updated for animal research)
CREATE TABLE IF NOT EXISTS specimens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  specimen_number INTEGER UNIQUE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  tube_id VARCHAR(255),
  extracted BOOLEAN DEFAULT FALSE,
  initial_quantity DECIMAL(10, 2),
  position_freezer VARCHAR(100),
  position_rack VARCHAR(100),
  position_box VARCHAR(100),
  position_dimension_one VARCHAR(10),
  position_dimension_two VARCHAR(10),
  activity_status VARCHAR(50),
  date_collected DATE,
  collection_category VARCHAR(255),
  extraction_method VARCHAR(255),
  -- Animal-specific specimen fields
  collection_timepoint VARCHAR(100),
  anatomical_site VARCHAR(255),
  -- Legacy human clinical fields (kept for compatibility but not used in UI)
  nucleated_cells TEXT,
  cell_numbers INTEGER,
  percentage_segs DECIMAL(5, 2),
  csf_protein DECIMAL(10, 2),
  csf_gluc DECIMAL(10, 2),
  used_up BOOLEAN DEFAULT FALSE,
  specimen_site VARCHAR(255),
  run_number VARCHAR(50),
  comments TEXT,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Protocols table for lab procedures
CREATE TABLE IF NOT EXISTS protocols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) DEFAULT '1.0',
  required_reagents JSONB DEFAULT '[]'::jsonb,
  basic_steps TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Protocol documents management
CREATE TABLE IF NOT EXISTS protocol_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id UUID REFERENCES protocols(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  category VARCHAR(100),
  description TEXT
);

-- AI Protocol extraction jobs
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id VARCHAR(255) UNIQUE NOT NULL,
  document_id UUID REFERENCES protocol_documents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  initiated_by UUID REFERENCES users(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  processing_time_ms BIGINT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extracted protocol data storage
CREATE TABLE IF NOT EXISTS extracted_protocol_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_job_id UUID REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  document_id UUID REFERENCES protocol_documents(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_metadata JSONB DEFAULT '{}'::jsonb,
  overall_confidence DECIMAL(5,2),
  manual_review_required BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  review_date TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================================
-- INVENTORY MANAGEMENT SYSTEM
-- ================================================================================

-- Inventory categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  default_unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id INTEGER UNIQUE, -- Nullable: only populated for LAB-xxx items without commercial barcodes
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, 
  description TEXT,
  supplier VARCHAR(255),
  catalog_number VARCHAR(100),
  current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_of_measure VARCHAR(50),
  lot_number VARCHAR(100),
  expiration_date DATE,
  storage_location VARCHAR(255),
  storage_conditions VARCHAR(255),
  minimum_stock_level DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2),
  barcode VARCHAR(255), -- Commercial barcode (UPC/EAN) or empty for lab-generated items
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transaction tracking
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  quantity_change DECIMAL(10,2) NOT NULL,
  quantity_after DECIMAL(10,2) NOT NULL,
  reason TEXT,
  performed_by UUID REFERENCES users(id),
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  experiment_id UUID,
  transaction_status VARCHAR(50) DEFAULT 'completed',
  transaction_unit VARCHAR(20)
);

-- ================================================================================
-- EXPERIMENT MANAGEMENT SYSTEM  
-- ================================================================================

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id INTEGER UNIQUE NOT NULL,
  protocol_id UUID REFERENCES protocols(id),
  user_id UUID REFERENCES users(id),
  date_performed DATE,
  status VARCHAR(50) DEFAULT 'planned',
  sample_ids JSONB DEFAULT '[]'::jsonb,
  actual_reagents_used JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================================
-- SYSTEM CONFIGURATION
-- ================================================================================

-- System configuration table (for dynamic dropdowns)
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

-- ================================================================================
-- AUDIT AND MIGRATION SUPPORT
-- ================================================================================

-- Audit table for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  changed_fields JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ID generation logging
CREATE TABLE IF NOT EXISTS id_generation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL,
  generated_id INTEGER NOT NULL,
  generated_by VARCHAR(255),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ================================================================================
-- SEQUENCES AND ID GENERATION
-- ================================================================================

-- Primary sequences for user-facing IDs
CREATE SEQUENCE IF NOT EXISTS collaborator_number_seq;
CREATE SEQUENCE IF NOT EXISTS project_number_seq; 
CREATE SEQUENCE IF NOT EXISTS specimen_number_seq;
CREATE SEQUENCE IF NOT EXISTS patient_number_seq;
CREATE SEQUENCE IF NOT EXISTS animal_number_seq;
CREATE SEQUENCE IF NOT EXISTS protocol_id_seq;
CREATE SEQUENCE IF NOT EXISTS inventory_id_seq;
CREATE SEQUENCE IF NOT EXISTS experiment_id_seq;
CREATE SEQUENCE IF NOT EXISTS study_number_seq;
CREATE SEQUENCE IF NOT EXISTS group_number_seq;


-- Initialize sequences to start from 1
SELECT setval('collaborator_number_seq', 1, false);
SELECT setval('project_number_seq', 1, false);
SELECT setval('specimen_number_seq', 1, false);
SELECT setval('patient_number_seq', 1, false);
SELECT setval('animal_number_seq', 1, false);
SELECT setval('protocol_id_seq', 1, false);
SELECT setval('inventory_id_seq', 1, false);
SELECT setval('experiment_id_seq', 1, false);
SELECT setval('study_number_seq', 1, false);
SELECT setval('group_number_seq', 1, false);

-- ================================================================================
-- CORE FUNCTIONS
-- ================================================================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Primary ID generation function
CREATE OR REPLACE FUNCTION get_next_number(entity_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
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
    WHEN 'animal' THEN
      SELECT COALESCE(MAX(animal_number), 0) + 1 INTO next_val FROM animals WHERE animal_number > 0;
    WHEN 'protocol' THEN
      SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
    WHEN 'inventory' THEN
      SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
    WHEN 'experiment' THEN
      SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
    WHEN 'study' THEN
      SELECT COALESCE(MAX(study_number), 0) + 1 INTO next_val FROM experimental_studies WHERE study_number > 0;
    WHEN 'group' THEN
      SELECT COALESCE(MAX(group_number), 0) + 1 INTO next_val FROM experimental_groups WHERE group_number > 0;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient, animal, protocol, inventory, experiment, study, group', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Peek at next number without consuming (same logic as get_next_number)
CREATE OR REPLACE FUNCTION peek_next_number(entity_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
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
    WHEN 'animal' THEN
      SELECT COALESCE(MAX(animal_number), 0) + 1 INTO next_val FROM animals WHERE animal_number > 0;
    WHEN 'protocol' THEN
      SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
    WHEN 'inventory' THEN
      SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
    WHEN 'experiment' THEN
      SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
    WHEN 'study' THEN
      SELECT COALESCE(MAX(study_number), 0) + 1 INTO next_val FROM experimental_studies WHERE study_number > 0;
    WHEN 'group' THEN
      SELECT COALESCE(MAX(group_number), 0) + 1 INTO next_val FROM experimental_groups WHERE group_number > 0;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient, animal, protocol, inventory, experiment, study, group', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;


-- Specimen metadata validation
CREATE OR REPLACE FUNCTION validate_specimen_metadata(metadata_input JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  IF jsonb_typeof(metadata_input) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM jsonb_each(metadata_input) AS j(key, value)
    WHERE jsonb_typeof(j.value) NOT IN ('string', 'number', 'boolean', 'null')
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- ================================================================================

-- Get low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE(
  inventory_id INTEGER,
  name VARCHAR(255),
  category VARCHAR(100),
  current_quantity DECIMAL(10,2),
  minimum_stock_level DECIMAL(10,2),
  unit_of_measure VARCHAR(50),
  barcode VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.inventory_id,
    i.name,
    i.category,
    i.current_quantity,
    i.minimum_stock_level,
    i.unit_of_measure,
    i.barcode
  FROM inventory i
  WHERE i.current_quantity <= i.minimum_stock_level
    AND i.minimum_stock_level > 0
  ORDER BY (i.current_quantity / NULLIF(i.minimum_stock_level, 0)) ASC;
END;
$$ LANGUAGE plpgsql;

-- Get expiring items
CREATE OR REPLACE FUNCTION get_expiring_items(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE(
  inventory_id INTEGER,
  name VARCHAR(255),
  category VARCHAR(100),
  expiration_date DATE,
  current_quantity DECIMAL(10,2),
  unit_of_measure VARCHAR(50),
  days_until_expiry INTEGER,
  barcode VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.inventory_id,
    i.name,
    i.category,
    i.expiration_date,
    i.current_quantity,
    i.unit_of_measure,
    (i.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    i.barcode
  FROM inventory i
  WHERE i.expiration_date IS NOT NULL
    AND i.expiration_date <= (CURRENT_DATE + INTERVAL '1 day' * days_ahead)
    AND i.expiration_date >= CURRENT_DATE
  ORDER BY i.expiration_date ASC;
END;
$$ LANGUAGE plpgsql;


-- ================================================================================
-- PROTOCOL EXTRACTION FUNCTIONS
-- ================================================================================

-- Generate unique extraction job ID
CREATE OR REPLACE FUNCTION generate_extraction_job_id()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'EXT_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS') || '_' || 
         LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Get extraction statistics
CREATE OR REPLACE FUNCTION get_extraction_statistics(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  total_extractions BIGINT,
  successful_extractions BIGINT, 
  failed_extractions BIGINT,
  average_confidence DECIMAL(5,2),
  average_processing_time_ms DECIMAL(10,2),
  review_required_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(ej.id) as total_extractions,
    COUNT(CASE WHEN ej.status = 'completed' THEN 1 END) as successful_extractions,
    COUNT(CASE WHEN ej.status = 'failed' THEN 1 END) as failed_extractions,
    ROUND(AVG(epd.overall_confidence), 2) as average_confidence,
    ROUND(AVG(ej.processing_time_ms::DECIMAL), 2) as average_processing_time_ms,
    COUNT(CASE WHEN epd.manual_review_required = true THEN 1 END) as review_required_count
  FROM extraction_jobs ej
  LEFT JOIN extracted_protocol_data epd ON ej.id = epd.extraction_job_id
  WHERE ej.started_at >= (CURRENT_DATE - INTERVAL '1 day' * days_back);
END;
$$ LANGUAGE plpgsql;

-- Cleanup old extraction data
CREATE OR REPLACE FUNCTION cleanup_old_extraction_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted_jobs AS (
    DELETE FROM extraction_jobs 
    WHERE status = 'failed' 
      AND started_at < (CURRENT_DATE - INTERVAL '1 day' * days_to_keep)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_jobs;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- INVENTORY RESERVATION FUNCTIONS (for experiments)
-- ================================================================================

-- Reserve inventory for experiment
CREATE OR REPLACE FUNCTION reserve_inventory_for_experiment(
  p_experiment_id UUID,
  p_inventory_items JSONB,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item JSONB;
  inventory_item RECORD;
  available_quantity DECIMAL(10,2);
  original_quantity DECIMAL(10,2);
  original_unit TEXT;
  converted_quantity DECIMAL(10,2);
  warnings JSONB := '[]'::JSONB;
  warning_msg TEXT;
  items_processed INTEGER := 0;
  items_reserved INTEGER := 0;
BEGIN
  -- Loop through each inventory item to reserve
  FOR item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    items_processed := items_processed + 1;
    
    -- Get current inventory item
    SELECT * INTO inventory_item 
    FROM inventory 
    WHERE id = (item->>'inventory_id')::UUID;
    
    IF NOT FOUND THEN
      -- Inventory item not found - assume it's an untracked reagent, skip silently
      warning_msg := format('Reagent not found in inventory (assuming untracked): %s', 
                           COALESCE(item->>'name', item->>'inventory_id'));
      warnings := warnings || jsonb_build_object(
        'type', 'untracked_reagent',
        'message', warning_msg,
        'item_id', item->>'inventory_id',
        'item_name', item->>'name'
      );
      CONTINUE;
    END IF;
    
    -- Get the original quantity and unit from the request
    original_quantity := (item->>'quantity')::DECIMAL;
    original_unit := item->>'unit';
    
    -- Convert quantity to inventory base unit if different
    IF original_unit = 'µL' OR original_unit = 'μL' OR original_unit = 'ul' THEN
      converted_quantity := original_quantity / 1000.0; -- Convert µL to mL
    ELSE
      converted_quantity := original_quantity; -- Already in base unit (mL)
    END IF;
    
    -- Check if enough quantity is available
    SELECT current_quantity INTO available_quantity
    FROM inventory
    WHERE id = inventory_item.id;
    
    IF available_quantity < converted_quantity THEN
      -- Insufficient inventory - create warning but continue
      warning_msg := format('Insufficient inventory for %s: Available %s mL, Required %s %s', 
                           inventory_item.name, available_quantity, original_quantity, original_unit);
      warnings := warnings || jsonb_build_object(
        'type', 'insufficient_quantity',
        'message', warning_msg,
        'item_name', inventory_item.name,
        'available', available_quantity,
        'required', original_quantity,
        'unit', original_unit
      );
      
      -- Reserve what's available if anything
      IF available_quantity > 0 THEN
        -- Create partial reservation transaction
        INSERT INTO inventory_transactions (
          inventory_id, 
          transaction_type, 
          quantity_change, 
          quantity_after, 
          reason, 
          performed_by, 
          experiment_id,
          transaction_status,
          transaction_unit
        ) VALUES (
          inventory_item.id,
          'out',
          -(available_quantity * 1000), -- Convert back to µL for display
          0,
          format('Partial reservation for experiment (required %s %s)', original_quantity, original_unit),
          p_user_id,
          p_experiment_id,
          'reserved',
          'µL'
        );
        
        -- Update inventory to zero
        UPDATE inventory 
        SET current_quantity = 0
        WHERE id = inventory_item.id;
        
        items_reserved := items_reserved + 1;
      END IF;
    ELSE
      -- Sufficient inventory - normal reservation
      INSERT INTO inventory_transactions (
        inventory_id, 
        transaction_type, 
        quantity_change, 
        quantity_after, 
        reason, 
        performed_by, 
        experiment_id,
        transaction_status,
        transaction_unit
      ) VALUES (
        inventory_item.id,
        'out',
        -(original_quantity),
        available_quantity - converted_quantity,
        'Used in experiment',
        p_user_id,
        p_experiment_id,
        'reserved',
        original_unit
      );
      
      -- Update inventory quantity (using converted amount for base unit)
      UPDATE inventory 
      SET current_quantity = current_quantity - converted_quantity
      WHERE id = inventory_item.id;
      
      items_reserved := items_reserved + 1;
    END IF;
  END LOOP;
  
  -- Return result with success status and warnings
  RETURN jsonb_build_object(
    'success', true,
    'items_processed', items_processed,
    'items_reserved', items_reserved,
    'warnings', warnings,
    'has_warnings', jsonb_array_length(warnings) > 0
  );
END;
$$ LANGUAGE plpgsql;

-- Cancel reserved inventory for experiment
CREATE OR REPLACE FUNCTION cancel_reserved_inventory(p_experiment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  reservation RECORD;
BEGIN
  FOR reservation IN 
    SELECT * FROM inventory_transactions
    WHERE experiment_id = p_experiment_id
      AND transaction_status = 'reserved'
  LOOP
    -- Return quantity to inventory
    UPDATE inventory
    SET current_quantity = current_quantity + ABS(reservation.quantity_change)
    WHERE id = reservation.inventory_id;
    
    -- Mark reservation as cancelled
    UPDATE inventory_transactions
    SET transaction_status = 'cancelled',
        reason = 'Cancelled reservation for experiment ' || p_experiment_id
    WHERE id = reservation.id;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Consume reserved inventory for experiment
CREATE OR REPLACE FUNCTION consume_reserved_inventory(p_experiment_id UUID, p_actual_usage JSONB DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  reservation RECORD;
BEGIN
  FOR reservation IN 
    SELECT * FROM inventory_transactions
    WHERE experiment_id = p_experiment_id
      AND transaction_status = 'reserved'
  LOOP
    -- Mark reservation as consumed
    UPDATE inventory_transactions
    SET transaction_status = 'consumed',
        reason = 'Used in experiment'
    WHERE id = reservation.id;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- METADATA FUNCTIONS  
-- ================================================================================

-- Get project metadata keys
CREATE OR REPLACE FUNCTION get_project_metadata_keys(project_id_param UUID)
RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT key ORDER BY key)
  INTO result
  FROM specimens s,
       jsonb_each_text(s.metadata) AS j(key, value)
  WHERE s.project_id = project_id_param
    AND s.metadata != '{}'::jsonb;
    
  RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- BIOLOGICAL SAMPLES SCHEMA - RESEARCH ORGANISM FOCUSED
-- Replaces the old "specimens" table with proper biological sample tracking
-- ================================================================================

-- Create biological_samples table optimized for research organism facilities
CREATE TABLE IF NOT EXISTS biological_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_number INTEGER UNIQUE,
  
  -- Core relationships
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
  
  -- Sample identification
  sample_barcode VARCHAR(100) UNIQUE,
  parent_sample_id UUID REFERENCES biological_samples(id), -- For aliquots/sub-samples
  
  -- Sample type and collection info
  sample_type VARCHAR(100) NOT NULL, -- blood, tissue, urine, serum, plasma, organ, etc.
  anatomical_site VARCHAR(255), -- liver, brain, heart, femur, etc.
  sample_description TEXT,
  
  -- Collection details
  collection_date TIMESTAMP NOT NULL,
  collection_method VARCHAR(255), -- necropsy, biopsy, blood draw, terminal bleed, etc.
  collected_by VARCHAR(255) NOT NULL,
  collection_protocol VARCHAR(255), -- reference to SOP
  
  -- Processing information
  processing_date TIMESTAMP,
  processing_method VARCHAR(255), -- fresh, frozen, fixed, paraffin-embedded, etc.
  preservation_method VARCHAR(100), -- -80°C, -20°C, 4°C, RT, formalin, etc.
  processed_by VARCHAR(255),
  
  -- Storage location
  storage_location VARCHAR(255), -- freezer/room identifier
  storage_container VARCHAR(100), -- rack, box, shelf
  storage_position VARCHAR(50), -- A1, position 1-12, etc.
  storage_temperature VARCHAR(20), -- -80°C, -20°C, 4°C, RT
  
  -- Sample quantity and quality
  initial_volume_ml DECIMAL(10, 3),
  current_volume_ml DECIMAL(10, 3),
  initial_weight_mg DECIMAL(10, 3),
  current_weight_mg DECIMAL(10, 3),
  concentration_mg_ml DECIMAL(10, 3),
  quality_score VARCHAR(50), -- excellent, good, fair, poor, degraded
  
  -- Sample status
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'depleted', 'contaminated', 'discarded')),
  is_aliquot BOOLEAN DEFAULT FALSE,
  number_of_aliquots INTEGER DEFAULT 0,
  
  -- Experimental context
  treatment_group VARCHAR(255), -- control, treatment A, etc.
  timepoint VARCHAR(100), -- baseline, 24h, 7d, terminal, etc.
  collection_order INTEGER, -- for serial collections
  
  -- Quality control
  contamination_check BOOLEAN DEFAULT FALSE,
  contamination_notes TEXT,
  integrity_check BOOLEAN DEFAULT FALSE,
  integrity_notes TEXT,
  
  -- Usage tracking
  times_thawed INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  accessed_by VARCHAR(255),
  
  -- Regulatory and compliance
  iacuc_protocol VARCHAR(100), -- IACUC protocol number
  collection_approved_by VARCHAR(255),
  disposal_date DATE,
  disposal_method VARCHAR(255),
  disposal_approved_by VARCHAR(255),
  
  -- Additional metadata (flexible JSON for specific research needs)
  metadata JSONB DEFAULT '{}' NOT NULL,
  
  -- System fields
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT valid_volumes CHECK (
    (initial_volume_ml IS NULL OR initial_volume_ml >= 0) AND 
    (current_volume_ml IS NULL OR current_volume_ml >= 0) AND
    (current_volume_ml IS NULL OR initial_volume_ml IS NULL OR current_volume_ml <= initial_volume_ml)
  ),
  CONSTRAINT valid_weights CHECK (
    (initial_weight_mg IS NULL OR initial_weight_mg >= 0) AND 
    (current_weight_mg IS NULL OR current_weight_mg >= 0) AND
    (current_weight_mg IS NULL OR initial_weight_mg IS NULL OR current_weight_mg <= initial_weight_mg)
  )
);

-- Create sample aliquots table for tracking sub-samples
CREATE TABLE IF NOT EXISTS sample_aliquots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  aliquot_sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  aliquot_number INTEGER NOT NULL,
  volume_transferred_ml DECIMAL(10, 3),
  weight_transferred_mg DECIMAL(10, 3),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  purpose VARCHAR(255), -- analysis, storage, sharing, etc.
  
  UNIQUE(parent_sample_id, aliquot_number)
);

-- Sample usage/analysis tracking
CREATE TABLE IF NOT EXISTS sample_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  usage_date TIMESTAMP NOT NULL,
  used_by VARCHAR(255) NOT NULL,
  analysis_type VARCHAR(255), -- RNA extraction, histology, PCR, etc.
  volume_used_ml DECIMAL(10, 3),
  weight_used_mg DECIMAL(10, 3),
  purpose TEXT,
  results_location TEXT, -- file path, lab notebook reference, etc.
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample chain of custody for regulatory compliance
CREATE TABLE IF NOT EXISTS sample_chain_of_custody (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  event_date TIMESTAMP NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- collected, transferred, analyzed, stored, disposed
  from_person VARCHAR(255),
  to_person VARCHAR(255),
  location VARCHAR(255),
  purpose TEXT,
  signature VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================================
-- TRIGGERS
-- ================================================================================

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_collaborator_timestamp BEFORE UPDATE ON collaborators FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_project_timestamp BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_patient_timestamp BEFORE UPDATE ON patients FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_specimen_timestamp BEFORE UPDATE ON specimens FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_user_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_protocol_timestamp BEFORE UPDATE ON protocols FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_inventory_timestamp BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_experiments_timestamp BEFORE UPDATE ON experiments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_system_options_timestamp BEFORE UPDATE ON system_options FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_animals_timestamp BEFORE UPDATE ON animals FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_housing_timestamp BEFORE UPDATE ON housing FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_experimental_studies_timestamp BEFORE UPDATE ON experimental_studies FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_experimental_groups_timestamp BEFORE UPDATE ON experimental_groups FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_animal_group_assignments_timestamp BEFORE UPDATE ON animal_group_assignments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Biological samples triggers
CREATE TRIGGER update_biological_samples_timestamp BEFORE UPDATE ON biological_samples FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Auto-generate sample numbers
CREATE OR REPLACE FUNCTION generate_sample_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sample_number IS NULL THEN
    SELECT COALESCE(MAX(sample_number), 0) + 1 INTO NEW.sample_number FROM biological_samples;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_sample_number_trigger
  BEFORE INSERT ON biological_samples
  FOR EACH ROW
  EXECUTE FUNCTION generate_sample_number();

-- Update current volume/weight when creating usage records
CREATE OR REPLACE FUNCTION update_sample_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the current volume and weight after usage
  UPDATE biological_samples 
  SET 
    current_volume_ml = CASE 
      WHEN current_volume_ml IS NOT NULL AND NEW.volume_used_ml IS NOT NULL 
      THEN GREATEST(0, current_volume_ml - NEW.volume_used_ml)
      ELSE current_volume_ml 
    END,
    current_weight_mg = CASE 
      WHEN current_weight_mg IS NOT NULL AND NEW.weight_used_mg IS NOT NULL 
      THEN GREATEST(0, current_weight_mg - NEW.weight_used_mg)
      ELSE current_weight_mg 
    END,
    last_accessed = NEW.usage_date,
    accessed_by = NEW.used_by,
    status = CASE 
      WHEN (
        (current_volume_ml IS NOT NULL AND current_volume_ml - COALESCE(NEW.volume_used_ml, 0) <= 0) OR
        (current_weight_mg IS NOT NULL AND current_weight_mg - COALESCE(NEW.weight_used_mg, 0) <= 0)
      ) THEN 'depleted'
      ELSE status
    END
  WHERE id = NEW.sample_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sample_quantities_trigger
  AFTER INSERT ON sample_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_sample_quantities();

-- Metadata change logging function
CREATE OR REPLACE FUNCTION log_specimen_metadata_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.metadata IS DISTINCT FROM NEW.metadata THEN
    INSERT INTO audit_log (
      user_id, 
      action, 
      table_name, 
      record_id, 
      changed_fields
    ) VALUES (
      NULL,  -- Use NULL for system-triggered changes
      'UPDATE_METADATA',
      'specimens',
      NEW.id,
      jsonb_build_object(
        'old_metadata', OLD.metadata,
        'new_metadata', NEW.metadata
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Metadata change trigger
CREATE TRIGGER log_specimen_metadata_changes 
  AFTER UPDATE ON specimens 
  FOR EACH ROW 
  EXECUTE FUNCTION log_specimen_metadata_changes();

-- ================================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================================

-- Core entity indexes
CREATE INDEX IF NOT EXISTS idx_collaborators_number ON collaborators(collaborator_number);
CREATE INDEX IF NOT EXISTS idx_projects_number ON projects(project_number);
CREATE INDEX IF NOT EXISTS idx_specimens_number ON specimens(specimen_number);
CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_animals_number ON animals(animal_number);
CREATE INDEX IF NOT EXISTS idx_protocols_id ON protocols(protocol_id);
CREATE INDEX IF NOT EXISTS idx_experimental_studies_number ON experimental_studies(study_number);
CREATE INDEX IF NOT EXISTS idx_experimental_groups_number ON experimental_groups(group_number);

-- Metadata and JSON indexes
CREATE INDEX IF NOT EXISTS idx_specimens_metadata_gin ON specimens USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_protocols_required_reagents_gin ON protocols USING GIN (required_reagents);
CREATE INDEX IF NOT EXISTS idx_experiments_sample_ids_gin ON experiments USING GIN (sample_ids);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_id ON inventory(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_expiration ON inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id ON inventory_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_experiment_id ON inventory_transactions(experiment_id);

-- Protocol extraction indexes
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_job_id ON extraction_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_document_id ON extraction_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_protocol_data_job_id ON extracted_protocol_data(extraction_job_id);
CREATE INDEX IF NOT EXISTS idx_protocol_documents_category ON protocol_documents(category);

-- System configuration indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_options_category_value ON system_options(category, option_value);
CREATE INDEX IF NOT EXISTS idx_system_options_category_active ON system_options(category, is_active);

-- Performance optimization indexes for search functionality
-- Critical foreign key indexes for JOIN performance
CREATE INDEX IF NOT EXISTS idx_specimens_project_id ON specimens(project_id);
CREATE INDEX IF NOT EXISTS idx_specimens_patient_id ON specimens(patient_id);
CREATE INDEX IF NOT EXISTS idx_specimens_animal_id ON specimens(animal_id);
CREATE INDEX IF NOT EXISTS idx_projects_collaborator_id ON projects(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_animals_housing_id ON animals(housing_id);
CREATE INDEX IF NOT EXISTS idx_animals_dam_id ON animals(dam_id);
CREATE INDEX IF NOT EXISTS idx_animals_sire_id ON animals(sire_id);
CREATE INDEX IF NOT EXISTS idx_animal_weights_animal_id ON animal_weights(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_observations_animal_id ON animal_observations(animal_id);
-- Experimental group indexes
CREATE INDEX IF NOT EXISTS idx_experimental_groups_study_id ON experimental_groups(study_id);
CREATE INDEX IF NOT EXISTS idx_animal_group_assignments_animal_id ON animal_group_assignments(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_group_assignments_group_id ON animal_group_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_group_treatments_group_id ON group_treatments(group_id);
CREATE INDEX IF NOT EXISTS idx_group_measurements_group_id ON group_measurements(group_id);
CREATE INDEX IF NOT EXISTS idx_animal_group_measurements_assignment_id ON animal_group_measurements(assignment_id);
CREATE INDEX IF NOT EXISTS idx_animal_group_measurements_measurement_id ON animal_group_measurements(measurement_id);
CREATE INDEX IF NOT EXISTS idx_animal_claims_animal_id ON animal_claims(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_claims_requested_by ON animal_claims(requested_by);
CREATE INDEX IF NOT EXISTS idx_animal_claims_status ON animal_claims(status);
CREATE INDEX IF NOT EXISTS idx_animal_claims_study_id ON animal_claims(study_id);
CREATE INDEX IF NOT EXISTS idx_experimental_studies_created_by ON experimental_studies(created_by);

-- Search field indexes for WHERE clause performance
CREATE INDEX IF NOT EXISTS idx_projects_specimen_type ON projects(specimen_type);
CREATE INDEX IF NOT EXISTS idx_projects_disease ON projects(disease);
CREATE INDEX IF NOT EXISTS idx_specimens_tube_id ON specimens(tube_id);
CREATE INDEX IF NOT EXISTS idx_specimens_specimen_site ON specimens(specimen_site);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);
CREATE INDEX IF NOT EXISTS idx_animals_strain ON animals(strain);
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);
CREATE INDEX IF NOT EXISTS idx_animals_availability_status ON animals(availability_status);
CREATE INDEX IF NOT EXISTS idx_animals_sex ON animals(sex);
-- Experimental group search indexes
CREATE INDEX IF NOT EXISTS idx_experimental_studies_status ON experimental_studies(status);
CREATE INDEX IF NOT EXISTS idx_experimental_studies_species ON experimental_studies(species_required);
CREATE INDEX IF NOT EXISTS idx_experimental_studies_pi ON experimental_studies(principal_investigator);
CREATE INDEX IF NOT EXISTS idx_experimental_groups_status ON experimental_groups(status);
CREATE INDEX IF NOT EXISTS idx_experimental_groups_type ON experimental_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_animal_group_assignments_status ON animal_group_assignments(status);
CREATE INDEX IF NOT EXISTS idx_animal_group_assignments_date ON animal_group_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_group_treatments_dates ON group_treatments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_animal_group_measurements_date ON animal_group_measurements(measurement_date);

-- Composite indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_specimens_project_specimen_type ON specimens(project_id) INCLUDE (specimen_number);
CREATE INDEX IF NOT EXISTS idx_projects_collaborator_disease ON projects(collaborator_id, disease);

-- Additional performance indexes for filtering
CREATE INDEX IF NOT EXISTS idx_specimens_extracted ON specimens(extracted);
CREATE INDEX IF NOT EXISTS idx_specimens_used_up ON specimens(used_up);
CREATE INDEX IF NOT EXISTS idx_specimens_activity_status ON specimens(activity_status);

-- Position/location search indexes
CREATE INDEX IF NOT EXISTS idx_specimens_position_freezer ON specimens(position_freezer);
CREATE INDEX IF NOT EXISTS idx_specimens_position_rack ON specimens(position_rack);
CREATE INDEX IF NOT EXISTS idx_specimens_position_box ON specimens(position_box);

-- Sequencing search indexes (columns will be added in future sequencing module)
-- CREATE INDEX IF NOT EXISTS idx_specimens_sequencing_run_id ON specimens(sequencing_run_id);
-- CREATE INDEX IF NOT EXISTS idx_specimens_analysis_status ON specimens(analysis_status);

-- Date-based indexes for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_specimens_date_collected ON specimens(date_collected);
CREATE INDEX IF NOT EXISTS idx_projects_date_received ON projects(date_received);

-- Text search indexes (GIN for full-text search on text fields)
CREATE INDEX IF NOT EXISTS idx_specimens_comments_gin ON specimens USING GIN (to_tsvector('english', COALESCE(comments, '')));
CREATE INDEX IF NOT EXISTS idx_projects_comments_gin ON projects USING GIN (to_tsvector('english', COALESCE(comments, '')));


-- ================================================================================
-- CONSTRAINTS
-- ================================================================================

-- Metadata validation constraint
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_metadata_valid') THEN
    ALTER TABLE specimens ADD CONSTRAINT check_metadata_valid 
      CHECK (validate_specimen_metadata(metadata));
  END IF;
END $$;

-- Biological Samples indexes
CREATE INDEX IF NOT EXISTS idx_biological_samples_number ON biological_samples(sample_number);
CREATE INDEX IF NOT EXISTS idx_biological_samples_barcode ON biological_samples(sample_barcode);
CREATE INDEX IF NOT EXISTS idx_biological_samples_animal_id ON biological_samples(animal_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_study_id ON biological_samples(study_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_protocol_id ON biological_samples(protocol_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_parent_id ON biological_samples(parent_sample_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_type ON biological_samples(sample_type);
CREATE INDEX IF NOT EXISTS idx_biological_samples_anatomical_site ON biological_samples(anatomical_site);
CREATE INDEX IF NOT EXISTS idx_biological_samples_status ON biological_samples(status);
CREATE INDEX IF NOT EXISTS idx_biological_samples_collection_date ON biological_samples(collection_date);
CREATE INDEX IF NOT EXISTS idx_biological_samples_storage_location ON biological_samples(storage_location);
CREATE INDEX IF NOT EXISTS idx_biological_samples_treatment_group ON biological_samples(treatment_group);
CREATE INDEX IF NOT EXISTS idx_biological_samples_timepoint ON biological_samples(timepoint);
CREATE INDEX IF NOT EXISTS idx_biological_samples_animal_type ON biological_samples(animal_id, sample_type);
CREATE INDEX IF NOT EXISTS idx_biological_samples_study_timepoint ON biological_samples(study_id, timepoint);
CREATE INDEX IF NOT EXISTS idx_biological_samples_storage ON biological_samples(storage_location, storage_container, storage_position);
CREATE INDEX IF NOT EXISTS idx_biological_samples_metadata_gin ON biological_samples USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_sample_aliquots_parent ON sample_aliquots(parent_sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_aliquots_aliquot ON sample_aliquots(aliquot_sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_usage_sample_id ON sample_usage(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_usage_date ON sample_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_sample_custody_sample_id ON sample_chain_of_custody(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_custody_date ON sample_chain_of_custody(event_date);

-- ================================================================================
-- VIEWS
-- ================================================================================

-- Experiments with details view for easier querying
CREATE OR REPLACE VIEW experiments_with_details AS
SELECT 
  e.id,
  e.experiment_id,
  e.protocol_id,
  e.user_id,
  e.date_performed,
  e.status,
  e.sample_ids,
  e.actual_reagents_used,
  e.notes,
  e.created_at,
  e.updated_at,
  p.name AS protocol_name,
  p.description AS protocol_description,
  p.version AS protocol_version,
  u.username AS performed_by_username,
  u.first_name AS performed_by_first_name,
  u.last_name AS performed_by_last_name,
  jsonb_array_length(e.sample_ids) AS sample_count
FROM experiments e
LEFT JOIN protocols p ON e.protocol_id = p.id
LEFT JOIN users u ON e.user_id = u.id;

-- ================================================================================
-- DEFAULT DATA
-- ================================================================================

-- Create default "Unknown" entities for migration import fallbacks
INSERT INTO collaborators (
  collaborator_number, irb_id, pi_name, pi_institute, pi_email, 
  pi_phone, pi_fax, internal_contact, comments, created_at, updated_at
) VALUES (
  0, 
  'UNKNOWN-IRB', 
  'Unknown PI', 
  'Unknown Institution', 
  'unknown@unknown.org',
  '000-000-0000',
  '000-000-0000', 
  'Auto-created for projects with missing collaborator references',
  'Automatically created during database setup for migration imports with missing or invalid collaborator references',
  NOW(), 
  NOW()
) ON CONFLICT (collaborator_number) DO NOTHING;

INSERT INTO projects (
  project_number, collaborator_id, disease, specimen_type, source, 
  date_received, feedback_date, comments, created_at, updated_at
) VALUES (
  0,
  (SELECT id FROM collaborators WHERE collaborator_number = 0),
  'Unknown Disease',
  'Unknown Type', 
  'Unknown Source',
  NOW(),
  NULL,
  'Automatically created during database setup for migration imports with missing or invalid project references',
  NOW(),
  NOW()
) ON CONFLICT (project_number) DO NOTHING;

-- Default system configuration data
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
('activity_status', 'active', 'Active', 1, 'Specimen is active and available for use'),
('activity_status', 'inactive', 'Inactive', 2, 'Specimen is inactive but preserved'),
('activity_status', 'qc_failed', 'QC Failed', 3, 'Specimen failed quality control'),
('activity_status', 'consumed', 'Consumed', 4, 'Specimen has been fully consumed'),
('activity_status', 'archived', 'Archived', 5, 'Specimen is archived for long-term storage'),

('collection_category', 'clinical', 'Clinical Sample', 1, 'Sample collected for clinical purposes'),
('collection_category', 'research', 'Research Sample', 2, 'Sample collected for research purposes'), 
('collection_category', 'reference', 'Reference Sample', 3, 'Standard or reference sample'),
('collection_category', 'control', 'Control Sample', 4, 'Quality control or test sample'),

('specimen_site', 'blood', 'Blood', 1, 'Blood specimen'),
('specimen_site', 'serum', 'Serum', 2, 'Serum specimen'),
('specimen_site', 'plasma', 'Plasma', 3, 'Plasma specimen'),
('specimen_site', 'csf', 'Cerebrospinal Fluid', 4, 'CSF specimen'),
('specimen_site', 'urine', 'Urine', 5, 'Urine specimen'),
('specimen_site', 'tissue', 'Tissue', 6, 'Tissue specimen'),
('specimen_site', 'swab', 'Swab', 7, 'Swab specimen'),

('inventory_category', 'reagents', 'Reagents', 1, 'Chemical reagents and solutions'),
('inventory_category', 'consumables', 'Consumables', 2, 'Disposable lab supplies'),
('inventory_category', 'equipment', 'Equipment', 3, 'Lab equipment and instruments'),
('inventory_category', 'kits', 'Kits', 4, 'Commercial assay and extraction kits'),

('experiment_status', 'planned', 'Planned', 1, 'Experiment is planned but not started'),
('experiment_status', 'in_progress', 'In Progress', 2, 'Experiment is currently running'),
('experiment_status', 'completed', 'Completed', 3, 'Experiment completed successfully'),
('experiment_status', 'failed', 'Failed', 4, 'Experiment failed or was terminated'),
('experiment_status', 'on_hold', 'On Hold', 5, 'Experiment temporarily paused')

ON CONFLICT (category, option_value) DO NOTHING;

-- Default inventory categories
INSERT INTO inventory_categories (category_name, description, default_unit) VALUES
  ('reagents', 'Buffers, salts, chemicals, solvents', 'mL'),
  ('enzymes', 'Restriction enzymes, polymerases, ligases, etc.', 'μL'),
  ('kits', 'PCR kits, extraction kits, cloning kits', 'pieces'),
  ('consumables', 'Tips, tubes, plates, petri dishes', 'pieces'),
  ('antibodies', 'Primary/secondary antibodies for Western blot, etc.', 'μL'),
  ('primers', 'PCR primers, sequencing primers', 'μL'),
  ('media', 'LB, agar, specialized growth media', 'mL'),
  ('other', 'Miscellaneous lab supplies', 'pieces')
ON CONFLICT (category_name) DO NOTHING;

-- ================================================================================
-- UNKNOWN ENTITIES FOR MIGRATION IMPORTS
-- ================================================================================

-- Create Unknown Collaborator (#0) for projects with missing collaborator references
INSERT INTO collaborators (
  collaborator_number, irb_id, pi_name, pi_institute, pi_email, 
  pi_phone, pi_fax, internal_contact, comments
) VALUES (
  0, 'UNKNOWN-IRB', 'Unknown PI', 'Unknown Institution', 'unknown@unknown.org',
  '000-000-0000', '000-000-0000', 'Unknown Contact', 
  'Default record for projects with missing or invalid collaborator references'
) ON CONFLICT (collaborator_number) DO NOTHING;

-- Create Unknown Project (#0) for specimens with missing project references
INSERT INTO projects (
  project_number, collaborator_id, disease, specimen_type, source,
  date_received, comments
) VALUES (
  0, (SELECT id FROM collaborators WHERE collaborator_number = 0), 
  'Unknown Disease', 'Unknown Type', 'Unknown Source',
  CURRENT_DATE, 'Default record for specimens with missing or invalid project references'
) ON CONFLICT (project_number) DO NOTHING;

-- Create Unknown Patient (#0) for specimens with missing patient references
INSERT INTO patients (
  patient_number, external_id, first_name, last_name, comments
) VALUES (
  0, 'UNKNOWN-PATIENT', 'Unknown', 'Patient',
  'Default record for specimens with missing or invalid patient references'
) ON CONFLICT (patient_number) DO NOTHING;

-- ================================================================================
-- BIOLOGICAL SAMPLES VIEWS
-- ================================================================================

-- Comprehensive sample view with animal and study information
CREATE OR REPLACE VIEW biological_samples_with_details AS
SELECT 
  bs.*,
  a.animal_number,
  a.species,
  a.strain,
  a.sex,
  a.birth_date,
  es.study_name,
  es.principal_investigator,
  u.username as created_by_username,
  -- Calculate age at collection
  CASE 
    WHEN a.birth_date IS NOT NULL 
    THEN EXTRACT(days FROM bs.collection_date - a.birth_date)
    ELSE NULL 
  END as age_at_collection_days,
  -- Storage summary
  CONCAT_WS(' / ', bs.storage_location, bs.storage_container, bs.storage_position) as full_storage_location,
  -- Volume/weight remaining percentages
  CASE 
    WHEN bs.initial_volume_ml > 0 
    THEN ROUND((bs.current_volume_ml / bs.initial_volume_ml * 100)::numeric, 1)
    ELSE NULL 
  END as volume_remaining_percent,
  CASE 
    WHEN bs.initial_weight_mg > 0 
    THEN ROUND((bs.current_weight_mg / bs.initial_weight_mg * 100)::numeric, 1)
    ELSE NULL 
  END as weight_remaining_percent
FROM biological_samples bs
LEFT JOIN animals a ON bs.animal_id = a.id
LEFT JOIN experimental_studies es ON bs.study_id = es.id  
LEFT JOIN users u ON bs.created_by = u.id;

-- Sample inventory summary view
CREATE OR REPLACE VIEW sample_inventory_summary AS
SELECT 
  sample_type,
  anatomical_site,
  COUNT(*) as total_samples,
  COUNT(CASE WHEN status = 'available' THEN 1 END) as available_samples,
  COUNT(CASE WHEN status = 'depleted' THEN 1 END) as depleted_samples,
  AVG(current_volume_ml) as avg_volume_ml,
  AVG(current_weight_mg) as avg_weight_mg,
  MIN(collection_date) as earliest_collection,
  MAX(collection_date) as latest_collection
FROM biological_samples
GROUP BY sample_type, anatomical_site
ORDER BY sample_type, anatomical_site;

-- ================================================================================
-- BIOLOGICAL SAMPLES REFERENCE DATA
-- ================================================================================

-- Insert common sample types for research organisms
INSERT INTO system_options (category, option_value, display_text, description, is_active) VALUES
('sample_type', 'blood_whole', 'Whole Blood', 'Fresh whole blood sample', true),
('sample_type', 'blood_serum', 'Serum', 'Blood serum after coagulation', true),
('sample_type', 'blood_plasma', 'Plasma', 'Blood plasma with anticoagulant', true),
('sample_type', 'tissue_liver', 'Liver Tissue', 'Liver tissue sample', true),
('sample_type', 'tissue_brain', 'Brain Tissue', 'Brain tissue sample', true),
('sample_type', 'tissue_heart', 'Heart Tissue', 'Heart tissue sample', true),
('sample_type', 'tissue_kidney', 'Kidney Tissue', 'Kidney tissue sample', true),
('sample_type', 'tissue_lung', 'Lung Tissue', 'Lung tissue sample', true),
('sample_type', 'tissue_spleen', 'Spleen Tissue', 'Spleen tissue sample', true),
('sample_type', 'tissue_muscle', 'Muscle Tissue', 'Skeletal muscle tissue', true),
('sample_type', 'tissue_fat', 'Adipose Tissue', 'Fat/adipose tissue', true),
('sample_type', 'bone', 'Bone', 'Bone sample', true),
('sample_type', 'bone_marrow', 'Bone Marrow', 'Bone marrow sample', true),
('sample_type', 'urine', 'Urine', 'Urine sample', true),
('sample_type', 'feces', 'Feces', 'Fecal sample', true),
('sample_type', 'tissue_other', 'Other Tissue', 'Other tissue type', true),
('sample_type', 'fluid_other', 'Other Fluid', 'Other body fluid', true) 
ON CONFLICT (category, option_value) DO NOTHING;

-- Insert collection methods
INSERT INTO system_options (category, option_value, display_text, description, is_active) VALUES
('collection_method', 'terminal_bleed', 'Terminal Bleed', 'Terminal blood collection at euthanasia', true),
('collection_method', 'serial_bleed', 'Serial Blood Draw', 'Non-terminal blood collection', true),
('collection_method', 'necropsy', 'Necropsy', 'Post-mortem tissue collection', true),
('collection_method', 'biopsy', 'Biopsy', 'Tissue biopsy from live animal', true),
('collection_method', 'natural_void', 'Natural Void', 'Naturally voided sample (urine/feces)', true),
('collection_method', 'cage_collection', 'Cage Collection', 'Sample collected from cage', true),
('collection_method', 'surgical', 'Surgical Collection', 'Surgically obtained sample', true)
ON CONFLICT (category, option_value) DO NOTHING;

-- Insert preservation methods
INSERT INTO system_options (category, option_value, display_text, description, is_active) VALUES
('preservation_method', 'fresh', 'Fresh', 'Fresh sample, no preservation', true),
('preservation_method', 'frozen_minus80', 'Frozen -80°C', 'Frozen at -80°C', true),
('preservation_method', 'frozen_minus20', 'Frozen -20°C', 'Frozen at -20°C', true),
('preservation_method', 'refrigerated', 'Refrigerated 4°C', 'Stored at 4°C', true),
('preservation_method', 'formalin_fixed', 'Formalin Fixed', '10% neutral buffered formalin', true),
('preservation_method', 'paraffin_embedded', 'Paraffin Embedded', 'Formalin fixed, paraffin embedded', true),
('preservation_method', 'rna_later', 'RNAlater', 'Preserved in RNAlater solution', true),
('preservation_method', 'snap_frozen', 'Snap Frozen', 'Snap frozen in liquid nitrogen', true)
ON CONFLICT (category, option_value) DO NOTHING;

-- ================================================================================
-- COMPLETION MESSAGE
-- ================================================================================

-- Add a comment to mark schema completion
COMMENT ON DATABASE animal_lims IS 'Complete LIMS database schema for animal research - includes all functionality from working system';-- ANIMAL REQUEST SYSTEM SCHEMA
-- Supports research-driven workflow where researchers specify needs rather than browsing available animals

-- ================================================================================
-- ANIMAL REQUESTS TABLES
-- ================================================================================

-- Main animal requests table - researchers specify what they need
CREATE TABLE IF NOT EXISTS animal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number INTEGER UNIQUE, -- Auto-generated request ID for tracking
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE SET NULL,

  -- REQUEST DETAILS
  title VARCHAR(255) NOT NULL, -- "Treatment group animals for cardio study"
  description TEXT, -- Detailed explanation of use
  justification TEXT NOT NULL, -- Why these specific animals are needed

  -- ANIMAL SPECIFICATIONS
  species VARCHAR(255) NOT NULL, -- Required species
  strain VARCHAR(255), -- Preferred strain (can be flexible)
  strain_alternatives TEXT[], -- Array of acceptable alternative strains
  sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'any')), -- Required sex or 'any'
  genotype VARCHAR(500), -- Required genotype
  genotype_alternatives TEXT[], -- Array of acceptable alternative genotypes

  -- QUANTITY AND AGE REQUIREMENTS
  quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
  min_age_days INTEGER, -- Minimum age in days
  max_age_days INTEGER, -- Maximum age in days
  age_flexibility BOOLEAN DEFAULT FALSE, -- Can accept slightly outside age range

  -- TIMELINE
  needed_by_date DATE NOT NULL, -- When animals are needed
  flexible_date BOOLEAN DEFAULT FALSE, -- Can accept later date if needed
  duration_days INTEGER, -- How long animals will be used (for planning)

  -- HOUSING PREFERENCES
  housing_requirements TEXT, -- Special housing needs
  group_housing BOOLEAN DEFAULT TRUE, -- Can animals be group housed

  -- REQUEST STATUS AND PROCESSING
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN (
    'submitted',    -- Initial submission
    'reviewing',    -- Being reviewed by facility manager
    'partially_fulfilled', -- Some but not all animals allocated
    'fulfilled',    -- All animals allocated
    'waitlisted',   -- No animals available, on waitlist
    'cancelled',    -- Cancelled by researcher
    'denied'        -- Denied by facility manager
  )),

  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- REVIEW AND APPROVAL
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- FULFILLMENT TRACKING
  quantity_allocated INTEGER DEFAULT 0, -- How many have been allocated
  quantity_received INTEGER DEFAULT 0, -- How many researcher has actually received
  fully_fulfilled_at TIMESTAMP, -- When request was completely fulfilled

  -- WAITLIST INFORMATION
  waitlist_position INTEGER, -- Position in waitlist for this animal type
  estimated_availability DATE, -- Facility manager's estimate of when available
  auto_fulfill BOOLEAN DEFAULT TRUE, -- Automatically fulfill when animals become available

  -- METADATA
  internal_notes TEXT, -- For facility manager notes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track individual animal allocations to requests
CREATE TABLE IF NOT EXISTS animal_request_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES animal_requests(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  allocated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- DELIVERY STATUS
  status VARCHAR(20) DEFAULT 'allocated' CHECK (status IN (
    'allocated',   -- Animal assigned to request
    'delivered',   -- Animal delivered to researcher
    'returned',    -- Animal returned to facility
    'cancelled'    -- Allocation cancelled
  )),

  delivered_at TIMESTAMP,
  returned_at TIMESTAMP,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one animal can only be allocated to one active request
  UNIQUE(animal_id, request_id)
);

-- Track request status changes for audit trail
CREATE TABLE IF NOT EXISTS animal_request_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES animal_requests(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_reason TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications/alerts for request updates
-- Modern comprehensive notifications system
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    related_request_id UUID REFERENCES animal_requests(id) ON DELETE CASCADE,
    action_url VARCHAR(500),
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ================================================================================
-- FUNCTIONS AND TRIGGERS
-- ================================================================================

-- Function to generate request numbers
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(request_number), 0) + 1 INTO next_number FROM animal_requests;
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request numbers
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL THEN
        NEW.request_number := generate_request_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_request_number ON animal_requests;
CREATE TRIGGER trigger_set_request_number
    BEFORE INSERT ON animal_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_request_number();

-- Function to update request quantities when allocations change
CREATE OR REPLACE FUNCTION update_request_quantities()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE animal_requests
        SET
            quantity_allocated = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = NEW.request_id
                AND status IN ('allocated', 'delivered')
            ),
            quantity_received = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = NEW.request_id
                AND status = 'delivered'
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.request_id;

        -- Update status if fully fulfilled
        UPDATE animal_requests
        SET
            status = 'fulfilled',
            fully_fulfilled_at = CURRENT_TIMESTAMP
        WHERE id = NEW.request_id
        AND quantity_allocated >= quantity_requested
        AND status != 'fulfilled';

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE animal_requests
        SET
            quantity_allocated = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = OLD.request_id
                AND status IN ('allocated', 'delivered')
            ),
            quantity_received = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = OLD.request_id
                AND status = 'delivered'
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.request_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_request_quantities ON animal_request_allocations;
CREATE TRIGGER trigger_update_request_quantities
    AFTER INSERT OR UPDATE OR DELETE ON animal_request_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_request_quantities();

-- Function to record status changes
CREATE OR REPLACE FUNCTION record_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO animal_request_status_history (
            request_id,
            previous_status,
            new_status,
            changed_by,
            change_reason
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.reviewed_by, -- Could be enhanced to track actual user making change
            'Status updated'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_status_change ON animal_requests;
CREATE TRIGGER trigger_record_status_change
    AFTER UPDATE ON animal_requests
    FOR EACH ROW
    EXECUTE FUNCTION record_status_change();

-- ================================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================================

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_animal_requests_requested_by ON animal_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_animal_requests_study_id ON animal_requests(study_id);
CREATE INDEX IF NOT EXISTS idx_animal_requests_status ON animal_requests(status);
CREATE INDEX IF NOT EXISTS idx_animal_requests_species_strain ON animal_requests(species, strain);
CREATE INDEX IF NOT EXISTS idx_animal_requests_needed_by_date ON animal_requests(needed_by_date);
CREATE INDEX IF NOT EXISTS idx_animal_requests_created_at ON animal_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_animal_request_allocations_request_id ON animal_request_allocations(request_id);
CREATE INDEX IF NOT EXISTS idx_animal_request_allocations_animal_id ON animal_request_allocations(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_request_allocations_status ON animal_request_allocations(status);

-- Notification indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_related_request ON notifications(related_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- ================================================================================
-- SAMPLE DATA FOR TESTING
-- ================================================================================

-- Sample animal requests (commented out for production)
/*
INSERT INTO animal_requests (
    requested_by,
    study_id,
    title,
    description,
    justification,
    species,
    strain,
    strain_alternatives,
    sex,
    quantity_requested,
    min_age_days,
    max_age_days,
    needed_by_date,
    priority
) VALUES
(
    (SELECT id FROM users WHERE username = 'researcher1' LIMIT 1),
    (SELECT id FROM experimental_studies WHERE study_name LIKE '%cardiac%' LIMIT 1),
    'Treatment Group - Cardiac Function Study',
    'Animals needed for the treatment arm of our cardiac function study examining the effects of exercise on heart rate variability.',
    'Required for IACUC protocol CF2024-001. These animals will receive experimental treatment and require specific age range for consistency with published protocols.',
    'Mus musculus',
    'C57BL/6J',
    ARRAY['C57BL/6NJ', 'C57BL/6JOlaHsd'],
    'M',
    15,
    56, -- 8 weeks
    84, -- 12 weeks
    CURRENT_DATE + INTERVAL '2 weeks',
    'normal'
);
*/

-- ================================================================================
-- TIME SERIES DATA TRACKING TABLES (Phase 3)
-- ================================================================================

-- Animal measurements for longitudinal data tracking
CREATE TABLE IF NOT EXISTS animal_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  measurement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  measurement_type VARCHAR(100) NOT NULL, -- weight, survival, tumor_size, body_condition, etc.
  value DECIMAL(10,3), -- Numeric value for the measurement
  unit VARCHAR(20), -- g, kg, mm, cm, score, etc.
  notes TEXT, -- Additional observations or context
  measured_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE SET NULL, -- Link to study if applicable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure we don't have duplicate measurements for same animal/type/date
  CONSTRAINT unique_measurement_per_animal_type_date UNIQUE (animal_id, measurement_type, measurement_date)
);

-- Measurement schedules for automated reminders and tracking
CREATE TABLE IF NOT EXISTS measurement_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  measurement_type VARCHAR(100) NOT NULL,
  frequency_days INTEGER NOT NULL DEFAULT 7, -- How often to measure (e.g., weekly = 7)
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- Optional end date for the measurement schedule
  next_due_date DATE NOT NULL,
  reminder_enabled BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE SET NULL,
  notes TEXT, -- Special instructions for this measurement schedule
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Measurement types lookup table for standardization
CREATE TABLE IF NOT EXISTS measurement_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL, -- vitals, research, laboratory, behavioral
  default_unit VARCHAR(20), -- Default unit for this measurement type
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================================
-- TIME SERIES INDEXES AND TRIGGERS
-- ================================================================================

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_animal_measurements_animal_id ON animal_measurements(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_type ON animal_measurements(measurement_type);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_date ON animal_measurements(measurement_date);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_animal_type_date ON animal_measurements(animal_id, measurement_type, measurement_date);

CREATE INDEX IF NOT EXISTS idx_measurement_schedules_animal_id ON measurement_schedules(animal_id);
CREATE INDEX IF NOT EXISTS idx_measurement_schedules_due_date ON measurement_schedules(next_due_date);
CREATE INDEX IF NOT EXISTS idx_measurement_schedules_active ON measurement_schedules(active);

-- Additional indexes for measurement session support
CREATE INDEX IF NOT EXISTS idx_animal_measurements_study_date ON animal_measurements(study_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_study_animal_date ON animal_measurements(study_id, animal_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_date_study ON animal_measurements(measurement_date DESC, study_id);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_recent ON animal_measurements(animal_id, measurement_date DESC) WHERE measurement_date >= CURRENT_DATE - INTERVAL '30 days';
CREATE INDEX IF NOT EXISTS idx_study_assignments_study_status ON study_assignments(study_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_measurement_types_category_sort ON measurement_types(category, sort_order) WHERE is_active = true;

-- Trigger to update next_due_date when a measurement is recorded
CREATE OR REPLACE FUNCTION update_measurement_schedule_due_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the next due date for any active schedules that match this measurement
  UPDATE measurement_schedules
  SET
    next_due_date = NEW.measurement_date::date + INTERVAL '1 day' * frequency_days,
    updated_at = CURRENT_TIMESTAMP
  WHERE
    animal_id = NEW.animal_id
    AND measurement_type = NEW.measurement_type
    AND active = true
    AND NEW.measurement_date::date >= next_due_date;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_measurement_schedule
  AFTER INSERT ON animal_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_measurement_schedule_due_date();

-- ================================================================================
-- STANDARD MEASUREMENT TYPES DATA
-- ================================================================================

-- Insert standard measurement types
INSERT INTO measurement_types (name, category, default_unit, description, sort_order) VALUES
-- Core Vitals
('weight', 'vitals', 'g', 'Body weight measurement', 1),
('body_condition_score', 'vitals', 'score', 'Body condition scoring (1-5 scale)', 2),
('survival_status', 'vitals', 'status', 'Alive/Dead status check', 3),
('temperature', 'vitals', '°C', 'Body temperature', 4),

-- Research Metrics
('tumor_volume', 'research', 'mm³', 'Tumor volume measurement', 10),
('tumor_length', 'research', 'mm', 'Tumor length measurement', 11),
('tumor_width', 'research', 'mm', 'Tumor width measurement', 12),
('lesion_count', 'research', 'count', 'Number of lesions observed', 13),
('behavior_score', 'research', 'score', 'Behavioral assessment score', 14),

-- Laboratory Values
('blood_glucose', 'laboratory', 'mg/dL', 'Blood glucose level', 20),
('hematocrit', 'laboratory', '%', 'Hematocrit percentage', 21),
('hemoglobin', 'laboratory', 'g/dL', 'Hemoglobin concentration', 22),
('white_blood_cell_count', 'laboratory', 'cells/μL', 'WBC count', 23),
('red_blood_cell_count', 'laboratory', 'cells/μL', 'RBC count', 24),

-- Behavioral Assessments
('activity_level', 'behavioral', 'score', 'Activity level assessment (1-5)', 30),
('food_intake', 'behavioral', 'g', 'Daily food consumption', 31),
('water_intake', 'behavioral', 'mL', 'Daily water consumption', 32),
('grooming_score', 'behavioral', 'score', 'Grooming behavior assessment', 33)

ON CONFLICT (name) DO NOTHING;

-- ================================================================================
-- MEASUREMENT SESSION SUPPORT VIEWS
-- ================================================================================

-- View for recent measurement session data
CREATE OR REPLACE VIEW recent_measurement_sessions AS
SELECT
  es.id as study_id,
  es.study_name,
  am.measurement_date,
  COUNT(DISTINCT am.animal_id) as animal_count,
  ARRAY_AGG(DISTINCT am.measurement_type ORDER BY am.measurement_type) as measurement_types,
  COUNT(*) as total_measurements,
  STRING_AGG(DISTINCT u.first_name || ' ' || u.last_name, ', ') as measurers
FROM animal_measurements am
JOIN experimental_studies es ON am.study_id = es.id
LEFT JOIN users u ON am.measured_by = u.id
WHERE am.measurement_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY es.id, es.study_name, am.measurement_date
ORDER BY am.measurement_date DESC;

-- View for animals with measurement history context
CREATE OR REPLACE VIEW animals_with_measurement_context AS
SELECT
  a.id,
  a.animal_number,
  a.species,
  a.strain,
  a.genotype,
  a.sex,
  a.birth_date,
  sa.study_id,
  recent_measurements.last_measurement_date,
  recent_measurements.days_since_measurement,
  recent_measurements.recent_measurement_types,
  recent_measurements.measurement_count,
  CASE
    WHEN recent_measurements.days_since_measurement <= 1 THEN 'recent'
    WHEN recent_measurements.days_since_measurement <= 7 THEN 'week'
    WHEN recent_measurements.days_since_measurement IS NOT NULL THEN 'old'
    ELSE 'unmeasured'
  END as measurement_recency
FROM animals a
JOIN study_assignments sa ON a.id = sa.animal_id
LEFT JOIN (
  SELECT
    am.animal_id,
    am.study_id,
    MAX(am.measurement_date) as last_measurement_date,
    EXTRACT(DAYS FROM CURRENT_DATE - MAX(am.measurement_date)) as days_since_measurement,
    ARRAY_AGG(DISTINCT am.measurement_type ORDER BY am.measurement_type) as recent_measurement_types,
    COUNT(*) as measurement_count
  FROM animal_measurements am
  WHERE am.measurement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY am.animal_id, am.study_id
) recent_measurements ON a.id = recent_measurements.animal_id AND sa.study_id = recent_measurements.study_id
WHERE sa.status = 'active';