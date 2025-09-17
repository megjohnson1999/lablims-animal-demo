-- Migration: Add animal requests system
-- Description: Adds tables for research-driven animal request workflow
-- Created: 2025-09-17

-- Main animal requests table - researchers specify what they need
CREATE TABLE IF NOT EXISTS animal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number INTEGER UNIQUE, -- Auto-generated request ID for tracking
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_id UUID REFERENCES experimental_studies(id) ON DELETE SET NULL,

  -- REQUEST DETAILS
  title VARCHAR(255) NOT NULL, -- "Treatment group animals for cardio study"
  description TEXT, -- Detailed explanation of use
  justification TEXT NOT NULL, -- Why these specific animals are needed

  -- ANIMAL SPECIFICATIONS
  species VARCHAR(255) NOT NULL, -- Required species
  strain VARCHAR(255), -- Preferred strain (can be flexible)
  strain_alternatives TEXT[], -- Array of acceptable alternative strains
  sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'any')), -- Required sex or 'any'
  genotype VARCHAR(500), -- Required genotype
  genotype_alternatives TEXT[], -- Array of acceptable alternative genotypes

  -- QUANTITY AND AGE REQUIREMENTS
  quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
  min_age_days INTEGER, -- Minimum age in days
  max_age_days INTEGER, -- Maximum age in days
  age_flexibility BOOLEAN DEFAULT FALSE, -- Can accept slightly outside age range

  -- TIMELINE
  needed_by_date DATE NOT NULL, -- When animals are needed
  flexible_date BOOLEAN DEFAULT FALSE, -- Can accept later date if needed
  duration_days INTEGER, -- How long animals will be used (for planning)

  -- HOUSING PREFERENCES
  housing_requirements TEXT, -- Special housing needs
  group_housing BOOLEAN DEFAULT TRUE, -- Can animals be group housed

  -- REQUEST STATUS AND PROCESSING
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN (
    'submitted',    -- Initial submission
    'reviewing',    -- Being reviewed by facility manager
    'partially_fulfilled', -- Some but not all animals allocated
    'fulfilled',    -- All animals allocated
    'waitlisted',   -- No animals available, on waitlist
    'cancelled',    -- Cancelled by researcher
    'denied'        -- Denied by facility manager
  )),

  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- REVIEW AND APPROVAL
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- FULFILLMENT TRACKING
  quantity_allocated INTEGER DEFAULT 0, -- How many have been allocated
  quantity_received INTEGER DEFAULT 0, -- How many researcher has actually received
  fully_fulfilled_at TIMESTAMP, -- When request was completely fulfilled

  -- WAITLIST INFORMATION
  waitlist_position INTEGER, -- Position in waitlist for this animal type
  estimated_availability DATE, -- Facility manager's estimate of when available
  auto_fulfill BOOLEAN DEFAULT TRUE, -- Automatically fulfill when animals become available

  -- METADATA
  internal_notes TEXT, -- For facility manager notes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track individual animal allocations to requests
CREATE TABLE IF NOT EXISTS animal_request_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES animal_requests(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  allocated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- DELIVERY STATUS
  status VARCHAR(20) DEFAULT 'allocated' CHECK (status IN (
    'allocated',   -- Animal assigned to request
    'delivered',   -- Animal delivered to researcher
    'returned',    -- Animal returned to facility
    'cancelled'    -- Allocation cancelled
  )),

  delivered_at TIMESTAMP,
  returned_at TIMESTAMP,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one animal can only be allocated to one active request
  UNIQUE(animal_id, request_id)
);

-- Track request status changes for audit trail
CREATE TABLE IF NOT EXISTS animal_request_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES animal_requests(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_reason TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications/alerts for request updates
CREATE TABLE IF NOT EXISTS animal_request_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES animal_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'availability', 'partial_fulfillment', 'status_change', etc.
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================================
-- FUNCTIONS AND TRIGGERS
-- ================================================================================

-- Function to generate request numbers
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(request_number), 0) + 1 INTO next_number FROM animal_requests;
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request numbers
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL THEN
        NEW.request_number := generate_request_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_request_number ON animal_requests;
CREATE TRIGGER trigger_set_request_number
    BEFORE INSERT ON animal_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_request_number();

-- Function to update request quantities when allocations change
CREATE OR REPLACE FUNCTION update_request_quantities()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE animal_requests
        SET
            quantity_allocated = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = NEW.request_id
                AND status IN ('allocated', 'delivered')
            ),
            quantity_received = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = NEW.request_id
                AND status = 'delivered'
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.request_id;

        -- Update status if fully fulfilled
        UPDATE animal_requests
        SET
            status = 'fulfilled',
            fully_fulfilled_at = CURRENT_TIMESTAMP
        WHERE id = NEW.request_id
        AND quantity_allocated >= quantity_requested
        AND status != 'fulfilled';

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE animal_requests
        SET
            quantity_allocated = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = OLD.request_id
                AND status IN ('allocated', 'delivered')
            ),
            quantity_received = (
                SELECT COUNT(*)
                FROM animal_request_allocations
                WHERE request_id = OLD.request_id
                AND status = 'delivered'
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.request_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_request_quantities ON animal_request_allocations;
CREATE TRIGGER trigger_update_request_quantities
    AFTER INSERT OR UPDATE OR DELETE ON animal_request_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_request_quantities();

-- Function to record status changes
CREATE OR REPLACE FUNCTION record_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO animal_request_status_history (
            request_id,
            previous_status,
            new_status,
            changed_by,
            change_reason
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.reviewed_by, -- Could be enhanced to track actual user making change
            'Status updated'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_status_change ON animal_requests;
CREATE TRIGGER trigger_record_status_change
    AFTER UPDATE ON animal_requests
    FOR EACH ROW
    EXECUTE FUNCTION record_status_change();

-- ================================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================================

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_animal_requests_requested_by ON animal_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_animal_requests_study_id ON animal_requests(study_id);
CREATE INDEX IF NOT EXISTS idx_animal_requests_status ON animal_requests(status);
CREATE INDEX IF NOT EXISTS idx_animal_requests_species_strain ON animal_requests(species, strain);
CREATE INDEX IF NOT EXISTS idx_animal_requests_needed_by_date ON animal_requests(needed_by_date);
CREATE INDEX IF NOT EXISTS idx_animal_requests_created_at ON animal_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_animal_request_allocations_request_id ON animal_request_allocations(request_id);
CREATE INDEX IF NOT EXISTS idx_animal_request_allocations_animal_id ON animal_request_allocations(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_request_allocations_status ON animal_request_allocations(status);

CREATE INDEX IF NOT EXISTS idx_animal_request_notifications_user_id ON animal_request_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_animal_request_notifications_read_at ON animal_request_notifications(read_at);