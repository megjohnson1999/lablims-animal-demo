-- Basic sample data for animal claiming system testing
-- Only creates animals and housing - avoids complex dependencies

-- Create basic housing units (individual cages) if they don't exist
INSERT INTO housing (id, housing_number, location, cage_type, capacity, current_occupancy, status) VALUES
-- Mouse cages in Room 101
(gen_random_uuid(), 'Cage-A101-01', 'Room 101, Rack A', 'mouse_cage', 5, 2, 'active'),
(gen_random_uuid(), 'Cage-A101-02', 'Room 101, Rack A', 'mouse_cage', 5, 0, 'active'),
(gen_random_uuid(), 'Cage-A101-03', 'Room 101, Rack A', 'mouse_cage', 5, 4, 'active'),
(gen_random_uuid(), 'Cage-A101-04', 'Room 101, Rack A', 'mouse_cage', 5, 1, 'active'),
-- Breeding cages in Room 102
(gen_random_uuid(), 'Cage-A102-B1', 'Room 102, Breeding Area', 'breeding_cage', 3, 2, 'active'),
(gen_random_uuid(), 'Cage-A102-B2', 'Room 102, Breeding Area', 'breeding_cage', 3, 0, 'active'),
-- Rat cages in Room 201
(gen_random_uuid(), 'Cage-B201-01', 'Room 201, Rack B', 'rat_cage', 2, 1, 'active'),
(gen_random_uuid(), 'Cage-B201-02', 'Room 201, Rack B', 'rat_cage', 2, 2, 'active'),
(gen_random_uuid(), 'Cage-B201-03', 'Room 201, Rack B', 'rat_cage', 2, 0, 'active'),
-- Isolation cages
(gen_random_uuid(), 'Cage-ISO-01', 'Room 105, Isolation Unit', 'isolation_cage', 1, 0, 'active'),
(gen_random_uuid(), 'Cage-ISO-02', 'Room 105, Isolation Unit', 'isolation_cage', 1, 1, 'active')
ON CONFLICT DO NOTHING;

-- Create sample animals with different availability statuses
INSERT INTO animals (animal_number, species, strain, sex, birth_date, source, genotype, status, availability_status, identification_method, identification_number, vendor, arrival_date, notes) VALUES
-- Available C57BL/6J mice
(1001, 'Mus musculus', 'C57BL/6J', 'F', '2024-12-15', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1001', 'Jackson Labs', '2025-01-05', 'Young female in Cage A101-01, good for breeding or research'),
(1002, 'Mus musculus', 'C57BL/6J', 'M', '2024-12-15', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1002', 'Jackson Labs', '2025-01-05', 'Young male in Cage A101-02, excellent health'),
(1003, 'Mus musculus', 'C57BL/6J', 'F', '2024-11-20', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1003', 'Jackson Labs', '2024-12-10', 'Mature female in Cage A101-03, proven breeder'),
(1004, 'Mus musculus', 'C57BL/6J', 'M', '2024-11-20', 'The Jackson Laboratory', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1004', 'Jackson Labs', '2024-12-10', 'Mature male in Cage A101-04, good temperament'),

-- BALB/c mice (some available, some claimed)
(1005, 'Mus musculus', 'BALB/c', 'F', '2025-01-10', 'Charles River Labs', 'Wild type', 'active', 'available', 'microchip', 'MC-1005', 'Charles River', '2025-02-01', 'Young female in Cage A101-01, immunocompetent'),
(1006, 'Mus musculus', 'BALB/c', 'M', '2025-01-10', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'microchip', 'MC-1006', 'Charles River', '2025-02-01', 'In Cage A101-02, claimed for cancer study'),
(1007, 'Mus musculus', 'BALB/c', 'F', '2025-01-10', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'microchip', 'MC-1007', 'Charles River', '2025-02-01', 'In Cage A101-03, claimed for cancer study'),

-- FVB/NJ mice (transgenic strain)  
(1008, 'Mus musculus', 'FVB/NJ', 'F', '2024-12-01', 'The Jackson Laboratory', 'Tg(MMTV-PyMT)', 'active', 'available', 'ear_tag', 'ET-1008', 'Jackson Labs', '2025-01-15', 'In Cage A101-04, PyMT transgenic for tumor studies'),
(1009, 'Mus musculus', 'FVB/NJ', 'M', '2024-12-01', 'The Jackson Laboratory', 'Tg(MMTV-PyMT)', 'active', 'available', 'ear_tag', 'ET-1009', 'Jackson Labs', '2025-01-15', 'In Cage A102-B1, PyMT transgenic for breeding'),

-- NOD/SCID mice (immunodeficient)
(1010, 'Mus musculus', 'NOD/SCID', 'F', '2025-01-20', 'The Jackson Laboratory', 'Prkdc(scid) Il2rg(null)', 'active', 'available', 'ear_tag', 'ET-1010', 'Jackson Labs', '2025-02-10', 'In Cage ISO-01, immunodeficient for xenograft studies'),
(1011, 'Mus musculus', 'NOD/SCID', 'M', '2025-01-20', 'The Jackson Laboratory', 'Prkdc(scid) Il2rg(null)', 'active', 'reserved', 'ear_tag', 'ET-1011', 'Jackson Labs', '2025-02-10', 'In Cage ISO-02, reserved for upcoming xenograft study'),

-- Sprague Dawley rats
(1012, 'Rattus norvegicus', 'Sprague Dawley', 'F', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1012', 'Charles River', '2024-12-20', 'In Cage B201-01, young female for metabolic studies'),
(1013, 'Rattus norvegicus', 'Sprague Dawley', 'M', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'available', 'ear_tag', 'ET-1013', 'Charles River', '2024-12-20', 'In Cage B201-02, young male for cardiovascular studies'),
(1014, 'Rattus norvegicus', 'Sprague Dawley', 'F', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'ear_tag', 'ET-1014', 'Charles River', '2024-12-20', 'In Cage B201-03, claimed for metabolic syndrome study'),
(1015, 'Rattus norvegicus', 'Sprague Dawley', 'M', '2024-11-15', 'Charles River Labs', 'Wild type', 'active', 'claimed', 'ear_tag', 'ET-1015', 'Charles River', '2024-12-20', 'In Cage B201-04, claimed for metabolic syndrome study'),

-- Wistar rats
(1016, 'Rattus norvegicus', 'Wistar', 'F', '2024-12-10', 'Envigo', 'Wild type', 'active', 'available', 'tattoo', 'TT-1016', 'Envigo', '2025-01-12', 'In Cage B201-05, young female for behavioral studies'),
(1017, 'Rattus norvegicus', 'Wistar', 'M', '2024-12-10', 'Envigo', 'Wild type', 'active', 'available', 'tattoo', 'TT-1017', 'Envigo', '2025-01-12', 'In Cage B201-06, young male for behavioral studies'),

-- Breeding pairs (not available for claiming)
(1018, 'Mus musculus', 'C57BL/6J', 'F', '2024-10-01', 'The Jackson Laboratory', 'Wild type', 'active', 'breeding', 'ear_tag', 'ET-1018', 'Jackson Labs', '2024-11-01', 'In Cage A102-B1, proven breeder female'),
(1019, 'Mus musculus', 'C57BL/6J', 'M', '2024-10-01', 'The Jackson Laboratory', 'Wild type', 'active', 'breeding', 'ear_tag', 'ET-1019', 'Jackson Labs', '2024-11-01', 'In Cage A102-B1, proven breeder male'),

-- Retired/older animals
(1020, 'Mus musculus', 'C57BL/6J', 'F', '2023-08-15', 'The Jackson Laboratory', 'Wild type', 'active', 'retired', 'ear_tag', 'ET-1020', 'Jackson Labs', '2023-09-10', 'In Cage A102-B2, retired breeder over 18 months old')

ON CONFLICT (animal_number) DO NOTHING;