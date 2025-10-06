-- Migration: Add hierarchical housing structure
-- Date: 2025-10-06
-- Description: Adds building, room, rack, cage columns to housing table for proper facility organization

-- Add hierarchical housing columns
ALTER TABLE housing
ADD COLUMN IF NOT EXISTS building VARCHAR(100),
ADD COLUMN IF NOT EXISTS room VARCHAR(100),
ADD COLUMN IF NOT EXISTS rack VARCHAR(100),
ADD COLUMN IF NOT EXISTS cage VARCHAR(100);

-- Update location to be nullable since we now have more specific fields
ALTER TABLE housing ALTER COLUMN location DROP NOT NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_housing_building ON housing(building);
CREATE INDEX IF NOT EXISTS idx_housing_room ON housing(room);
CREATE INDEX IF NOT EXISTS idx_housing_rack ON housing(rack);
CREATE INDEX IF NOT EXISTS idx_housing_cage ON housing(cage);

-- Add comments
COMMENT ON COLUMN housing.building IS 'Building name or identifier (e.g., Animal Research Building, Vivarium 1)';
COMMENT ON COLUMN housing.room IS 'Room number or name within the building';
COMMENT ON COLUMN housing.rack IS 'Rack identifier within the room';
COMMENT ON COLUMN housing.cage IS 'Cage number or identifier within the rack';
COMMENT ON COLUMN housing.location IS 'Legacy single-field location or composite location string';
