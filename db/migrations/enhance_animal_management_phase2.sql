-- Migration: Enhance Animal Management Phase 2
-- Date: 2025-01-11
-- Description: Adds breeding, weight tracking, and enhanced animal management features

-- ================================================================================
-- PHASE 2: ENHANCED ANIMAL MANAGEMENT FEATURES
-- ================================================================================

-- Add breeding and weight tracking columns to animals table
ALTER TABLE animals ADD COLUMN IF NOT EXISTS dam_id UUID REFERENCES animals(id); -- Mother
ALTER TABLE animals ADD COLUMN IF NOT EXISTS sire_id UUID REFERENCES animals(id); -- Father
ALTER TABLE animals ADD COLUMN IF NOT EXISTS vendor_lot VARCHAR(100); -- Vendor lot number
ALTER TABLE animals ADD COLUMN IF NOT EXISTS acquisition_date DATE; -- When animal was acquired
ALTER TABLE animals ADD COLUMN IF NOT EXISTS ear_tag VARCHAR(50); -- Physical ear tag ID
ALTER TABLE animals ADD COLUMN IF NOT EXISTS tattoo VARCHAR(50); -- Tattoo ID
ALTER TABLE animals ADD COLUMN IF NOT EXISTS microchip VARCHAR(50); -- Microchip ID

-- Create animal weight tracking table
CREATE TABLE IF NOT EXISTS animal_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  weight_grams DECIMAL(8,2) NOT NULL,
  body_condition_score INTEGER CHECK (body_condition_score BETWEEN 1 AND 5),
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  measured_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_animal_weights_animal_id ON animal_weights(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_weights_date ON animal_weights(measurement_date);
CREATE INDEX IF NOT EXISTS idx_animals_dam_id ON animals(dam_id);
CREATE INDEX IF NOT EXISTS idx_animals_sire_id ON animals(sire_id);

-- Create animal observations table for welfare monitoring
CREATE TABLE IF NOT EXISTS animal_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observation_type VARCHAR(50) NOT NULL, -- health_check, behavior, clinical_sign
  finding VARCHAR(100) NOT NULL, -- normal, abnormal, specific finding
  severity VARCHAR(20), -- mild, moderate, severe
  description TEXT,
  action_taken TEXT,
  observed_by VARCHAR(100) NOT NULL,
  follow_up_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for observations
CREATE INDEX IF NOT EXISTS idx_animal_observations_animal_id ON animal_observations(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_observations_date ON animal_observations(observation_date);

-- Add system options for breeding and animal management
INSERT INTO system_options (category, option_key, option_value, display_order, description) VALUES
-- Observation types
('observation_type', 'health_check', 'Health Check', 1, 'Routine health assessment'),
('observation_type', 'behavior', 'Behavior', 2, 'Behavioral observation'),
('observation_type', 'clinical_sign', 'Clinical Sign', 3, 'Clinical abnormality'),
('observation_type', 'procedure', 'Procedure', 4, 'Medical or research procedure'),

-- Observation findings
('observation_finding', 'normal', 'Normal', 1, 'No abnormalities detected'),
('observation_finding', 'weight_loss', 'Weight Loss', 2, 'Significant weight loss'),
('observation_finding', 'lethargy', 'Lethargy', 3, 'Reduced activity'),
('observation_finding', 'aggression', 'Aggression', 4, 'Aggressive behavior'),
('observation_finding', 'tumor', 'Tumor', 5, 'Tumor or mass'),
('observation_finding', 'respiratory_distress', 'Respiratory Distress', 6, 'Breathing difficulties'),
('observation_finding', 'other', 'Other', 99, 'Other finding')

ON CONFLICT (category, option_key) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN animals.dam_id IS 'Reference to mother animal for breeding records';
COMMENT ON COLUMN animals.sire_id IS 'Reference to father animal for breeding records';
COMMENT ON COLUMN animals.vendor_lot IS 'Vendor lot number for tracking animal sources';
COMMENT ON COLUMN animals.acquisition_date IS 'Date animal was acquired/received';
COMMENT ON TABLE animal_weights IS 'Weight tracking and body condition scoring for animals';
COMMENT ON TABLE animal_observations IS 'Health and welfare observations for animals';