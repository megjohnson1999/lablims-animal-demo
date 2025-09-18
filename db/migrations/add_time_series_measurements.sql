-- ================================================================================
-- TIME SERIES DATA TRACKING TABLES (Phase 3)
-- Migration to add measurement tracking system for existing databases
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
-- MIGRATION COMPLETION LOG
-- ================================================================================

-- Log the completion of this migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Time series measurement tracking system added';
  RAISE NOTICE 'Tables created: animal_measurements, measurement_schedules, measurement_types';
  RAISE NOTICE 'Standard measurement types populated: % rows', (SELECT COUNT(*) FROM measurement_types);
END
$$;