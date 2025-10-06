-- Migration: Add hierarchical structure to housing table
-- Purpose: Enable building > room > rack > cage organization
-- Safe: Additive only, preserves existing location field

-- Add hierarchy columns to housing table
ALTER TABLE housing
ADD COLUMN building VARCHAR(50),
ADD COLUMN room VARCHAR(50),
ADD COLUMN rack VARCHAR(50),
ADD COLUMN cage VARCHAR(50);

-- Add performance indexes for hierarchy navigation
CREATE INDEX idx_housing_building ON housing(building) WHERE building IS NOT NULL;
CREATE INDEX idx_housing_room ON housing(building, room) WHERE building IS NOT NULL AND room IS NOT NULL;
CREATE INDEX idx_housing_rack ON housing(building, room, rack) WHERE building IS NOT NULL AND room IS NOT NULL AND rack IS NOT NULL;
CREATE INDEX idx_housing_full_hierarchy ON housing(building, room, rack, cage) WHERE building IS NOT NULL;

-- Add computed column for full hierarchy path (for easy display)
ALTER TABLE housing
ADD COLUMN hierarchy_path VARCHAR(255) GENERATED ALWAYS AS (
  CASE
    WHEN building IS NOT NULL AND room IS NOT NULL AND rack IS NOT NULL AND cage IS NOT NULL
      THEN building || ' > ' || room || ' > ' || rack || ' > ' || cage
    WHEN building IS NOT NULL AND room IS NOT NULL AND rack IS NOT NULL
      THEN building || ' > ' || room || ' > ' || rack
    WHEN building IS NOT NULL AND room IS NOT NULL
      THEN building || ' > ' || room
    WHEN building IS NOT NULL
      THEN building
    ELSE location  -- Fall back to original location field
  END
) STORED;

-- Parse existing location data where possible
-- Pattern: "Building X, Room Y" -> building="Building X", room="Room Y"
UPDATE housing
SET
  building = TRIM(SPLIT_PART(location, ',', 1)),
  room = TRIM(SPLIT_PART(location, ',', 2))
WHERE
  location LIKE '%Building%,%Room%'
  AND building IS NULL;

-- For housing numbers that follow pattern like "A-101", try to extract info
UPDATE housing
SET
  building = 'Building ' || SPLIT_PART(housing_number::TEXT, '-', 1),
  cage = housing_number::TEXT
WHERE
  housing_number IS NOT NULL
  AND housing_number::TEXT LIKE '%-%'
  AND building IS NULL;

-- Add constraints for data integrity
ALTER TABLE housing
ADD CONSTRAINT chk_hierarchy_consistency
CHECK (
  -- If rack is specified, room must also be specified
  (rack IS NULL OR room IS NOT NULL) AND
  -- If cage is specified, at least building must be specified
  (cage IS NULL OR building IS NOT NULL)
);

-- Add helpful comment
COMMENT ON COLUMN housing.building IS 'Building identifier (e.g., "Building A", "Vivarium 1")';
COMMENT ON COLUMN housing.room IS 'Room identifier within building (e.g., "Room 101", "Surgery Suite")';
COMMENT ON COLUMN housing.rack IS 'Rack identifier within room (e.g., "Rack 1", "West Wall")';
COMMENT ON COLUMN housing.cage IS 'Cage identifier within rack (e.g., "Cage 5", "A-101")';
COMMENT ON COLUMN housing.hierarchy_path IS 'Auto-generated full hierarchy path for display';