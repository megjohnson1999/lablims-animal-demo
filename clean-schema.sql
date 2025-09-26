




CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;



COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';



CREATE FUNCTION public.cancel_reserved_inventory(p_experiment_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  reservation RECORD;
BEGIN
  FOR reservation IN 
    SELECT * FROM inventory_transactions
    WHERE experiment_id = p_experiment_id
      AND transaction_status = 'reserved'
  LOOP
    -- Return quantity to inventory
    UPDATE inventory
    SET current_quantity = current_quantity + ABS(reservation.quantity_change)
    WHERE id = reservation.inventory_id;
    
    -- Mark reservation as cancelled
    UPDATE inventory_transactions
    SET transaction_status = 'cancelled',
        reason = 'Cancelled reservation for experiment ' || p_experiment_id
    WHERE id = reservation.id;
  END LOOP;
  
  RETURN TRUE;
END;
$$;



CREATE FUNCTION public.cleanup_old_extraction_data(days_to_keep integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted_jobs AS (
    DELETE FROM extraction_jobs 
    WHERE status = 'failed' 
      AND started_at < (CURRENT_DATE - INTERVAL '1 day' * days_to_keep)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_jobs;
  
  RETURN deleted_count;
END;
$$;



CREATE FUNCTION public.consume_reserved_inventory(p_experiment_id uuid, p_actual_usage jsonb DEFAULT NULL::jsonb) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  reservation RECORD;
BEGIN
  FOR reservation IN 
    SELECT * FROM inventory_transactions
    WHERE experiment_id = p_experiment_id
      AND transaction_status = 'reserved'
  LOOP
    -- Mark reservation as consumed
    UPDATE inventory_transactions
    SET transaction_status = 'consumed',
        reason = 'Used in experiment'
    WHERE id = reservation.id;
  END LOOP;
  
  RETURN TRUE;
END;
$$;



CREATE FUNCTION public.generate_animal_number() RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN nextval('animal_number_seq');
END;
$$;



CREATE FUNCTION public.generate_extraction_job_id() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'EXT_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS') || '_' || 
         LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$;



CREATE FUNCTION public.generate_housing_number() RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN nextval('housing_number_seq');
END;
$$;



CREATE FUNCTION public.generate_sample_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.sample_number IS NULL THEN
    SELECT COALESCE(MAX(sample_number), 0) + 1 INTO NEW.sample_number FROM biological_samples;
  END IF;
  RETURN NEW;
END;
$$;



CREATE FUNCTION public.get_expiring_items(days_ahead integer DEFAULT 30) RETURNS TABLE(inventory_id integer, name character varying, category character varying, expiration_date date, current_quantity numeric, unit_of_measure character varying, days_until_expiry integer, barcode character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.inventory_id,
    i.name,
    i.category,
    i.expiration_date,
    i.current_quantity,
    i.unit_of_measure,
    (i.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    i.barcode
  FROM inventory i
  WHERE i.expiration_date IS NOT NULL
    AND i.expiration_date <= (CURRENT_DATE + INTERVAL '1 day' * days_ahead)
    AND i.expiration_date >= CURRENT_DATE
  ORDER BY i.expiration_date ASC;
END;
$$;



CREATE FUNCTION public.get_extraction_statistics(days_back integer DEFAULT 30) RETURNS TABLE(total_extractions bigint, successful_extractions bigint, failed_extractions bigint, average_confidence numeric, average_processing_time_ms numeric, review_required_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(ej.id) as total_extractions,
    COUNT(CASE WHEN ej.status = 'completed' THEN 1 END) as successful_extractions,
    COUNT(CASE WHEN ej.status = 'failed' THEN 1 END) as failed_extractions,
    ROUND(AVG(epd.overall_confidence), 2) as average_confidence,
    ROUND(AVG(ej.processing_time_ms::DECIMAL), 2) as average_processing_time_ms,
    COUNT(CASE WHEN epd.manual_review_required = true THEN 1 END) as review_required_count
  FROM extraction_jobs ej
  LEFT JOIN extracted_protocol_data epd ON ej.id = epd.extraction_job_id
  WHERE ej.started_at >= (CURRENT_DATE - INTERVAL '1 day' * days_back);
END;
$$;



CREATE FUNCTION public.get_low_stock_items() RETURNS TABLE(inventory_id integer, name character varying, category character varying, current_quantity numeric, minimum_stock_level numeric, unit_of_measure character varying, barcode character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.inventory_id,
    i.name,
    i.category,
    i.current_quantity,
    i.minimum_stock_level,
    i.unit_of_measure,
    i.barcode
  FROM inventory i
  WHERE i.current_quantity <= i.minimum_stock_level
    AND i.minimum_stock_level > 0
  ORDER BY (i.current_quantity / NULLIF(i.minimum_stock_level, 0)) ASC;
END;
$$;



CREATE FUNCTION public.get_next_number(entity_type character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      SELECT COALESCE(MAX(collaborator_number), 0) + 1 INTO next_val FROM collaborators WHERE collaborator_number > 0;
    WHEN 'project' THEN  
      SELECT COALESCE(MAX(project_number), 0) + 1 INTO next_val FROM projects WHERE project_number > 0;
    WHEN 'specimen' THEN
      SELECT COALESCE(MAX(specimen_number), 0) + 1 INTO next_val FROM specimens WHERE specimen_number > 0;
    WHEN 'patient' THEN
      SELECT COALESCE(MAX(patient_number), 0) + 1 INTO next_val FROM patients WHERE patient_number > 0;
    WHEN 'animal' THEN
      SELECT COALESCE(MAX(animal_number), 0) + 1 INTO next_val FROM animals WHERE animal_number > 0;
    WHEN 'protocol' THEN
      SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
    WHEN 'inventory' THEN
      SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
    WHEN 'experiment' THEN
      SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
    WHEN 'study' THEN
      SELECT COALESCE(MAX(study_number), 0) + 1 INTO next_val FROM experimental_studies WHERE study_number > 0;
    WHEN 'group' THEN
      SELECT COALESCE(MAX(group_number), 0) + 1 INTO next_val FROM experimental_groups WHERE group_number > 0;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient, animal, protocol, inventory, experiment, study, group', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$;



CREATE FUNCTION public.get_project_metadata_keys(project_id_param uuid) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT key ORDER BY key)
  INTO result
  FROM specimens s,
       jsonb_each_text(s.metadata) AS j(key, value)
  WHERE s.project_id = project_id_param
    AND s.metadata != '{}'::jsonb;
    
  RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$;



CREATE FUNCTION public.log_specimen_metadata_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.metadata IS DISTINCT FROM NEW.metadata THEN
    INSERT INTO audit_log (
      user_id, 
      action, 
      table_name, 
      record_id, 
      changed_fields
    ) VALUES (
      NULL,  -- Use NULL for system-triggered changes
      'UPDATE_METADATA',
      'specimens',
      NEW.id,
      jsonb_build_object(
        'old_metadata', OLD.metadata,
        'new_metadata', NEW.metadata
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;



CREATE FUNCTION public.peek_next_number(entity_type character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      SELECT COALESCE(MAX(collaborator_number), 0) + 1 INTO next_val FROM collaborators WHERE collaborator_number > 0;
    WHEN 'project' THEN
      SELECT COALESCE(MAX(project_number), 0) + 1 INTO next_val FROM projects WHERE project_number > 0;
    WHEN 'specimen' THEN
      SELECT COALESCE(MAX(specimen_number), 0) + 1 INTO next_val FROM specimens WHERE specimen_number > 0;
    WHEN 'patient' THEN
      SELECT COALESCE(MAX(patient_number), 0) + 1 INTO next_val FROM patients WHERE patient_number > 0;
    WHEN 'animal' THEN
      SELECT COALESCE(MAX(animal_number), 0) + 1 INTO next_val FROM animals WHERE animal_number > 0;
    WHEN 'protocol' THEN
      SELECT COALESCE(MAX(protocol_id), 0) + 1 INTO next_val FROM protocols WHERE protocol_id > 0;
    WHEN 'inventory' THEN
      SELECT COALESCE(MAX(inventory_id), 0) + 1 INTO next_val FROM inventory WHERE inventory_id > 0;
    WHEN 'experiment' THEN
      SELECT COALESCE(MAX(experiment_id), 0) + 1 INTO next_val FROM experiments WHERE experiment_id > 0;
    WHEN 'study' THEN
      SELECT COALESCE(MAX(study_number), 0) + 1 INTO next_val FROM experimental_studies WHERE study_number > 0;
    WHEN 'group' THEN
      SELECT COALESCE(MAX(group_number), 0) + 1 INTO next_val FROM experimental_groups WHERE group_number > 0;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %. Valid types: collaborator, project, specimen, patient, animal, protocol, inventory, experiment, study, group', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$;



CREATE FUNCTION public.reserve_inventory_for_experiment(p_experiment_id uuid, p_inventory_items jsonb, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  item JSONB;
  inventory_item RECORD;
  available_quantity DECIMAL(10,2);
  original_quantity DECIMAL(10,2);
  original_unit TEXT;
  converted_quantity DECIMAL(10,2);
  warnings JSONB := '[]'::JSONB;
  warning_msg TEXT;
  items_processed INTEGER := 0;
  items_reserved INTEGER := 0;
BEGIN
  -- Loop through each inventory item to reserve
  FOR item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    items_processed := items_processed + 1;
    
    -- Get current inventory item
    SELECT * INTO inventory_item 
    FROM inventory 
    WHERE id = (item->>'inventory_id')::UUID;
    
    IF NOT FOUND THEN
      -- Inventory item not found - assume it's an untracked reagent, skip silently
      warning_msg := format('Reagent not found in inventory (assuming untracked): %s', 
                           COALESCE(item->>'name', item->>'inventory_id'));
      warnings := warnings || jsonb_build_object(
        'type', 'untracked_reagent',
        'message', warning_msg,
        'item_id', item->>'inventory_id',
        'item_name', item->>'name'
      );
      CONTINUE;
    END IF;
    
    -- Get the original quantity and unit from the request
    original_quantity := (item->>'quantity')::DECIMAL;
    original_unit := item->>'unit';
    
    -- Convert quantity to inventory base unit if different
    IF original_unit = 'µL' OR original_unit = 'μL' OR original_unit = 'ul' THEN
      converted_quantity := original_quantity / 1000.0; -- Convert µL to mL
    ELSE
      converted_quantity := original_quantity; -- Already in base unit (mL)
    END IF;
    
    -- Check if enough quantity is available
    SELECT current_quantity INTO available_quantity
    FROM inventory
    WHERE id = inventory_item.id;
    
    IF available_quantity < converted_quantity THEN
      -- Insufficient inventory - create warning but continue
      warning_msg := format('Insufficient inventory for %s: Available %s mL, Required %s %s', 
                           inventory_item.name, available_quantity, original_quantity, original_unit);
      warnings := warnings || jsonb_build_object(
        'type', 'insufficient_quantity',
        'message', warning_msg,
        'item_name', inventory_item.name,
        'available', available_quantity,
        'required', original_quantity,
        'unit', original_unit
      );
      
      -- Reserve what's available if anything
      IF available_quantity > 0 THEN
        -- Create partial reservation transaction
        INSERT INTO inventory_transactions (
          inventory_id, 
          transaction_type, 
          quantity_change, 
          quantity_after, 
          reason, 
          performed_by, 
          experiment_id,
          transaction_status,
          transaction_unit
        ) VALUES (
          inventory_item.id,
          'out',
          -(available_quantity * 1000), -- Convert back to µL for display
          0,
          format('Partial reservation for experiment (required %s %s)', original_quantity, original_unit),
          p_user_id,
          p_experiment_id,
          'reserved',
          'µL'
        );
        
        -- Update inventory to zero
        UPDATE inventory 
        SET current_quantity = 0
        WHERE id = inventory_item.id;
        
        items_reserved := items_reserved + 1;
      END IF;
    ELSE
      -- Sufficient inventory - normal reservation
      INSERT INTO inventory_transactions (
        inventory_id, 
        transaction_type, 
        quantity_change, 
        quantity_after, 
        reason, 
        performed_by, 
        experiment_id,
        transaction_status,
        transaction_unit
      ) VALUES (
        inventory_item.id,
        'out',
        -(original_quantity),
        available_quantity - converted_quantity,
        'Used in experiment',
        p_user_id,
        p_experiment_id,
        'reserved',
        original_unit
      );
      
      -- Update inventory quantity (using converted amount for base unit)
      UPDATE inventory 
      SET current_quantity = current_quantity - converted_quantity
      WHERE id = inventory_item.id;
      
      items_reserved := items_reserved + 1;
    END IF;
  END LOOP;
  
  -- Return result with success status and warnings
  RETURN jsonb_build_object(
    'success', true,
    'items_processed', items_processed,
    'items_reserved', items_reserved,
    'warnings', warnings,
    'has_warnings', jsonb_array_length(warnings) > 0
  );
END;
$$;



CREATE FUNCTION public.set_animal_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.animal_number IS NULL THEN
        NEW.animal_number := generate_animal_number();
    END IF;
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.set_housing_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.housing_number IS NULL THEN
        NEW.housing_number := generate_housing_number();
    END IF;
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_sample_quantities() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update the current volume and weight after usage
  UPDATE biological_samples 
  SET 
    current_volume_ml = CASE 
      WHEN current_volume_ml IS NOT NULL AND NEW.volume_used_ml IS NOT NULL 
      THEN GREATEST(0, current_volume_ml - NEW.volume_used_ml)
      ELSE current_volume_ml 
    END,
    current_weight_mg = CASE 
      WHEN current_weight_mg IS NOT NULL AND NEW.weight_used_mg IS NOT NULL 
      THEN GREATEST(0, current_weight_mg - NEW.weight_used_mg)
      ELSE current_weight_mg 
    END,
    last_accessed = NEW.usage_date,
    accessed_by = NEW.used_by,
    status = CASE 
      WHEN (
        (current_volume_ml IS NOT NULL AND current_volume_ml - COALESCE(NEW.volume_used_ml, 0) <= 0) OR
        (current_weight_mg IS NOT NULL AND current_weight_mg - COALESCE(NEW.weight_used_mg, 0) <= 0)
      ) THEN 'depleted'
      ELSE status
    END
  WHERE id = NEW.sample_id;
  
  RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.validate_specimen_metadata(metadata_input jsonb) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF jsonb_typeof(metadata_input) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM jsonb_each(metadata_input) AS j(key, value)
    WHERE jsonb_typeof(j.value) NOT IN ('string', 'number', 'boolean', 'null')
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;





CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);



CREATE TABLE public.animal_group_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    animal_id uuid NOT NULL,
    group_id uuid NOT NULL,
    assignment_date date DEFAULT CURRENT_DATE NOT NULL,
    assigned_by uuid,
    randomization_number integer,
    baseline_weight numeric(8,2),
    baseline_age_days integer,
    assignment_notes text,
    status character varying(50) DEFAULT 'active'::character varying,
    withdrawal_date date,
    withdrawal_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT animal_group_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'withdrawn'::character varying, 'completed'::character varying, 'deceased'::character varying])::text[])))
);



CREATE TABLE public.animal_group_measurements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    assignment_id uuid NOT NULL,
    measurement_id uuid NOT NULL,
    measurement_date date NOT NULL,
    measurement_time time without time zone,
    value numeric(12,4),
    text_value text,
    measured_by character varying(255),
    quality_flag character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT animal_group_measurements_quality_flag_check CHECK (((quality_flag)::text = ANY ((ARRAY['good'::character varying, 'questionable'::character varying, 'poor'::character varying, 'excluded'::character varying])::text[])))
);



CREATE TABLE public.animal_measurements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    animal_id uuid NOT NULL,
    measurement_date timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    measurement_type character varying(100) NOT NULL,
    value numeric(10,3),
    unit character varying(20),
    notes text,
    measured_by uuid NOT NULL,
    study_id uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.animal_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.animal_observations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    animal_id uuid NOT NULL,
    observation_date date DEFAULT CURRENT_DATE NOT NULL,
    observation_type character varying(50) NOT NULL,
    finding character varying(100) NOT NULL,
    severity character varying(20),
    description text,
    action_taken text,
    observed_by character varying(100) NOT NULL,
    follow_up_required boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



COMMENT ON TABLE public.animal_observations IS 'Health and welfare observations for animals';



CREATE TABLE public.animal_request_allocations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    animal_id uuid NOT NULL,
    allocated_by uuid NOT NULL,
    allocated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.animal_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_number integer,
    requested_by uuid NOT NULL,
    study_id uuid,
    title character varying(255) NOT NULL,
    description text,
    justification text NOT NULL,
    species character varying(100) NOT NULL,
    strain character varying(100) NOT NULL,
    strain_alternatives jsonb DEFAULT '[]'::jsonb,
    sex character varying(10),
    genotype character varying(500),
    genotype_alternatives jsonb DEFAULT '[]'::jsonb,
    quantity_requested integer NOT NULL,
    min_age_days integer,
    max_age_days integer,
    age_flexibility boolean DEFAULT false,
    needed_by_date date NOT NULL,
    flexible_date boolean DEFAULT false,
    duration_days integer,
    housing_requirements text,
    group_housing boolean DEFAULT true,
    priority character varying(20) DEFAULT 'normal'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp(6) without time zone,
    review_notes text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.animal_weights (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    animal_id uuid NOT NULL,
    weight_grams numeric(8,2) NOT NULL,
    body_condition_score integer,
    measurement_date date DEFAULT CURRENT_DATE NOT NULL,
    measured_by character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT animal_weights_body_condition_score_check CHECK (((body_condition_score >= 1) AND (body_condition_score <= 5)))
);



COMMENT ON TABLE public.animal_weights IS 'Weight tracking and body condition scoring for animals';



CREATE TABLE public.animals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    animal_number integer,
    species character varying(100) NOT NULL,
    strain character varying(100),
    sex character varying(10),
    birth_date date,
    death_date date,
    source character varying(255),
    genotype text,
    housing_id uuid,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    dam_id uuid,
    sire_id uuid,
    vendor_lot character varying(100),
    acquisition_date date,
    ear_tag character varying(50),
    tattoo character varying(50),
    microchip character varying(50),
    identification_method character varying(50) DEFAULT 'ear_tag'::character varying,
    identification_number character varying(100),
    vendor character varying(255),
    arrival_date date,
    CONSTRAINT animals_sex_check CHECK (((sex)::text = ANY ((ARRAY['M'::character varying, 'F'::character varying, 'Unknown'::character varying])::text[]))),
    CONSTRAINT animals_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'deceased'::character varying, 'transferred'::character varying, 'retired'::character varying])::text[])))
);



COMMENT ON COLUMN public.animals.dam_id IS 'Reference to mother animal for breeding records';



COMMENT ON COLUMN public.animals.sire_id IS 'Reference to father animal for breeding records';



COMMENT ON COLUMN public.animals.vendor_lot IS 'Vendor lot number for tracking animal sources';



COMMENT ON COLUMN public.animals.acquisition_date IS 'Date animal was acquired/received';



CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id uuid NOT NULL,
    changed_fields jsonb,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.biological_samples (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sample_number integer,
    animal_id uuid NOT NULL,
    study_id uuid,
    protocol_id uuid,
    sample_barcode character varying(100),
    parent_sample_id uuid,
    sample_type character varying(100) NOT NULL,
    anatomical_site character varying(255),
    sample_description text,
    collection_date timestamp without time zone NOT NULL,
    collection_method character varying(255),
    collected_by character varying(255) NOT NULL,
    collection_protocol character varying(255),
    processing_date timestamp without time zone,
    processing_method character varying(255),
    preservation_method character varying(100),
    processed_by character varying(255),
    storage_location character varying(255),
    storage_container character varying(100),
    storage_position character varying(50),
    storage_temperature character varying(20),
    initial_volume_ml numeric(10,3),
    current_volume_ml numeric(10,3),
    initial_weight_mg numeric(10,3),
    current_weight_mg numeric(10,3),
    concentration_mg_ml numeric(10,3),
    quality_score character varying(50),
    status character varying(50) DEFAULT 'available'::character varying,
    is_aliquot boolean DEFAULT false,
    number_of_aliquots integer DEFAULT 0,
    treatment_group character varying(255),
    timepoint character varying(100),
    collection_order integer,
    contamination_check boolean DEFAULT false,
    contamination_notes text,
    integrity_check boolean DEFAULT false,
    integrity_notes text,
    times_thawed integer DEFAULT 0,
    last_accessed timestamp without time zone,
    accessed_by character varying(255),
    iacuc_protocol character varying(100),
    collection_approved_by character varying(255),
    disposal_date date,
    disposal_method character varying(255),
    disposal_approved_by character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT biological_samples_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'in_use'::character varying, 'depleted'::character varying, 'contaminated'::character varying, 'discarded'::character varying])::text[]))),
    CONSTRAINT valid_volumes CHECK ((((initial_volume_ml IS NULL) OR (initial_volume_ml >= (0)::numeric)) AND ((current_volume_ml IS NULL) OR (current_volume_ml >= (0)::numeric)) AND ((current_volume_ml IS NULL) OR (initial_volume_ml IS NULL) OR (current_volume_ml <= initial_volume_ml)))),
    CONSTRAINT valid_weights CHECK ((((initial_weight_mg IS NULL) OR (initial_weight_mg >= (0)::numeric)) AND ((current_weight_mg IS NULL) OR (current_weight_mg >= (0)::numeric)) AND ((current_weight_mg IS NULL) OR (initial_weight_mg IS NULL) OR (current_weight_mg <= initial_weight_mg))))
);



COMMENT ON TABLE public.biological_samples IS 'Biological samples collected from research organisms - replaces pathogen-focused specimens table';



COMMENT ON COLUMN public.biological_samples.sample_type IS 'Type of biological sample (blood, tissue, urine, etc.)';



COMMENT ON COLUMN public.biological_samples.anatomical_site IS 'Anatomical location sample was collected from';



COMMENT ON COLUMN public.biological_samples.collection_method IS 'How the sample was collected (necropsy, biopsy, etc.)';



COMMENT ON COLUMN public.biological_samples.timepoint IS 'Study timepoint when sample was collected';



COMMENT ON COLUMN public.biological_samples.iacuc_protocol IS 'IACUC protocol number authorizing sample collection';



CREATE TABLE public.experimental_studies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    study_number integer,
    study_name character varying(255) NOT NULL,
    description text,
    principal_investigator character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'planning'::character varying,
    study_type character varying(100),
    objective text,
    start_date date,
    planned_end_date date,
    actual_end_date date,
    iacuc_protocol_number character varying(100),
    species_required character varying(255),
    total_animals_planned integer,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT experimental_studies_status_check CHECK (((status)::text = ANY ((ARRAY['planning'::character varying, 'active'::character varying, 'completed'::character varying, 'paused'::character varying, 'terminated'::character varying])::text[])))
);



CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(255),
    last_name character varying(255),
    role character varying(50) DEFAULT 'researcher'::character varying NOT NULL,
    active boolean DEFAULT true,
    force_password_change boolean DEFAULT false,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    last_login timestamp without time zone,
    password_changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'facility_manager'::character varying, 'veterinarian'::character varying, 'researcher'::character varying, 'technician'::character varying])::text[])))
);



CREATE VIEW public.biological_samples_with_details AS
 SELECT bs.id,
    bs.sample_number,
    bs.animal_id,
    bs.study_id,
    bs.protocol_id,
    bs.sample_barcode,
    bs.parent_sample_id,
    bs.sample_type,
    bs.anatomical_site,
    bs.sample_description,
    bs.collection_date,
    bs.collection_method,
    bs.collected_by,
    bs.collection_protocol,
    bs.processing_date,
    bs.processing_method,
    bs.preservation_method,
    bs.processed_by,
    bs.storage_location,
    bs.storage_container,
    bs.storage_position,
    bs.storage_temperature,
    bs.initial_volume_ml,
    bs.current_volume_ml,
    bs.initial_weight_mg,
    bs.current_weight_mg,
    bs.concentration_mg_ml,
    bs.quality_score,
    bs.status,
    bs.is_aliquot,
    bs.number_of_aliquots,
    bs.treatment_group,
    bs.timepoint,
    bs.collection_order,
    bs.contamination_check,
    bs.contamination_notes,
    bs.integrity_check,
    bs.integrity_notes,
    bs.times_thawed,
    bs.last_accessed,
    bs.accessed_by,
    bs.iacuc_protocol,
    bs.collection_approved_by,
    bs.disposal_date,
    bs.disposal_method,
    bs.disposal_approved_by,
    bs.metadata,
    bs.notes,
    bs.created_at,
    bs.updated_at,
    bs.created_by,
    a.animal_number,
    a.species,
    a.strain,
    a.sex,
    a.birth_date,
    es.study_name,
    es.principal_investigator,
    u.username AS created_by_username,
        CASE
            WHEN (a.birth_date IS NOT NULL) THEN EXTRACT(days FROM (bs.collection_date - (a.birth_date)::timestamp without time zone))
            ELSE NULL::numeric
        END AS age_at_collection_days,
    concat_ws(' / '::text, bs.storage_location, bs.storage_container, bs.storage_position) AS full_storage_location,
        CASE
            WHEN (bs.initial_volume_ml > (0)::numeric) THEN round(((bs.current_volume_ml / bs.initial_volume_ml) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS volume_remaining_percent,
        CASE
            WHEN (bs.initial_weight_mg > (0)::numeric) THEN round(((bs.current_weight_mg / bs.initial_weight_mg) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS weight_remaining_percent
   FROM (((public.biological_samples bs
     LEFT JOIN public.animals a ON ((bs.animal_id = a.id)))
     LEFT JOIN public.experimental_studies es ON ((bs.study_id = es.id)))
     LEFT JOIN public.users u ON ((bs.created_by = u.id)));



CREATE TABLE public.breeding_colonies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    species character varying(100) NOT NULL,
    strain character varying(100) NOT NULL,
    primary_purpose text,
    target_population integer,
    active boolean DEFAULT true,
    manager_id uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.breeding_pairs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    colony_id uuid NOT NULL,
    dam_id uuid NOT NULL,
    sire_id uuid NOT NULL,
    pair_number character varying(50),
    setup_date date NOT NULL,
    retirement_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    breeding_method character varying(50) DEFAULT 'natural'::character varying,
    expected_offspring_count integer,
    notes text,
    created_by uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.breeding_performance_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    breeding_pair_id uuid NOT NULL,
    total_litters integer DEFAULT 0,
    total_offspring integer DEFAULT 0,
    avg_litter_size numeric(4,1),
    avg_weaning_success_rate numeric(5,2),
    avg_inter_litter_interval integer,
    first_litter_date date,
    last_litter_date date,
    breeding_lifespan_days integer,
    conception_rate numeric(5,2),
    offspring_survival_rate numeric(5,2),
    average_offspring_weight numeric(6,2),
    congenital_abnormalities integer DEFAULT 0,
    last_calculated timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.breeding_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    colony_id uuid NOT NULL,
    breeding_pair_id uuid,
    activity_type character varying(100) NOT NULL,
    scheduled_date date NOT NULL,
    completed_date date,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    notes text,
    completion_notes text,
    assigned_to uuid,
    completed_by uuid,
    created_by uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.collaborator_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.collaborators (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collaborator_number integer,
    irb_id character varying(50),
    pi_name character varying(255) NOT NULL,
    pi_institute character varying(255) NOT NULL,
    pi_email character varying(255),
    pi_phone character varying(50),
    pi_fax character varying(50),
    internal_contact character varying(255),
    comments text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.experiment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.experimental_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_number integer,
    study_id uuid NOT NULL,
    group_name character varying(255) NOT NULL,
    group_type character varying(50) DEFAULT 'treatment'::character varying,
    description text,
    target_animal_count integer,
    current_animal_count integer DEFAULT 0,
    treatment_description text,
    dosage_regimen text,
    schedule_description text,
    start_date date,
    end_date date,
    status character varying(50) DEFAULT 'recruiting'::character varying,
    randomization_method character varying(100),
    inclusion_criteria text,
    exclusion_criteria text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT experimental_groups_group_type_check CHECK (((group_type)::text = ANY ((ARRAY['control'::character varying, 'treatment'::character varying, 'sham'::character varying, 'baseline'::character varying])::text[]))),
    CONSTRAINT experimental_groups_status_check CHECK (((status)::text = ANY ((ARRAY['recruiting'::character varying, 'active'::character varying, 'completed'::character varying, 'terminated'::character varying])::text[])))
);



CREATE TABLE public.experiments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    experiment_id integer NOT NULL,
    protocol_id uuid,
    user_id uuid,
    date_performed date,
    status character varying(50) DEFAULT 'planned'::character varying,
    sample_ids jsonb DEFAULT '[]'::jsonb,
    actual_reagents_used jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.protocols (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    protocol_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    version character varying(50) DEFAULT '1.0'::character varying,
    required_reagents jsonb DEFAULT '[]'::jsonb,
    basic_steps text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE VIEW public.experiments_with_details AS
 SELECT e.id,
    e.experiment_id,
    e.protocol_id,
    e.user_id,
    e.date_performed,
    e.status,
    e.sample_ids,
    e.actual_reagents_used,
    e.notes,
    e.created_at,
    e.updated_at,
    p.name AS protocol_name,
    p.description AS protocol_description,
    p.version AS protocol_version,
    u.username AS performed_by_username,
    u.first_name AS performed_by_first_name,
    u.last_name AS performed_by_last_name,
    jsonb_array_length(e.sample_ids) AS sample_count
   FROM ((public.experiments e
     LEFT JOIN public.protocols p ON ((e.protocol_id = p.id)))
     LEFT JOIN public.users u ON ((e.user_id = u.id)));



CREATE TABLE public.extracted_protocol_data (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    extraction_job_id uuid,
    document_id uuid,
    extracted_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    extraction_metadata jsonb DEFAULT '{}'::jsonb,
    overall_confidence numeric(5,2),
    manual_review_required boolean DEFAULT false,
    reviewed_by uuid,
    review_date timestamp without time zone,
    review_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.extraction_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    job_id character varying(255) NOT NULL,
    document_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    initiated_by uuid,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    error_message text,
    processing_time_ms bigint,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.genetic_diversity_tracking (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    colony_id uuid NOT NULL,
    effective_population_size integer,
    inbreeding_coefficient numeric(6,4),
    genetic_bottleneck_risk character varying(20),
    founder_lines_active integer,
    average_generation_number numeric(4,1),
    max_generation_number integer,
    outcrossing_recommended boolean DEFAULT false,
    new_founders_needed integer DEFAULT 0,
    recommended_actions text,
    analysis_date date DEFAULT CURRENT_DATE,
    calculated_by uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.group_measurements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id uuid NOT NULL,
    measurement_name character varying(255) NOT NULL,
    measurement_type character varying(100),
    description text,
    collection_schedule character varying(255),
    measurement_units character varying(50),
    normal_range_min numeric(10,4),
    normal_range_max numeric(10,4),
    methodology text,
    equipment_used text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.group_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.group_treatments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id uuid NOT NULL,
    treatment_name character varying(255) NOT NULL,
    treatment_type character varying(100),
    description text,
    dosage character varying(255),
    route character varying(100),
    frequency character varying(255),
    duration_days integer,
    start_date date,
    end_date date,
    administered_by character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.housing (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    housing_number integer,
    location character varying(100) NOT NULL,
    cage_type character varying(50),
    capacity integer DEFAULT 1,
    current_occupancy integer DEFAULT 0,
    environmental_conditions jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT housing_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'maintenance'::character varying, 'quarantine'::character varying])::text[])))
);



CREATE SEQUENCE public.housing_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.id_generation_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50) NOT NULL,
    generated_id integer NOT NULL,
    generated_by character varying(255),
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.inventory (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_id integer,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    description text,
    supplier character varying(255),
    catalog_number character varying(100),
    current_quantity numeric(10,2) DEFAULT 0 NOT NULL,
    unit_of_measure character varying(50),
    lot_number character varying(100),
    expiration_date date,
    storage_location character varying(255),
    storage_conditions character varying(255),
    minimum_stock_level numeric(10,2) DEFAULT 0,
    cost_per_unit numeric(10,2),
    barcode character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.inventory_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_name character varying(100) NOT NULL,
    description text,
    default_unit character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.inventory_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_id uuid,
    transaction_type character varying(50) NOT NULL,
    quantity_change numeric(10,2) NOT NULL,
    quantity_after numeric(10,2) NOT NULL,
    reason text,
    performed_by uuid,
    transaction_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    experiment_id uuid,
    transaction_status character varying(50) DEFAULT 'completed'::character varying,
    transaction_unit character varying(20)
);



CREATE TABLE public.litters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    breeding_pair_id uuid NOT NULL,
    litter_number integer,
    birth_date date NOT NULL,
    total_born integer DEFAULT 0 NOT NULL,
    alive_at_birth integer DEFAULT 0 NOT NULL,
    weaned_count integer DEFAULT 0,
    weaning_date date,
    average_birth_weight numeric(6,2),
    status character varying(50) DEFAULT 'nursing'::character varying,
    mortality_notes text,
    weaning_notes text,
    recorded_by uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.measurement_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    animal_id uuid NOT NULL,
    measurement_type character varying(100) NOT NULL,
    frequency_days integer DEFAULT 7 NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    next_due_date date NOT NULL,
    reminder_enabled boolean DEFAULT true,
    active boolean DEFAULT true,
    created_by uuid NOT NULL,
    study_id uuid,
    notes text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.measurement_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    default_unit character varying(20),
    description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying,
    related_request_id uuid,
    action_url character varying(500),
    read_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid
);



CREATE SEQUENCE public.patient_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.patients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_number integer,
    external_id character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    date_of_birth character varying(255),
    diagnosis character varying(255),
    physician_first_name character varying(255),
    physician_last_name character varying(255),
    comments text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.project_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_number integer,
    collaborator_id uuid,
    disease character varying(255),
    specimen_type character varying(255),
    source character varying(255),
    date_received date,
    feedback_date date,
    comments text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.protocol_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    protocol_id uuid,
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    mime_type character varying(100),
    uploaded_by uuid,
    upload_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    category character varying(100),
    description text
);



CREATE SEQUENCE public.protocol_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.sample_aliquots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    parent_sample_id uuid NOT NULL,
    aliquot_sample_id uuid NOT NULL,
    aliquot_number integer NOT NULL,
    volume_transferred_ml numeric(10,3),
    weight_transferred_mg numeric(10,3),
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    purpose character varying(255)
);



COMMENT ON TABLE public.sample_aliquots IS 'Tracks creation of aliquots and sub-samples for analysis';



CREATE TABLE public.sample_chain_of_custody (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sample_id uuid NOT NULL,
    event_date timestamp without time zone NOT NULL,
    event_type character varying(100) NOT NULL,
    from_person character varying(255),
    to_person character varying(255),
    location character varying(255),
    purpose text,
    signature character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



COMMENT ON TABLE public.sample_chain_of_custody IS 'Regulatory compliance tracking for sample handling';



CREATE VIEW public.sample_inventory_summary AS
 SELECT sample_type,
    anatomical_site,
    count(*) AS total_samples,
    count(
        CASE
            WHEN ((status)::text = 'available'::text) THEN 1
            ELSE NULL::integer
        END) AS available_samples,
    count(
        CASE
            WHEN ((status)::text = 'depleted'::text) THEN 1
            ELSE NULL::integer
        END) AS depleted_samples,
    avg(current_volume_ml) AS avg_volume_ml,
    avg(current_weight_mg) AS avg_weight_mg,
    min(collection_date) AS earliest_collection,
    max(collection_date) AS latest_collection
   FROM public.biological_samples
  GROUP BY sample_type, anatomical_site
  ORDER BY sample_type, anatomical_site;



CREATE TABLE public.sample_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sample_id uuid NOT NULL,
    usage_date timestamp without time zone NOT NULL,
    used_by character varying(255) NOT NULL,
    analysis_type character varying(255),
    volume_used_ml numeric(10,3),
    weight_used_mg numeric(10,3),
    purpose text,
    results_location text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



COMMENT ON TABLE public.sample_usage IS 'Records each use/analysis of biological samples';



CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    checksum character varying(64),
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;



CREATE SEQUENCE public.specimen_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.specimens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    specimen_number integer,
    project_id uuid,
    patient_id uuid,
    tube_id character varying(255),
    extracted boolean DEFAULT false,
    initial_quantity numeric(10,2),
    position_freezer character varying(100),
    position_rack character varying(100),
    position_box character varying(100),
    position_dimension_one character varying(10),
    position_dimension_two character varying(10),
    activity_status character varying(50),
    date_collected date,
    collection_category character varying(255),
    extraction_method character varying(255),
    nucleated_cells text,
    cell_numbers integer,
    percentage_segs numeric(5,2),
    csf_protein numeric(10,2),
    csf_gluc numeric(10,2),
    used_up boolean DEFAULT false,
    specimen_site character varying(255),
    run_number character varying(50),
    comments text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    collection_timepoint character varying(100),
    anatomical_site character varying(100),
    animal_id uuid,
    CONSTRAINT check_metadata_valid CHECK (public.validate_specimen_metadata(metadata))
);



CREATE SEQUENCE public.study_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



CREATE TABLE public.system_options (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category character varying(50) NOT NULL,
    option_key character varying(100) NOT NULL,
    option_value character varying(255) NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE public.weaning_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    litter_id uuid NOT NULL,
    animal_id uuid NOT NULL,
    weaning_date date NOT NULL,
    weaning_weight numeric(6,2),
    weaning_age_days integer,
    health_status character varying(50) DEFAULT 'healthy'::character varying,
    destination character varying(100),
    new_housing_id uuid,
    assigned_to_study_id uuid,
    notes text,
    recorded_by uuid,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);



ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_group_assignments
    ADD CONSTRAINT animal_group_assignments_animal_id_group_id_key UNIQUE (animal_id, group_id);



ALTER TABLE ONLY public.animal_group_assignments
    ADD CONSTRAINT animal_group_assignments_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_group_measurements
    ADD CONSTRAINT animal_group_measurements_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_measurements
    ADD CONSTRAINT animal_measurements_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_observations
    ADD CONSTRAINT animal_observations_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_request_allocations
    ADD CONSTRAINT animal_request_allocations_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_requests
    ADD CONSTRAINT animal_requests_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animal_weights
    ADD CONSTRAINT animal_weights_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.animals
    ADD CONSTRAINT animals_animal_number_key UNIQUE (animal_number);



ALTER TABLE ONLY public.animals
    ADD CONSTRAINT animals_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_sample_barcode_key UNIQUE (sample_barcode);



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_sample_number_key UNIQUE (sample_number);



ALTER TABLE ONLY public.breeding_colonies
    ADD CONSTRAINT breeding_colonies_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.breeding_pairs
    ADD CONSTRAINT breeding_pairs_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.breeding_performance_metrics
    ADD CONSTRAINT breeding_performance_metrics_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.breeding_schedules
    ADD CONSTRAINT breeding_schedules_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_collaborator_number_key UNIQUE (collaborator_number);



ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.experimental_groups
    ADD CONSTRAINT experimental_groups_group_number_key UNIQUE (group_number);



ALTER TABLE ONLY public.experimental_groups
    ADD CONSTRAINT experimental_groups_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.experimental_studies
    ADD CONSTRAINT experimental_studies_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.experimental_studies
    ADD CONSTRAINT experimental_studies_study_number_key UNIQUE (study_number);



ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_experiment_id_key UNIQUE (experiment_id);



ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.extracted_protocol_data
    ADD CONSTRAINT extracted_protocol_data_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.extraction_jobs
    ADD CONSTRAINT extraction_jobs_job_id_key UNIQUE (job_id);



ALTER TABLE ONLY public.extraction_jobs
    ADD CONSTRAINT extraction_jobs_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.genetic_diversity_tracking
    ADD CONSTRAINT genetic_diversity_tracking_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.group_measurements
    ADD CONSTRAINT group_measurements_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.group_treatments
    ADD CONSTRAINT group_treatments_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.housing
    ADD CONSTRAINT housing_housing_number_key UNIQUE (housing_number);



ALTER TABLE ONLY public.housing
    ADD CONSTRAINT housing_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.id_generation_log
    ADD CONSTRAINT id_generation_log_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_category_name_key UNIQUE (category_name);



ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_inventory_id_key UNIQUE (inventory_id);



ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.litters
    ADD CONSTRAINT litters_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.measurement_schedules
    ADD CONSTRAINT measurement_schedules_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.measurement_types
    ADD CONSTRAINT measurement_types_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_patient_number_key UNIQUE (patient_number);



ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_number_key UNIQUE (project_number);



ALTER TABLE ONLY public.protocol_documents
    ADD CONSTRAINT protocol_documents_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_protocol_id_key UNIQUE (protocol_id);



ALTER TABLE ONLY public.sample_aliquots
    ADD CONSTRAINT sample_aliquots_parent_sample_id_aliquot_number_key UNIQUE (parent_sample_id, aliquot_number);



ALTER TABLE ONLY public.sample_aliquots
    ADD CONSTRAINT sample_aliquots_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.sample_chain_of_custody
    ADD CONSTRAINT sample_chain_of_custody_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.sample_usage
    ADD CONSTRAINT sample_usage_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);



ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.specimens
    ADD CONSTRAINT specimens_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.specimens
    ADD CONSTRAINT specimens_specimen_number_key UNIQUE (specimen_number);



ALTER TABLE ONLY public.system_options
    ADD CONSTRAINT system_options_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);



ALTER TABLE ONLY public.weaning_records
    ADD CONSTRAINT weaning_records_pkey PRIMARY KEY (id);



CREATE INDEX animal_measurements_animal_id_idx ON public.animal_measurements USING btree (animal_id);



CREATE INDEX animal_measurements_animal_id_measurement_type_measurement__idx ON public.animal_measurements USING btree (animal_id, measurement_type, measurement_date);



CREATE UNIQUE INDEX animal_measurements_animal_id_measurement_type_measurement__key ON public.animal_measurements USING btree (animal_id, measurement_type, measurement_date);



CREATE INDEX animal_measurements_measurement_date_idx ON public.animal_measurements USING btree (measurement_date);



CREATE INDEX animal_measurements_measurement_type_idx ON public.animal_measurements USING btree (measurement_type);



CREATE INDEX animal_request_allocations_animal_id_idx ON public.animal_request_allocations USING btree (animal_id);



CREATE UNIQUE INDEX animal_request_allocations_request_id_animal_id_key ON public.animal_request_allocations USING btree (request_id, animal_id);



CREATE INDEX animal_request_allocations_request_id_idx ON public.animal_request_allocations USING btree (request_id);



CREATE INDEX animal_requests_needed_by_date_idx ON public.animal_requests USING btree (needed_by_date);



CREATE INDEX animal_requests_priority_idx ON public.animal_requests USING btree (priority);



CREATE UNIQUE INDEX animal_requests_request_number_key ON public.animal_requests USING btree (request_number);



CREATE INDEX animal_requests_requested_by_idx ON public.animal_requests USING btree (requested_by);



CREATE INDEX animal_requests_species_idx ON public.animal_requests USING btree (species);



CREATE INDEX animal_requests_status_idx ON public.animal_requests USING btree (status);



CREATE INDEX breeding_colonies_active_idx ON public.breeding_colonies USING btree (active);



CREATE INDEX breeding_colonies_manager_id_idx ON public.breeding_colonies USING btree (manager_id);



CREATE INDEX breeding_colonies_species_strain_idx ON public.breeding_colonies USING btree (species, strain);



CREATE INDEX breeding_pairs_colony_id_idx ON public.breeding_pairs USING btree (colony_id);



CREATE INDEX breeding_pairs_dam_id_idx ON public.breeding_pairs USING btree (dam_id);



CREATE UNIQUE INDEX breeding_pairs_dam_id_sire_id_key ON public.breeding_pairs USING btree (dam_id, sire_id);



CREATE INDEX breeding_pairs_setup_date_idx ON public.breeding_pairs USING btree (setup_date);



CREATE INDEX breeding_pairs_sire_id_idx ON public.breeding_pairs USING btree (sire_id);



CREATE INDEX breeding_pairs_status_idx ON public.breeding_pairs USING btree (status);



CREATE INDEX breeding_performance_metrics_breeding_pair_id_idx ON public.breeding_performance_metrics USING btree (breeding_pair_id);



CREATE INDEX breeding_performance_metrics_last_calculated_idx ON public.breeding_performance_metrics USING btree (last_calculated);



CREATE INDEX breeding_schedules_assigned_to_idx ON public.breeding_schedules USING btree (assigned_to);



CREATE INDEX breeding_schedules_colony_id_idx ON public.breeding_schedules USING btree (colony_id);



CREATE INDEX breeding_schedules_scheduled_date_idx ON public.breeding_schedules USING btree (scheduled_date);



CREATE INDEX breeding_schedules_scheduled_date_status_idx ON public.breeding_schedules USING btree (scheduled_date, status);



CREATE INDEX breeding_schedules_status_idx ON public.breeding_schedules USING btree (status);



CREATE INDEX genetic_diversity_tracking_analysis_date_idx ON public.genetic_diversity_tracking USING btree (analysis_date);



CREATE INDEX genetic_diversity_tracking_colony_id_idx ON public.genetic_diversity_tracking USING btree (colony_id);



CREATE INDEX idx_animal_group_assignments_animal_id ON public.animal_group_assignments USING btree (animal_id);



CREATE INDEX idx_animal_group_assignments_date ON public.animal_group_assignments USING btree (assignment_date);



CREATE INDEX idx_animal_group_assignments_group_id ON public.animal_group_assignments USING btree (group_id);



CREATE INDEX idx_animal_group_assignments_status ON public.animal_group_assignments USING btree (status);



CREATE INDEX idx_animal_group_measurements_assignment_id ON public.animal_group_measurements USING btree (assignment_id);



CREATE INDEX idx_animal_group_measurements_date ON public.animal_group_measurements USING btree (measurement_date);



CREATE INDEX idx_animal_group_measurements_measurement_id ON public.animal_group_measurements USING btree (measurement_id);



CREATE INDEX idx_animal_observations_animal_id ON public.animal_observations USING btree (animal_id);



CREATE INDEX idx_animal_observations_date ON public.animal_observations USING btree (observation_date);



CREATE INDEX idx_animal_weights_animal_id ON public.animal_weights USING btree (animal_id);



CREATE INDEX idx_animal_weights_date ON public.animal_weights USING btree (measurement_date);



CREATE INDEX idx_animals_animal_number ON public.animals USING btree (animal_number);



CREATE INDEX idx_animals_dam_id ON public.animals USING btree (dam_id);



CREATE INDEX idx_animals_housing_id ON public.animals USING btree (housing_id);



CREATE INDEX idx_animals_number ON public.animals USING btree (animal_number);



CREATE INDEX idx_animals_sex ON public.animals USING btree (sex);



CREATE INDEX idx_animals_sire_id ON public.animals USING btree (sire_id);



CREATE INDEX idx_animals_species ON public.animals USING btree (species);



CREATE INDEX idx_animals_status ON public.animals USING btree (status);



CREATE INDEX idx_animals_strain ON public.animals USING btree (strain);



CREATE INDEX idx_biological_samples_anatomical_site ON public.biological_samples USING btree (anatomical_site);



CREATE INDEX idx_biological_samples_animal_id ON public.biological_samples USING btree (animal_id);



CREATE INDEX idx_biological_samples_animal_type ON public.biological_samples USING btree (animal_id, sample_type);



CREATE INDEX idx_biological_samples_barcode ON public.biological_samples USING btree (sample_barcode);



CREATE INDEX idx_biological_samples_collection_date ON public.biological_samples USING btree (collection_date);



CREATE INDEX idx_biological_samples_metadata_gin ON public.biological_samples USING gin (metadata);



CREATE INDEX idx_biological_samples_number ON public.biological_samples USING btree (sample_number);



CREATE INDEX idx_biological_samples_parent_id ON public.biological_samples USING btree (parent_sample_id);



CREATE INDEX idx_biological_samples_protocol_id ON public.biological_samples USING btree (protocol_id);



CREATE INDEX idx_biological_samples_status ON public.biological_samples USING btree (status);



CREATE INDEX idx_biological_samples_storage ON public.biological_samples USING btree (storage_location, storage_container, storage_position);



CREATE INDEX idx_biological_samples_storage_location ON public.biological_samples USING btree (storage_location);



CREATE INDEX idx_biological_samples_study_id ON public.biological_samples USING btree (study_id);



CREATE INDEX idx_biological_samples_study_timepoint ON public.biological_samples USING btree (study_id, timepoint);



CREATE INDEX idx_biological_samples_timepoint ON public.biological_samples USING btree (timepoint);



CREATE INDEX idx_biological_samples_treatment_group ON public.biological_samples USING btree (treatment_group);



CREATE INDEX idx_biological_samples_type ON public.biological_samples USING btree (sample_type);



CREATE INDEX idx_collaborators_number ON public.collaborators USING btree (collaborator_number);



CREATE INDEX idx_experimental_groups_number ON public.experimental_groups USING btree (group_number);



CREATE INDEX idx_experimental_groups_status ON public.experimental_groups USING btree (status);



CREATE INDEX idx_experimental_groups_study_id ON public.experimental_groups USING btree (study_id);



CREATE INDEX idx_experimental_groups_type ON public.experimental_groups USING btree (group_type);



CREATE INDEX idx_experimental_studies_created_by ON public.experimental_studies USING btree (created_by);



CREATE INDEX idx_experimental_studies_number ON public.experimental_studies USING btree (study_number);



CREATE INDEX idx_experimental_studies_pi ON public.experimental_studies USING btree (principal_investigator);



CREATE INDEX idx_experimental_studies_species ON public.experimental_studies USING btree (species_required);



CREATE INDEX idx_experimental_studies_status ON public.experimental_studies USING btree (status);



CREATE INDEX idx_experiments_sample_ids_gin ON public.experiments USING gin (sample_ids);



CREATE INDEX idx_extracted_protocol_data_job_id ON public.extracted_protocol_data USING btree (extraction_job_id);



CREATE INDEX idx_extraction_jobs_document_id ON public.extraction_jobs USING btree (document_id);



CREATE INDEX idx_extraction_jobs_job_id ON public.extraction_jobs USING btree (job_id);



CREATE INDEX idx_extraction_jobs_status ON public.extraction_jobs USING btree (status);



CREATE INDEX idx_group_measurements_group_id ON public.group_measurements USING btree (group_id);



CREATE INDEX idx_group_treatments_dates ON public.group_treatments USING btree (start_date, end_date);



CREATE INDEX idx_group_treatments_group_id ON public.group_treatments USING btree (group_id);



CREATE INDEX idx_housing_housing_number ON public.housing USING btree (housing_number);



CREATE INDEX idx_housing_location ON public.housing USING btree (location);



CREATE INDEX idx_housing_status ON public.housing USING btree (status);



CREATE INDEX idx_inventory_barcode ON public.inventory USING btree (barcode);



CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);



CREATE INDEX idx_inventory_expiration ON public.inventory USING btree (expiration_date);



CREATE INDEX idx_inventory_id ON public.inventory USING btree (inventory_id);



CREATE INDEX idx_inventory_transactions_date ON public.inventory_transactions USING btree (transaction_date);



CREATE INDEX idx_inventory_transactions_experiment_id ON public.inventory_transactions USING btree (experiment_id);



CREATE INDEX idx_inventory_transactions_inventory_id ON public.inventory_transactions USING btree (inventory_id);



CREATE INDEX idx_patients_number ON public.patients USING btree (patient_number);



CREATE INDEX idx_projects_collaborator_disease ON public.projects USING btree (collaborator_id, disease);



CREATE INDEX idx_projects_collaborator_id ON public.projects USING btree (collaborator_id);



CREATE INDEX idx_projects_comments_gin ON public.projects USING gin (to_tsvector('english'::regconfig, COALESCE(comments, ''::text)));



CREATE INDEX idx_projects_date_received ON public.projects USING btree (date_received);



CREATE INDEX idx_projects_disease ON public.projects USING btree (disease);



CREATE INDEX idx_projects_number ON public.projects USING btree (project_number);



CREATE INDEX idx_projects_specimen_type ON public.projects USING btree (specimen_type);



CREATE INDEX idx_protocol_documents_category ON public.protocol_documents USING btree (category);



CREATE INDEX idx_protocols_id ON public.protocols USING btree (protocol_id);



CREATE INDEX idx_protocols_required_reagents_gin ON public.protocols USING gin (required_reagents);



CREATE INDEX idx_sample_aliquots_aliquot ON public.sample_aliquots USING btree (aliquot_sample_id);



CREATE INDEX idx_sample_aliquots_parent ON public.sample_aliquots USING btree (parent_sample_id);



CREATE INDEX idx_sample_custody_date ON public.sample_chain_of_custody USING btree (event_date);



CREATE INDEX idx_sample_custody_sample_id ON public.sample_chain_of_custody USING btree (sample_id);



CREATE INDEX idx_sample_usage_date ON public.sample_usage USING btree (usage_date);



CREATE INDEX idx_sample_usage_sample_id ON public.sample_usage USING btree (sample_id);



CREATE INDEX idx_specimens_activity_status ON public.specimens USING btree (activity_status);



CREATE INDEX idx_specimens_animal_id ON public.specimens USING btree (animal_id);



CREATE INDEX idx_specimens_comments_gin ON public.specimens USING gin (to_tsvector('english'::regconfig, COALESCE(comments, ''::text)));



CREATE INDEX idx_specimens_date_collected ON public.specimens USING btree (date_collected);



CREATE INDEX idx_specimens_extracted ON public.specimens USING btree (extracted);



CREATE INDEX idx_specimens_metadata_gin ON public.specimens USING gin (metadata);



CREATE INDEX idx_specimens_number ON public.specimens USING btree (specimen_number);



CREATE INDEX idx_specimens_patient_id ON public.specimens USING btree (patient_id);



CREATE INDEX idx_specimens_position_box ON public.specimens USING btree (position_box);



CREATE INDEX idx_specimens_position_freezer ON public.specimens USING btree (position_freezer);



CREATE INDEX idx_specimens_position_rack ON public.specimens USING btree (position_rack);



CREATE INDEX idx_specimens_project_id ON public.specimens USING btree (project_id);



CREATE INDEX idx_specimens_project_specimen_type ON public.specimens USING btree (project_id) INCLUDE (specimen_number);



CREATE INDEX idx_specimens_specimen_site ON public.specimens USING btree (specimen_site);



CREATE INDEX idx_specimens_timepoint ON public.specimens USING btree (collection_timepoint);



CREATE INDEX idx_specimens_tube_id ON public.specimens USING btree (tube_id);



CREATE INDEX idx_specimens_used_up ON public.specimens USING btree (used_up);



CREATE INDEX idx_system_options_category_active ON public.system_options USING btree (category, is_active);



CREATE UNIQUE INDEX idx_system_options_category_key ON public.system_options USING btree (category, option_key);



CREATE INDEX litters_birth_date_idx ON public.litters USING btree (birth_date);



CREATE INDEX litters_breeding_pair_id_idx ON public.litters USING btree (breeding_pair_id);



CREATE INDEX litters_status_idx ON public.litters USING btree (status);



CREATE INDEX measurement_schedules_active_idx ON public.measurement_schedules USING btree (active);



CREATE INDEX measurement_schedules_animal_id_idx ON public.measurement_schedules USING btree (animal_id);



CREATE INDEX measurement_schedules_next_due_date_idx ON public.measurement_schedules USING btree (next_due_date);



CREATE UNIQUE INDEX measurement_types_name_key ON public.measurement_types USING btree (name);



CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at);



CREATE INDEX notifications_read_at_idx ON public.notifications USING btree (read_at);



CREATE INDEX notifications_related_request_id_idx ON public.notifications USING btree (related_request_id);



CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);



CREATE INDEX notifications_user_id_read_at_idx ON public.notifications USING btree (user_id, read_at);



CREATE INDEX weaning_records_animal_id_idx ON public.weaning_records USING btree (animal_id);



CREATE INDEX weaning_records_litter_id_idx ON public.weaning_records USING btree (litter_id);



CREATE INDEX weaning_records_weaning_date_idx ON public.weaning_records USING btree (weaning_date);



CREATE TRIGGER generate_sample_number_trigger BEFORE INSERT ON public.biological_samples FOR EACH ROW EXECUTE FUNCTION public.generate_sample_number();



CREATE TRIGGER log_specimen_metadata_changes AFTER UPDATE ON public.specimens FOR EACH ROW EXECUTE FUNCTION public.log_specimen_metadata_changes();



CREATE TRIGGER trigger_animals_updated_at BEFORE UPDATE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



CREATE TRIGGER trigger_housing_updated_at BEFORE UPDATE ON public.housing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



CREATE TRIGGER trigger_set_animal_number BEFORE INSERT ON public.animals FOR EACH ROW EXECUTE FUNCTION public.set_animal_number();



CREATE TRIGGER trigger_set_housing_number BEFORE INSERT ON public.housing FOR EACH ROW EXECUTE FUNCTION public.set_housing_number();



CREATE TRIGGER update_animal_group_assignments_timestamp BEFORE UPDATE ON public.animal_group_assignments FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_animals_timestamp BEFORE UPDATE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_biological_samples_timestamp BEFORE UPDATE ON public.biological_samples FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_collaborator_timestamp BEFORE UPDATE ON public.collaborators FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_experimental_groups_timestamp BEFORE UPDATE ON public.experimental_groups FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_experimental_studies_timestamp BEFORE UPDATE ON public.experimental_studies FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_experiments_timestamp BEFORE UPDATE ON public.experiments FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_housing_timestamp BEFORE UPDATE ON public.housing FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_inventory_timestamp BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_patient_timestamp BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_project_timestamp BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_protocol_timestamp BEFORE UPDATE ON public.protocols FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_sample_quantities_trigger AFTER INSERT ON public.sample_usage FOR EACH ROW EXECUTE FUNCTION public.update_sample_quantities();



CREATE TRIGGER update_specimen_timestamp BEFORE UPDATE ON public.specimens FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_system_options_timestamp BEFORE UPDATE ON public.system_options FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



CREATE TRIGGER update_user_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();



ALTER TABLE ONLY public.animal_group_assignments
    ADD CONSTRAINT animal_group_assignments_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_group_assignments
    ADD CONSTRAINT animal_group_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.animal_group_assignments
    ADD CONSTRAINT animal_group_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.experimental_groups(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_group_measurements
    ADD CONSTRAINT animal_group_measurements_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.animal_group_assignments(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_group_measurements
    ADD CONSTRAINT animal_group_measurements_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES public.group_measurements(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_measurements
    ADD CONSTRAINT animal_measurements_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_measurements
    ADD CONSTRAINT animal_measurements_measured_by_fkey FOREIGN KEY (measured_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY public.animal_measurements
    ADD CONSTRAINT animal_measurements_measurement_type_fkey FOREIGN KEY (measurement_type) REFERENCES public.measurement_types(name) ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY public.animal_measurements
    ADD CONSTRAINT animal_measurements_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.experimental_studies(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.animal_observations
    ADD CONSTRAINT animal_observations_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_request_allocations
    ADD CONSTRAINT animal_request_allocations_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY public.animal_request_allocations
    ADD CONSTRAINT animal_request_allocations_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_request_allocations
    ADD CONSTRAINT animal_request_allocations_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.animal_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.animal_requests
    ADD CONSTRAINT animal_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY public.animal_requests
    ADD CONSTRAINT animal_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.animal_requests
    ADD CONSTRAINT animal_requests_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.experimental_studies(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.animal_weights
    ADD CONSTRAINT animal_weights_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.animals
    ADD CONSTRAINT animals_dam_id_fkey FOREIGN KEY (dam_id) REFERENCES public.animals(id);



ALTER TABLE ONLY public.animals
    ADD CONSTRAINT animals_housing_id_fkey FOREIGN KEY (housing_id) REFERENCES public.housing(id);



ALTER TABLE ONLY public.animals
    ADD CONSTRAINT animals_sire_id_fkey FOREIGN KEY (sire_id) REFERENCES public.animals(id);



ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_parent_sample_id_fkey FOREIGN KEY (parent_sample_id) REFERENCES public.biological_samples(id);



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.biological_samples
    ADD CONSTRAINT biological_samples_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.experimental_studies(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.breeding_colonies
    ADD CONSTRAINT breeding_colonies_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.breeding_pairs
    ADD CONSTRAINT breeding_pairs_colony_id_fkey FOREIGN KEY (colony_id) REFERENCES public.breeding_colonies(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.breeding_pairs
    ADD CONSTRAINT breeding_pairs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.breeding_pairs
    ADD CONSTRAINT breeding_pairs_dam_id_fkey FOREIGN KEY (dam_id) REFERENCES public.animals(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.breeding_pairs
    ADD CONSTRAINT breeding_pairs_sire_id_fkey FOREIGN KEY (sire_id) REFERENCES public.animals(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.breeding_performance_metrics
    ADD CONSTRAINT breeding_performance_metrics_breeding_pair_id_fkey FOREIGN KEY (breeding_pair_id) REFERENCES public.breeding_pairs(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.breeding_schedules
    ADD CONSTRAINT breeding_schedules_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.breeding_schedules
    ADD CONSTRAINT breeding_schedules_breeding_pair_id_fkey FOREIGN KEY (breeding_pair_id) REFERENCES public.breeding_pairs(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.breeding_schedules
    ADD CONSTRAINT breeding_schedules_colony_id_fkey FOREIGN KEY (colony_id) REFERENCES public.breeding_colonies(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.breeding_schedules
    ADD CONSTRAINT breeding_schedules_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.breeding_schedules
    ADD CONSTRAINT breeding_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.experimental_groups
    ADD CONSTRAINT experimental_groups_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.experimental_studies(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.experimental_studies
    ADD CONSTRAINT experimental_studies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id);



ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



ALTER TABLE ONLY public.extracted_protocol_data
    ADD CONSTRAINT extracted_protocol_data_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.protocol_documents(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.extracted_protocol_data
    ADD CONSTRAINT extracted_protocol_data_extraction_job_id_fkey FOREIGN KEY (extraction_job_id) REFERENCES public.extraction_jobs(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.extracted_protocol_data
    ADD CONSTRAINT extracted_protocol_data_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.extraction_jobs
    ADD CONSTRAINT extraction_jobs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.protocol_documents(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.extraction_jobs
    ADD CONSTRAINT extraction_jobs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.genetic_diversity_tracking
    ADD CONSTRAINT genetic_diversity_tracking_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.genetic_diversity_tracking
    ADD CONSTRAINT genetic_diversity_tracking_colony_id_fkey FOREIGN KEY (colony_id) REFERENCES public.breeding_colonies(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.group_measurements
    ADD CONSTRAINT group_measurements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.experimental_groups(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.group_treatments
    ADD CONSTRAINT group_treatments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.experimental_groups(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.litters
    ADD CONSTRAINT litters_breeding_pair_id_fkey FOREIGN KEY (breeding_pair_id) REFERENCES public.breeding_pairs(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.litters
    ADD CONSTRAINT litters_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.measurement_schedules
    ADD CONSTRAINT measurement_schedules_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.measurement_schedules
    ADD CONSTRAINT measurement_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY public.measurement_schedules
    ADD CONSTRAINT measurement_schedules_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.experimental_studies(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_request_id_fkey FOREIGN KEY (related_request_id) REFERENCES public.animal_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.collaborators(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.protocol_documents
    ADD CONSTRAINT protocol_documents_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.protocol_documents
    ADD CONSTRAINT protocol_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.sample_aliquots
    ADD CONSTRAINT sample_aliquots_aliquot_sample_id_fkey FOREIGN KEY (aliquot_sample_id) REFERENCES public.biological_samples(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.sample_aliquots
    ADD CONSTRAINT sample_aliquots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);



ALTER TABLE ONLY public.sample_aliquots
    ADD CONSTRAINT sample_aliquots_parent_sample_id_fkey FOREIGN KEY (parent_sample_id) REFERENCES public.biological_samples(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.sample_chain_of_custody
    ADD CONSTRAINT sample_chain_of_custody_sample_id_fkey FOREIGN KEY (sample_id) REFERENCES public.biological_samples(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.sample_usage
    ADD CONSTRAINT sample_usage_sample_id_fkey FOREIGN KEY (sample_id) REFERENCES public.biological_samples(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.specimens
    ADD CONSTRAINT specimens_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id);



ALTER TABLE ONLY public.specimens
    ADD CONSTRAINT specimens_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.specimens
    ADD CONSTRAINT specimens_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.weaning_records
    ADD CONSTRAINT weaning_records_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.weaning_records
    ADD CONSTRAINT weaning_records_assigned_to_study_id_fkey FOREIGN KEY (assigned_to_study_id) REFERENCES public.experimental_studies(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.weaning_records
    ADD CONSTRAINT weaning_records_litter_id_fkey FOREIGN KEY (litter_id) REFERENCES public.litters(id) ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY public.weaning_records
    ADD CONSTRAINT weaning_records_new_housing_id_fkey FOREIGN KEY (new_housing_id) REFERENCES public.housing(id) ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY public.weaning_records
    ADD CONSTRAINT weaning_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;




