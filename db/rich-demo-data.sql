-- Create Experimental Groups and Populate with Demo Data
-- This creates groups for studies and generates rich longitudinal measurement data

DO $$
DECLARE
  study1_id UUID := 'e1111111-1111-1111-1111-111111111111'; -- Cancer Treatment Efficacy Study
  study2_id UUID := 'e1111111-1111-1111-1111-111111111112'; -- Behavioral Assessment Study
  admin_user_id UUID := 'ea8f47d1-b39b-41d0-af23-ae3430e4ec65';

  group1_id UUID;
  group2_id UUID;
  group3_id UUID;
  group4_id UUID;

  meas_date TIMESTAMP;
  baseline_weight NUMERIC;
  current_animal UUID;
  j INTEGER;
BEGIN
  -- Create groups for Study 1 (Cancer Treatment)
  INSERT INTO experimental_groups (study_id, group_number, group_name, target_animal_count, group_type, treatment_description, description, status)
  VALUES
    (study1_id, 1, 'Control', 5, 'control', 'Vehicle only', 'Control group receiving vehicle only', 'active')
  RETURNING id INTO group1_id;

  INSERT INTO experimental_groups (study_id, group_number, group_name, target_animal_count, group_type, treatment_description, description, status)
  VALUES
    (study1_id, 2, 'Treatment A', 5, 'treatment', 'Drug A at 10mg/kg daily', 'Treatment group receiving Drug A at 10mg/kg', 'active')
  RETURNING id INTO group2_id;

  -- Create groups for Study 2 (Behavioral)
  INSERT INTO experimental_groups (study_id, group_number, group_name, target_animal_count, group_type, treatment_description, description, status)
  VALUES
    (study2_id, 3, 'Wild Type', 2, 'control', 'No treatment', 'Wild type control animals', 'active')
  RETURNING id INTO group3_id;

  INSERT INTO experimental_groups (study_id, group_number, group_name, target_animal_count, group_type, treatment_description, description, status)
  VALUES
    (study2_id, 4, 'Transgenic', 2, 'treatment', 'Genetic model', 'Transgenic model animals', 'active')
  RETURNING id INTO group4_id;

  RAISE NOTICE 'Created groups: %, %, %, %', group1_id, group2_id, group3_id, group4_id;

  -- Assign animals to Study 1 groups
  -- Group 1 (Control): Animals 1-5
  FOR j IN 1..5 LOOP
    current_animal := ('10000001-0000-0000-0000-00000000000' || LPAD(j::text, 1, '0'))::UUID;
    INSERT INTO animal_group_assignments (animal_id, group_id, assignment_date, assigned_by)
    VALUES (current_animal, group1_id, CURRENT_DATE - INTERVAL '56 days', admin_user_id);
  END LOOP;

  -- Group 2 (Treatment): Animals 6-10
  FOR j IN 6..10 LOOP
    current_animal := ('10000001-0000-0000-0000-0000000000' || LPAD(j::text, 2, '0'))::UUID;
    INSERT INTO animal_group_assignments (animal_id, group_id, assignment_date, assigned_by)
    VALUES (current_animal, group2_id, CURRENT_DATE - INTERVAL '56 days', admin_user_id);
  END LOOP;

  -- Assign animals to Study 2 groups
  -- Group 3 (Wild Type): Animals 11-12
  FOR j IN 11..12 LOOP
    current_animal := ('10000001-0000-0000-0000-0000000000' || LPAD(j::text, 2, '0'))::UUID;
    INSERT INTO animal_group_assignments (animal_id, group_id, assignment_date, assigned_by)
    VALUES (current_animal, group3_id, CURRENT_DATE - INTERVAL '42 days', admin_user_id);
  END LOOP;

  -- Group 4 (Transgenic): Animals 13-14
  FOR j IN 13..14 LOOP
    current_animal := ('10000001-0000-0000-0000-0000000000' || LPAD(j::text, 2, '0'))::UUID;
    INSERT INTO animal_group_assignments (animal_id, group_id, assignment_date, assigned_by)
    VALUES (current_animal, group4_id, CURRENT_DATE - INTERVAL '42 days', admin_user_id);
  END LOOP;

  RAISE NOTICE 'Assigned animals to groups';

  -- Generate measurements for Study 1, Group 1 (Control - steady weight gain)
  FOR j IN 1..5 LOOP
    current_animal := ('10000001-0000-0000-0000-00000000000' || LPAD(j::text, 1, '0'))::UUID;
    baseline_weight := 24.0 + (random() * 2);

    -- 16 measurements over 8 weeks (Mon & Thu)
    FOR i IN 0..15 LOOP
      meas_date := (CURRENT_DATE - INTERVAL '56 days' + (i * INTERVAL '3.5 days'))::TIMESTAMP;

      -- Weight measurements - steady growth
      INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id, notes)
      VALUES (
        current_animal,
        'weight',
        baseline_weight + (i * 0.35) + (random() * 0.4 - 0.2),
        'g',
        meas_date,
        admin_user_id,
        study1_id,
        CASE WHEN i = 0 THEN 'Baseline' WHEN i = 15 THEN 'Final' ELSE NULL END
      ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;

      -- Body condition score
      INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id)
      VALUES (
        current_animal,
        'body_condition_score',
        3 + FLOOR(random() * 1.5),
        'score',
        meas_date,
        admin_user_id,
        study1_id
      ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Generated Group 1 measurements';

  -- Generate measurements for Study 1, Group 2 (Treatment - weight loss then recovery)
  FOR j IN 6..10 LOOP
    current_animal := ('10000001-0000-0000-0000-0000000000' || LPAD(j::text, 2, '0'))::UUID;
    baseline_weight := 24.0 + (random() * 2);

    FOR i IN 0..15 LOOP
      meas_date := (CURRENT_DATE - INTERVAL '56 days' + (i * INTERVAL '3.5 days'))::TIMESTAMP;

      -- Weight - shows treatment effect
      INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id, notes)
      VALUES (
        current_animal,
        'weight',
        baseline_weight +
          CASE
            WHEN i < 4 THEN (i * -0.5)
            WHEN i < 8 THEN ((i - 4) * 0.6 - 2.0)
            ELSE ((i - 8) * 0.45 - 0.4)
          END + (random() * 0.4 - 0.2),
        'g',
        meas_date,
        admin_user_id,
        study1_id,
        CASE
          WHEN i = 0 THEN 'Baseline - Treatment started'
          WHEN i = 4 THEN 'Nadir - Treatment response'
          WHEN i = 15 THEN 'Final - Recovery observed'
          ELSE NULL
        END
      ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;

      -- Body condition
      INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id)
      VALUES (
        current_animal,
        'body_condition_score',
        CASE WHEN i < 4 THEN 2 + FLOOR(random() * 1.2) ELSE 3 + FLOOR(random() * 1.2) END,
        'score',
        meas_date,
        admin_user_id,
        study1_id
      ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;

      -- Tumor volume (every other measurement)
      IF i % 2 = 0 THEN
        INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id, notes)
        VALUES (
          current_animal,
          'tumor_volume',
          220 - (i * 12) + (random() * 25),
          'mm³',
          meas_date,
          admin_user_id,
          study1_id,
          CASE WHEN i = 14 THEN 'Significant tumor reduction' ELSE NULL END
        ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Generated Group 2 measurements';

  -- Generate biological samples for Study 1 animals
  FOR j IN 1..10 LOOP
    current_animal := ('10000001-0000-0000-0000-0000000000' || LPAD(j::text, 2, '0'))::UUID;

    -- Baseline blood
    INSERT INTO biological_samples (animal_id, sample_type, collection_date, collected_by, storage_location, status, notes)
    VALUES (
      current_animal, 'Blood', CURRENT_DATE - INTERVAL '56 days', admin_user_id,
      'Freezer A, Rack 1', 'available', 'Baseline sample - Day 0'
    );

    -- Mid-point tumor biopsy
    INSERT INTO biological_samples (animal_id, sample_type, collection_date, collected_by, storage_location, status, notes)
    VALUES (
      current_animal, 'Tumor Tissue', CURRENT_DATE - INTERVAL '28 days', admin_user_id,
      'Freezer B, Rack 2', 'depleted', 'Mid-study biopsy - Day 28'
    );

    -- Serum sample
    INSERT INTO biological_samples (animal_id, sample_type, collection_date, collected_by, storage_location, status, notes)
    VALUES (
      current_animal, 'Serum', CURRENT_DATE - INTERVAL '14 days', admin_user_id,
      'Freezer A, Rack 3', 'in_use', 'Cytokine analysis - Day 42'
    );

    -- Terminal samples for even-numbered animals
    IF j % 2 = 0 THEN
      INSERT INTO biological_samples (animal_id, sample_type, collection_date, collected_by, storage_location, status, notes)
      VALUES (
        current_animal, 'Liver', CURRENT_DATE - INTERVAL '1 day', admin_user_id,
        'Freezer B, Rack 4', 'available', 'Terminal collection - Day 56'
      );

      INSERT INTO biological_samples (animal_id, sample_type, collection_date, collected_by, storage_location, status, notes)
      VALUES (
        current_animal, 'Spleen', CURRENT_DATE - INTERVAL '1 day', admin_user_id,
        'Freezer B, Rack 4', 'available', 'Terminal collection - Day 56'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Generated biological samples';

  -- Generate simpler measurements for Study 2 (Behavioral study)
  FOR j IN 11..14 LOOP
    current_animal := ('10000001-0000-0000-0000-0000000000' || LPAD(j::text, 2, '0'))::UUID;
    baseline_weight := 25.0 + (random() * 2);

    -- Weekly measurements for 6 weeks
    FOR i IN 0..5 LOOP
      meas_date := (CURRENT_DATE - INTERVAL '42 days' + (i * INTERVAL '7 days'))::TIMESTAMP;

      INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id)
      VALUES (
        current_animal,
        'weight',
        baseline_weight + (i * 0.4) + (random() * 0.3 - 0.15),
        'g',
        meas_date,
        admin_user_id,
        study2_id
      ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;

      -- Temperature readings
      INSERT INTO animal_measurements (animal_id, measurement_type, value, unit, measurement_date, measured_by, study_id)
      VALUES (
        current_animal,
        'temperature',
        37.0 + (random() * 0.6 - 0.3),
        '°C',
        meas_date,
        admin_user_id,
        study2_id
      ) ON CONFLICT (animal_id, measurement_type, measurement_date) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Generated Study 2 measurements';

END $$;

-- Verify results
SELECT 'Groups Created' as item, COUNT(*) as count FROM experimental_groups;
SELECT 'Animals Assigned' as item, COUNT(*) as count FROM animal_group_assignments;
SELECT 'Measurements Created' as item, COUNT(*) as count FROM animal_measurements;
SELECT 'Samples Created' as item, COUNT(*) as count FROM biological_samples;

-- Show measurement summary
SELECT
  measurement_type,
  COUNT(*) as count,
  ROUND(AVG(value)::numeric, 2) as avg_value,
  ROUND(MIN(value)::numeric, 2) as min_value,
  ROUND(MAX(value)::numeric, 2) as max_value,
  unit
FROM animal_measurements
GROUP BY measurement_type, unit
ORDER BY count DESC;
