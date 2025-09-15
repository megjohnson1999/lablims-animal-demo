-- Simple migration for missing schema elements

-- Add missing status column to housing table
ALTER TABLE housing ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create biological_samples table if it doesn't exist
CREATE TABLE IF NOT EXISTS biological_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_number INTEGER UNIQUE,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
  sample_barcode VARCHAR(100) UNIQUE,
  parent_sample_id UUID REFERENCES biological_samples(id),
  sample_type VARCHAR(100) NOT NULL,
  anatomical_site VARCHAR(255),
  sample_description TEXT,
  collection_date TIMESTAMP NOT NULL,
  collection_method VARCHAR(255),
  collected_by VARCHAR(255) NOT NULL,
  collection_protocol VARCHAR(255),
  processing_date TIMESTAMP,
  processing_method VARCHAR(255),
  preservation_method VARCHAR(100),
  processed_by VARCHAR(255),
  storage_location VARCHAR(255),
  storage_container VARCHAR(100),
  storage_position VARCHAR(50),
  storage_temperature VARCHAR(20),
  initial_volume_ml DECIMAL(10, 3),
  current_volume_ml DECIMAL(10, 3),
  initial_weight_mg DECIMAL(10, 3),
  current_weight_mg DECIMAL(10, 3),
  concentration_mg_ml DECIMAL(10, 3),
  quality_score VARCHAR(50),
  status VARCHAR(50) DEFAULT 'available',
  is_aliquot BOOLEAN DEFAULT FALSE,
  number_of_aliquots INTEGER DEFAULT 0,
  treatment_group VARCHAR(255),
  timepoint VARCHAR(100),
  collection_order INTEGER,
  contamination_check BOOLEAN DEFAULT FALSE,
  contamination_notes TEXT,
  integrity_check BOOLEAN DEFAULT FALSE,
  integrity_notes TEXT,
  times_thawed INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  accessed_by VARCHAR(255),
  iacuc_protocol VARCHAR(100),
  collection_approved_by VARCHAR(255),
  disposal_date DATE,
  disposal_method VARCHAR(255),
  disposal_approved_by VARCHAR(255),
  metadata JSONB DEFAULT '{}' NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_biological_samples_number ON biological_samples(sample_number);
CREATE INDEX IF NOT EXISTS idx_biological_samples_barcode ON biological_samples(sample_barcode);
CREATE INDEX IF NOT EXISTS idx_biological_samples_animal_id ON biological_samples(animal_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_study_id ON biological_samples(study_id);
CREATE INDEX IF NOT EXISTS idx_biological_samples_type ON biological_samples(sample_type);
CREATE INDEX IF NOT EXISTS idx_biological_samples_status ON biological_samples(status);
CREATE INDEX IF NOT EXISTS idx_biological_samples_collection_date ON biological_samples(collection_date);