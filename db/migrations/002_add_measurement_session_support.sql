-- ================================================================================
-- MEASUREMENT SESSION SUPPORT (Enhancement to Time Series System)
-- Migration to add indexes and optimizations for measurement session workflows
-- ================================================================================

-- Add additional indexes for session-based queries
CREATE INDEX IF NOT EXISTS idx_animal_measurements_study_date ON animal_measurements(study_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_study_animal_date ON animal_measurements(study_id, animal_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_animal_measurements_date_study ON animal_measurements(measurement_date DESC, study_id);

-- Index for recent measurement lookups
CREATE INDEX IF NOT EXISTS idx_animal_measurements_recent ON animal_measurements(animal_id, measurement_date DESC) WHERE measurement_date >= CURRENT_DATE - INTERVAL '30 days';

-- Composite index for study assignment queries
CREATE INDEX IF NOT EXISTS idx_study_assignments_study_status ON study_assignments(study_id, status) WHERE status = 'active';

-- Add index for measurement type lookups
CREATE INDEX IF NOT EXISTS idx_measurement_types_category_sort ON measurement_types(category, sort_order) WHERE is_active = true;

-- ================================================================================
-- PERFORMANCE OPTIMIZATIONS
-- ================================================================================

-- Analyze tables to update statistics for query planner
ANALYZE animal_measurements;
ANALYZE measurement_schedules;
ANALYZE measurement_types;
ANALYZE study_assignments;

-- ================================================================================
-- HELPER VIEWS FOR SESSION QUERIES
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

-- ================================================================================
-- MIGRATION COMPLETION LOG
-- ================================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Measurement session support added';
  RAISE NOTICE 'New indexes created for session-based queries';
  RAISE NOTICE 'Performance views created: recent_measurement_sessions, animals_with_measurement_context';
END
$$;