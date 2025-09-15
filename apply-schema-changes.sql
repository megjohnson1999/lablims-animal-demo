-- Apply only the new schema changes for animal claiming system
-- This avoids conflicts with existing triggers/tables

-- Add availability_status column to animals table if it doesn't exist
ALTER TABLE animals ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available';

-- Create animal_claims table if it doesn't exist
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
  approved_until DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_animals_availability_status ON animals(availability_status);
CREATE INDEX IF NOT EXISTS idx_animal_claims_animal_id ON animal_claims(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_claims_requested_by ON animal_claims(requested_by);
CREATE INDEX IF NOT EXISTS idx_animal_claims_status ON animal_claims(status);
CREATE INDEX IF NOT EXISTS idx_animal_claims_study_id ON animal_claims(study_id);