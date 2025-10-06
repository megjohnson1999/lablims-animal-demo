-- Migration: Add missing columns for animal claiming system
-- Date: 2025-10-06
-- Description: Adds availability_status to animals table and fully_fulfilled_at to animal_requests table

-- Add availability_status column to animals table
ALTER TABLE animals
ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available';

-- Add check constraint for availability_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'animals_availability_status_check'
    ) THEN
        ALTER TABLE animals
        ADD CONSTRAINT animals_availability_status_check
        CHECK (availability_status IN ('available', 'claimed', 'reserved', 'breeding', 'retired', 'unavailable'));
    END IF;
END $$;

-- Add index for availability_status
CREATE INDEX IF NOT EXISTS idx_animals_availability_status ON animals(availability_status);

-- Add fully_fulfilled_at column to animal_requests table
ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS fully_fulfilled_at TIMESTAMP;

-- Create animal_claims table if it doesn't exist (for the claiming workflow)
CREATE TABLE IF NOT EXISTS animal_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id) ON UPDATE CASCADE ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  study_id UUID REFERENCES experimental_studies(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  justification TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for animal_claims
CREATE INDEX IF NOT EXISTS idx_animal_claims_animal_id ON animal_claims(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_claims_requested_by ON animal_claims(requested_by);
CREATE INDEX IF NOT EXISTS idx_animal_claims_status ON animal_claims(status);
CREATE INDEX IF NOT EXISTS idx_animal_claims_study_id ON animal_claims(study_id);

-- Add check constraint for animal_claims status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'animal_claims_status_check'
    ) THEN
        ALTER TABLE animal_claims
        ADD CONSTRAINT animal_claims_status_check
        CHECK (status IN ('pending', 'approved', 'denied', 'cancelled'));
    END IF;
END $$;

-- Add trigger for updated_at on animal_claims
CREATE OR REPLACE FUNCTION update_animal_claims_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_animal_claims_updated_at ON animal_claims;
CREATE TRIGGER trigger_animal_claims_updated_at
    BEFORE UPDATE ON animal_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_animal_claims_timestamp();

COMMENT ON COLUMN animals.availability_status IS 'Availability status for animal claiming system: available, claimed, reserved, breeding, retired, unavailable';
COMMENT ON COLUMN animal_requests.fully_fulfilled_at IS 'Timestamp when request was fully fulfilled with all animals allocated';
COMMENT ON TABLE animal_claims IS 'Individual animal claims for direct animal assignment to studies';
