-- Fix animal_requests table - add missing columns
-- The table was created but is missing some columns from the original migration

-- Add missing columns with proper defaults
ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS fully_fulfilled_at TIMESTAMP;

ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS waitlist_position INTEGER;

ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS estimated_availability DATE;

ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS auto_fulfill BOOLEAN DEFAULT TRUE;

ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE animal_requests
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
