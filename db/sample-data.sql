-- Sample data for Animal LIMS claiming system development and testing
-- This populates realistic test data for animals, housing, studies, and users

-- ================================================================================
-- SAMPLE USERS (for testing different roles)
-- ================================================================================

-- Create sample users if they don't exist (passwords are "test123")
INSERT INTO users (id, username, password, email, first_name, last_name, role, active) VALUES
('11111111-1111-1111-1111-111111111111', 'admin', '$2a$10$CwTycUXWue0Thq9StjUM0uBUxCJ7Z4fLU.6U7JE1K3s1gqO0ZB3kq', 'admin@lab.edu', 'Admin', 'User', 'admin', true),
('22222222-2222-2222-2222-222222222222', 'facility_mgr', '$2a$10$CwTycUXWue0Thq9StjUM0uBUxCJ7Z4fLU.6U7JE1K3s1gqO0ZB3kq', 'facility@lab.edu', 'Jane', 'Manager', 'facility_manager', true),
('33333333-3333-3333-3333-333333333333', 'dr_smith', '$2a$10$CwTycUXWue0Thq9StjUM0uBUxCJ7Z4fLU.6U7JE1K3s1gqO0ZB3kq', 'jsmith@lab.edu', 'John', 'Smith', 'researcher', true),
('44444444-4444-4444-4444-444444444444', 'dr_johnson', '$2a$10$CwTycUXWue0Thq9StjUM0uBUxCJ7Z4fLU.6U7JE1K3s1gqO0ZB3kq', 'mjohnson@lab.edu', 'Mary', 'Johnson', 'researcher', true),
('55555555-5555-5555-5555-555555555555', 'technician1', '$2a$10$CwTycUXWue0Thq9StjUM0uBUxCJ7Z4fLU.6U7JE1K3s1gqO0ZB3kq', 'tech@lab.edu', 'Mike', 'Tech', 'technician', true),
('66666666-6666-6666-6666-666666666666', 'vet_brown', '$2a$10$CwTycUXWue0Thq9StjUM0uBUxCJ7Z4fLU.6U7JE1K3s1gqO0ZB3kq', 'vbrown@lab.edu', 'Sarah', 'Brown', 'veterinarian', true)
ON CONFLICT (username) DO NOTHING;

-- ================================================================================
-- SAMPLE HOUSING UNITS
-- ================================================================================

-- Create sample housing units
INSERT INTO housing (id, housing_number, location, cage_type, capacity, current_occupancy, status, environmental_conditions, notes) VALUES
('a1111111-1111-1111-1111-111111111111', 'A-101', 'Building A, Room 101', 'standard', 4, 2, 'active', 'Temperature: 72°F, Humidity: 45%', 'Standard mouse housing'),
('a1111111-1111-1111-1111-111111111112', 'A-102', 'Building A, Room 101', 'standard', 4, 0, 'active', 'Temperature: 72°F, Humidity: 45%', 'Available for new arrivals'),
('a1111111-1111-1111-1111-111111111113', 'A-103', 'Building A, Room 101', 'breeding', 2, 2, 'active', 'Temperature: 72°F, Humidity: 50%', 'Breeding pair housing'),
('a1111111-1111-1111-1111-111111111114', 'B-201', 'Building B, Room 201', 'standard', 6, 4, 'active', 'Temperature: 68°F, Humidity: 40%', 'Rat housing unit'),
('a1111111-1111-1111-1111-111111111115', 'B-202', 'Building B, Room 201', 'isolation', 1, 0, 'active', 'Temperature: 72°F, Humidity: 45%', 'Quarantine/isolation unit'),
('a1111111-1111-1111-1111-111111111116', 'C-301', 'Building C, Room 301', 'rack_system', 20, 8, 'active', 'Temperature: 70°F, Humidity: 50%', 'Large capacity mouse rack')
ON CONFLICT (id) DO NOTHING;

-- ================================================================================
-- SAMPLE EXPERIMENTAL STUDIES
-- ================================================================================

-- Create sample experimental studies
INSERT INTO experimental_studies (id, study_number, study_name, description, principal_investigator, status, study_type, objective, start_date, planned_end_date, iacuc_protocol_number, species_required, total_animals_planned) VALUES
('s1111111-1111-1111-1111-111111111111', 101, 'Cancer Treatment Efficacy Study', 'Testing novel chemotherapy compounds in mouse models', 'Dr. John Smith', 'active', 'Treatment Study', 'Evaluate efficacy of compound XYZ-123 in reducing tumor burden', '2025-01-15', '2025-12-15', 'IACUC-2025-001', 'Mus musculus', 40),
('s1111111-1111-1111-1111-111111111112', 102, 'Behavioral Assessment Study', 'Evaluating cognitive function in aged mice', 'Dr. Mary Johnson', 'active', 'Behavioral Study', 'Assess memory and learning in aging mouse models', '2025-02-01', '2025-08-01', 'IACUC-2025-002', 'Mus musculus', 24),
('s1111111-1111-1111-1111-111111111113', 103, 'Metabolic Syndrome Research', 'Diet-induced obesity and diabetes prevention', 'Dr. John Smith', 'planning', 'Metabolic Study', 'Test preventive interventions for metabolic syndrome', '2025-03-01', '2025-11-01', 'IACUC-2025-003', 'Rattus norvegicus', 32),
('s1111111-1111-1111-1111-111111111114', 104, 'Cardiovascular Disease Model', 'Studying heart disease progression and treatment', 'Dr. Mary Johnson', 'recruiting', 'Disease Model', 'Develop and validate cardiovascular disease model', '2025-04-01', '2025-12-31', 'IACUC-2025-004', 'Mus musculus', 28)
ON CONFLICT (study_number) DO NOTHING;

-- ================================================================================
-- SAMPLE ANIMALS
-- ================================================================================

-- Create sample animals with variety of species, strains, and availability statuses
INSERT INTO animals (id, animal_number, species, strain, sex, birth_date, source, genotype, housing_id, status, availability_status, identification_method, identification_number, vendor, arrival_date, notes) VALUES
-- Available C57BL/6J mice (available for claiming)
('10000001-0000-0000-0000-000000000001', 1001, 'Mus musculus', 'C57BL/6J', 'F', '2024-12-15', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111111', 'active', 'available', 'ear_tag', 'ET-1001', 'Jackson Labs', '2025-01-05', 'Young female, good for breeding or research'),
('10000001-0000-0000-0000-000000000002', 1002, 'Mus musculus', 'C57BL/6J', 'M', '2024-12-15', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111111', 'active', 'available', 'ear_tag', 'ET-1002', 'Jackson Labs', '2025-01-05', 'Young male, excellent health'),
('10000001-0000-0000-0000-000000000003', 1003, 'Mus musculus', 'C57BL/6J', 'F', '2024-11-20', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111112', 'active', 'available', 'ear_tag', 'ET-1003', 'Jackson Labs', '2024-12-10', 'Mature female, proven breeder'),
('10000001-0000-0000-0000-000000000004', 1004, 'Mus musculus', 'C57BL/6J', 'M', '2024-11-20', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111112', 'active', 'available', 'ear_tag', 'ET-1004', 'Jackson Labs', '2024-12-10', 'Mature male, good temperament'),

-- BALB/c mice (some available, some claimed)
('10000001-0000-0000-0000-000000000005', 1005, 'Mus musculus', 'BALB/c', 'F', '2025-01-10', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111116', 'active', 'available', 'microchip', 'MC-1005', 'Charles River', '2025-02-01', 'Young female, immunocompetent'),
('10000001-0000-0000-0000-000000000006', 1006, 'Mus musculus', 'BALB/c', 'M', '2025-01-10', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111116', 'active', 'claimed', 'microchip', 'MC-1006', 'Charles River', '2025-02-01', 'Claimed for cancer study'),
('10000001-0000-0000-0000-000000000007', 1007, 'Mus musculus', 'BALB/c', 'F', '2025-01-10', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111116', 'active', 'claimed', 'microchip', 'MC-1007', 'Charles River', '2025-02-01', 'Claimed for cancer study'),

-- FVB/NJ mice (transgenic strain)
('10000001-0000-0000-0000-000000000008', 1008, 'Mus musculus', 'FVB/NJ', 'F', '2024-12-01', 'The Jackson Laboratory', 'Tg(MMTV-PyMT)', 'a1111111-1111-1111-1111-111111111116', 'active', 'available', 'ear_tag', 'ET-1008', 'Jackson Labs', '2025-01-15', 'PyMT transgenic, for tumor studies'),
('10000001-0000-0000-0000-000000000009', 1009, 'Mus musculus', 'FVB/NJ', 'M', '2024-12-01', 'The Jackson Laboratory', 'Tg(MMTV-PyMT)', 'a1111111-1111-1111-1111-111111111116', 'active', 'available', 'ear_tag', 'ET-1009', 'Jackson Labs', '2025-01-15', 'PyMT transgenic, for breeding'),

-- NOD/SCID mice (immunodeficient)
('10000001-0000-0000-0000-000000000010', 1010, 'Mus musculus', 'NOD/SCID', 'F', '2025-01-20', 'The Jackson Laboratory', 'Prkdc(scid) Il2rg(null)', 'a1111111-1111-1111-1111-111111111116', 'active', 'available', 'ear_tag', 'ET-1010', 'Jackson Labs', '2025-02-10', 'Immunodeficient, for xenograft studies'),
('10000001-0000-0000-0000-000000000011', 1011, 'Mus musculus', 'NOD/SCID', 'M', '2025-01-20', 'The Jackson Laboratory', 'Prkdc(scid) Il2rg(null)', 'a1111111-1111-1111-1111-111111111116', 'active', 'reserved', 'ear_tag', 'ET-1011', 'Jackson Labs', '2025-02-10', 'Reserved for upcoming xenograft study'),

-- Sprague Dawley rats
('10000001-0000-0000-0000-000000000012', 1012, 'Rattus norvegicus', 'Sprague Dawley', 'F', '2024-11-15', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111114', 'active', 'available', 'ear_tag', 'ET-1012', 'Charles River', '2024-12-20', 'Young female rat, metabolic studies'),
('10000001-0000-0000-0000-000000000013', 1013, 'Rattus norvegicus', 'Sprague Dawley', 'M', '2024-11-15', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111114', 'active', 'available', 'ear_tag', 'ET-1013', 'Charles River', '2024-12-20', 'Young male rat, cardiovascular studies'),
('10000001-0000-0000-0000-000000000014', 1014, 'Rattus norvegicus', 'Sprague Dawley', 'F', '2024-11-15', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111114', 'active', 'claimed', 'ear_tag', 'ET-1014', 'Charles River', '2024-12-20', 'Claimed for metabolic syndrome study'),
('10000001-0000-0000-0000-000000000015', 1015, 'Rattus norvegicus', 'Sprague Dawley', 'M', '2024-11-15', 'Charles River Labs', 'Wild type', 'a1111111-1111-1111-1111-111111111114', 'active', 'claimed', 'ear_tag', 'ET-1015', 'Charles River', '2024-12-20', 'Claimed for metabolic syndrome study'),

-- Wistar rats
('10000001-0000-0000-0000-000000000016', 1016, 'Rattus norvegicus', 'Wistar', 'F', '2024-12-10', 'Envigo', 'Wild type', 'a1111111-1111-1111-1111-111111111116', 'active', 'available', 'tattoo', 'TT-1016', 'Envigo', '2025-01-12', 'Young female, behavioral studies'),
('10000001-0000-0000-0000-000000000017', 1017, 'Rattus norvegicus', 'Wistar', 'M', '2024-12-10', 'Envigo', 'Wild type', 'a1111111-1111-1111-1111-111111111116', 'active', 'available', 'tattoo', 'TT-1017', 'Envigo', '2025-01-12', 'Young male, behavioral studies'),

-- Breeding pairs (not available for claiming)
('10000001-0000-0000-0000-000000000018', 1018, 'Mus musculus', 'C57BL/6J', 'F', '2024-10-01', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111113', 'active', 'breeding', 'ear_tag', 'ET-1018', 'Jackson Labs', '2024-11-01', 'Proven breeder female'),
('10000001-0000-0000-0000-000000000019', 1019, 'Mus musculus', 'C57BL/6J', 'M', '2024-10-01', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111113', 'active', 'breeding', 'ear_tag', 'ET-1019', 'Jackson Labs', '2024-11-01', 'Proven breeder male'),

-- Retired/older animals
('10000001-0000-0000-0000-000000000020', 1020, 'Mus musculus', 'C57BL/6J', 'F', '2023-08-15', 'The Jackson Laboratory', 'Wild type', 'a1111111-1111-1111-1111-111111111116', 'active', 'retired', 'ear_tag', 'ET-1020', 'Jackson Labs', '2023-09-10', 'Retired breeder, over 18 months old')

ON CONFLICT (animal_number) DO NOTHING;

-- ================================================================================
-- SAMPLE ANIMAL CLAIMS (some pending, some approved)
-- ================================================================================

-- Create some sample animal claims to test the workflow
INSERT INTO animal_claims (id, animal_id, requested_by, study_id, status, justification, requested_at, reviewed_by, reviewed_at, review_notes) VALUES
-- Approved claim
('c1111111-1111-1111-1111-111111111111', '10000001-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 's1111111-1111-1111-1111-111111111111', 'approved', 'Need BALB/c male for tumor transplantation experiments in cancer study. This strain is required for our IACUC protocol.', '2025-09-10 10:00:00', '22222222-2222-2222-2222-222222222222', '2025-09-10 14:30:00', 'Approved - appropriate strain for study protocol'),

-- Another approved claim
('c1111111-1111-1111-1111-111111111112', '10000001-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 's1111111-1111-1111-1111-111111111111', 'approved', 'Need second BALB/c female for tumor transplantation control group in cancer study.', '2025-09-10 10:15:00', '22222222-2222-2222-2222-222222222222', '2025-09-10 14:35:00', 'Approved - matches study requirements'),

-- Pending claims (waiting for approval)
('c1111111-1111-1111-1111-111111111113', '10000001-0000-0000-0000-000000000012', '44444444-4444-4444-4444-444444444444', 's1111111-1111-1111-1111-111111111113', 'pending', 'Request Sprague Dawley female for metabolic syndrome diet study. Need young female for baseline measurements and longitudinal tracking.', '2025-09-14 09:30:00', NULL, NULL, NULL),

('c1111111-1111-1111-1111-111111111114', '10000001-0000-0000-0000-000000000013', '44444444-4444-4444-4444-444444444444', 's1111111-1111-1111-1111-111111111113', 'pending', 'Request Sprague Dawley male to pair with female for metabolic study breeding colony.', '2025-09-14 09:35:00', NULL, NULL, NULL),

-- Denied claim (example)
('c1111111-1111-1111-1111-111111111115', '10000001-0000-0000-0000-000000000018', '44444444-4444-4444-4444-444444444444', 's1111111-1111-1111-1111-111111111112', 'denied', 'Request breeding female for behavioral study setup.', '2025-09-12 11:00:00', '22222222-2222-2222-2222-222222222222', '2025-09-12 16:00:00', 'Denied - Animal is actively breeding and cannot be reassigned')

ON CONFLICT (id) DO NOTHING;

-- ================================================================================
-- UPDATE CLAIMED ANIMALS STATUS
-- ================================================================================

-- Update the availability status for animals that have approved claims
UPDATE animals SET availability_status = 'claimed' 
WHERE id IN (
    SELECT animal_id FROM animal_claims 
    WHERE status = 'approved'
);

-- ================================================================================
-- SUMMARY REPORT
-- ================================================================================

-- This will show what was created
SELECT 
    'Sample Data Summary' as report_type,
    (SELECT COUNT(*) FROM users WHERE role != 'admin') as sample_users,
    (SELECT COUNT(*) FROM housing) as housing_units,
    (SELECT COUNT(*) FROM experimental_studies) as studies,
    (SELECT COUNT(*) FROM animals) as total_animals,
    (SELECT COUNT(*) FROM animals WHERE availability_status = 'available') as available_animals,
    (SELECT COUNT(*) FROM animals WHERE availability_status = 'claimed') as claimed_animals,
    (SELECT COUNT(*) FROM animal_claims) as total_claims,
    (SELECT COUNT(*) FROM animal_claims WHERE status = 'pending') as pending_claims;