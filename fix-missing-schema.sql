-- Fix missing schema elements for production deployment
-- These are the specific additions needed

-- Add missing status column to housing table
ALTER TABLE housing ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create biological_samples table if it doesn't exist
CREATE TABLE IF NOT EXISTS biological_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_number INTEGER UNIQUE,
  
  -- Core relationships
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
  
  -- Sample identification
  sample_barcode VARCHAR(100) UNIQUE,
  parent_sample_id UUID REFERENCES biological_samples(id),
  
  -- Sample type and collection info
  sample_type VARCHAR(100) NOT NULL,
  anatomical_site VARCHAR(255),
  sample_description TEXT,
  
  -- Collection details
  collection_date TIMESTAMP NOT NULL,
  collection_method VARCHAR(255),
  collected_by VARCHAR(255) NOT NULL,
  collection_protocol VARCHAR(255),
  
  -- Processing information
  processing_date TIMESTAMP,
  processing_method VARCHAR(255),
  preservation_method VARCHAR(100),
  processed_by VARCHAR(255),
  
  -- Storage location
  storage_location VARCHAR(255),
  storage_container VARCHAR(100),
  storage_position VARCHAR(50),
  storage_temperature VARCHAR(20),
  
  -- Sample quantity and quality
  initial_volume_ml DECIMAL(10, 3),
  current_volume_ml DECIMAL(10, 3),
  initial_weight_mg DECIMAL(10, 3),
  current_weight_mg DECIMAL(10, 3),
  concentration_mg_ml DECIMAL(10, 3),
  quality_score VARCHAR(50),
  
  -- Sample status
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'depleted', 'contaminated', 'discarded')),
  is_aliquot BOOLEAN DEFAULT FALSE,
  number_of_aliquots INTEGER DEFAULT 0,
  
  -- Experimental context
  treatment_group VARCHAR(255),
  timepoint VARCHAR(100),
  collection_order INTEGER,
  
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
  iacuc_protocol VARCHAR(100),
  collection_approved_by VARCHAR(255),
  disposal_date DATE,
  disposal_method VARCHAR(255),
  disposal_approved_by VARCHAR(255),
  
  -- Additional metadata
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

-- Create supporting tables if they don't exist
CREATE TABLE IF NOT EXISTS sample_aliquots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  aliquot_sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  aliquot_number INTEGER NOT NULL,
  volume_transferred_ml DECIMAL(10, 3),
  weight_transferred_mg DECIMAL(10, 3),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  purpose VARCHAR(255),
  
  UNIQUE(parent_sample_id, aliquot_number)
);

CREATE TABLE IF NOT EXISTS sample_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  usage_date TIMESTAMP NOT NULL,
  used_by VARCHAR(255) NOT NULL,
  analysis_type VARCHAR(255),
  volume_used_ml DECIMAL(10, 3),
  weight_used_mg DECIMAL(10, 3),
  purpose TEXT,
  results_location TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sample_chain_of_custody (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id UUID NOT NULL REFERENCES biological_samples(id) ON DELETE CASCADE,
  event_date TIMESTAMP NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  from_person VARCHAR(255),
  to_person VARCHAR(255),
  location VARCHAR(255),
  purpose TEXT,
  signature VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist (PostgreSQL will ignore if they exist)
CREATE INDEX IF NOT EXISTS idx_biological_samples_number ON biological_samples(sample_number);
CREATE INDEX IF NOT EXISTS idx_biological_samples_barcode ON biological_samples(sample_barcode);
CREATE INDEX IF NOT EXISTS idx_biological_samples_animal_id ON biological_samples(animal_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_study_id ON biological_samples(study_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_protocol_id ON biological_samples(protocol_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_type ON biological_samples(sample_type);
CREATE INDEX IF NOT EXISTS idx_biological_samples_status ON biological_samples(status);
CREATE INDEX IF NOT EXISTS idx_biological_samples_collection_date ON biological_samples(collection_date);

-- Auto-generate sample numbers function
CREATE OR REPLACE FUNCTION generate_sample_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sample_number IS NULL THEN
    SELECT COALESCE(MAX(sample_number), 0) + 1 INTO NEW.sample_number FROM biological_samples;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating sample numbers
DROP TRIGGER IF EXISTS generate_sample_number_trigger ON biological_samples;
CREATE TRIGGER generate_sample_number_trigger
  BEFORE INSERT ON biological_samples
  FOR EACH ROW
  EXECUTE FUNCTION generate_sample_number();

-- Add sample type reference data
INSERT INTO system_options (category, option_value, display_text, description, is_active) VALUES
('sample_type', 'blood_whole', 'Whole Blood', 'Fresh whole blood sample', true),
('sample_type', 'blood_serum', 'Serum', 'Blood serum after coagulation', true),
('sample_type', 'blood_plasma', 'Plasma', 'Blood plasma with anticoagulant', true),
('sample_type', 'tissue_liver', 'Liver Tissue', 'Liver tissue sample', true),
('sample_type', 'tissue_brain', 'Brain Tissue', 'Brain tissue sample', true),
('sample_type', 'tissue_heart', 'Heart Tissue', 'Heart tissue sample', true),
('sample_type', 'tissue_kidney', 'Kidney Tissue', 'Kidney tissue sample', true),
('sample_type', 'urine', 'Urine', 'Urine sample', true),
('sample_type', 'feces', 'Feces', 'Fecal sample', true),
('sample_type', 'tissue_other', 'Other Tissue', 'Other tissue type', true)
ON CONFLICT (category, option_value) DO NOTHING;