-- Basic sample data for animal claiming system testing
-- Only creates animals and housing - avoids complex dependencies

-- Create basic housing units if they don't exist
INSERT INTO housing (id, housing_number, location, cage_type, capacity, current_occupancy, status) VALUES
(gen_random_uuid(), 'A-101', 'Building A, Room 101', 'standard', 4, 2, 'active'),
(gen_random_uuid(), 'A-102', 'Building A, Room 101', 'standard', 4, 0, 'active'),
(gen_random_uuid(), 'B-201', 'Building B, Room 201', 'standard', 6, 4, 'active'),
(gen_random_uuid(), 'C-301', 'Building C, Room 301', 'rack_system', 20, 8, 'active')
ON CONFLICT DO NOTHING;

-- Create sample animals with different availability statuses
INSERT INTO animals (animal_number, species, strain, sex, birth_date, source, genotype, status, availability_status, identification_method, identification_number, vendor, arrival_date, notes) VALUES
-- Available C57BL/6J mice
(1001, 'Mus musculus', 'C57BL/6J', 'F', '2024-12-15', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1001', 'Jackson Labs', '2025-01-05', 'Young female, good for breeding or research'),
(1002, 'Mus musculus', 'C57BL/6J', 'M', '2024-12-15', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1002', 'Jackson Labs', '2025-01-05', 'Young male, excellent health'),
(1003, 'Mus musculus', 'C57BL/6J', 'F', '2024-11-20', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1003', 'Jackson Labs', '2024-12-10', 'Mature female, proven breeder'),
(1004, 'Mus musculus', 'C57BL/6J', 'M', '2024-11-20', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1004', 'Jackson Labs', '2024-12-10', 'Mature male, good temperament'),

-- BALB/c mice (some available, some claimed)
(1005, 'Mus musculus', 'BALB/c', 'F', '2025-01-10', 'Charles River Labs', 'Wild type', 'active', 'available', 'microchip', 'MC-1005', 'Charles River', '2025-02-01', 'Young female, immunocompetent'),
(1006, 'Mus musculus', 'BALB/c', 'M', '2025-01-10', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'microchip', 'MC-1006', 'Charles River', '2025-02-01', 'Claimed for cancer study'),
(1007, 'Mus musculus', 'BALB/c', 'F', '2025-01-10', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'microchip', 'MC-1007', 'Charles River', '2025-02-01', 'Claimed for cancer study'),

-- FVB/NJ mice (transgenic strain)  
(1008, 'Mus musculus', 'FVB/NJ', 'F', '2024-12-01', 'The Jackson Laboratory', 'Tg(MMTV-PyMT)', 'active', 'available', 'ear_tag', 'ET-1008', 'Jackson Labs', '2025-01-15', 'PyMT transgenic, for tumor studies'),
(1009, 'Mus musculus', 'FVB/NJ', 'M', '2024-12-01', 'The Jackson Laboratory', 'Tg(MMTV-PyMT)', 'active', 'available', 'ear_tag', 'ET-1009', 'Jackson Labs', '2025-01-15', 'PyMT transgenic, for breeding'),

-- NOD/SCID mice (immunodeficient)
(1010, 'Mus musculus', 'NOD/SCID', 'F', '2025-01-20', 'The Jackson Laboratory', 'Prkdc(scid) Il2rg(null)', 'active', 'available', 'ear_tag', 'ET-1010', 'Jackson Labs', '2025-02-10', 'Immunodeficient, for xenograft studies'),
(1011, 'Mus musculus', 'NOD/SCID', 'M', '2025-01-20', 'The Jackson Laboratory', 'Prkdc(scid) Il2rg(null)', 'active', 'reserved', 'ear_tag', 'ET-1011', 'Jackson Labs', '2025-02-10', 'Reserved for upcoming xenograft study'),

-- Sprague Dawley rats
(1012, 'Rattus norvegicus', 'Sprague Dawley', 'F', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1012', 'Charles River', '2024-12-20', 'Young female rat, metabolic studies'),
(1013, 'Rattus norvegicus', 'Sprague Dawley', 'M', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1013', 'Charles River', '2024-12-20', 'Young male rat, cardiovascular studies'),
(1014, 'Rattus norvegicus', 'Sprague Dawley', 'F', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'ear_tag', 'ET-1014', 'Charles River', '2024-12-20', 'Claimed for metabolic syndrome study'),
(1015, 'Rattus norvegicus', 'Sprague Dawley', 'M', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'ear_tag', 'ET-1015', 'Charles River', '2024-12-20', 'Claimed for metabolic syndrome study'),

-- Wistar rats
(1016, 'Rattus norvegicus', 'Wistar', 'F', '2024-12-10', 'Envigo', 'Wild type', 'active', 'available', 'tattoo', 'TT-1016', 'Envigo', '2025-01-12', 'Young female, behavioral studies'),
(1017, 'Rattus norvegicus', 'Wistar', 'M', '2024-12-10', 'Envigo', 'Wild type', 'active', 'available', 'tattoo', 'TT-1017', 'Envigo', '2025-01-12', 'Young male, behavioral studies'),

-- Breeding pairs (not available for claiming)
(1018, 'Mus musculus', 'C57BL/6J', 'F', '2024-10-01', 'The Jackson Laboratory', 'Wild type', 'active', 'breeding', 'ear_tag', 'ET-1018', 'Jackson Labs', '2024-11-01', 'Proven breeder female'),
(1019, 'Mus musculus', 'C57BL/6J', 'M', '2024-10-01', 'The Jackson Laboratory', 'Wild type', 'active', 'breeding', 'ear_tag', 'ET-1019', 'Jackson Labs', '2024-11-01', 'Proven breeder male'),

-- Retired/older animals
(1020, 'Mus musculus', 'C57BL/6J', 'F', '2023-08-15', 'The Jackson Laboratory', 'Wild type', 'active', 'retired', 'ear_tag', 'ET-1020', 'Jackson Labs', '2023-09-10', 'Retired breeder, over 18 months old')

ON CONFLICT (animal_number) DO NOTHING;