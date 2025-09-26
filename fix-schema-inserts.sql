-- Fix the system_options INSERT statements that are missing option_key values

-- First, fix the INSERT statements by adding the missing option_key values
-- The pattern should be: (category, option_key, option_value, display_text, description, is_active)
-- But the VALUES only provide: (category, value, display_text, description, is_active)
-- So option_key should equal option_value in these cases

-- Clear out any existing problematic data
DELETE FROM system_options WHERE category IN ('sample_type', 'collection_method', 'preservation_method');

-- Insert sample types with proper option_key values
INSERT INTO system_options (category, option_key, option_value, display_text, description, is_active) VALUES
('sample_type', 'blood_whole', 'blood_whole', 'Whole Blood', 'Fresh whole blood sample', true),
('sample_type', 'blood_serum', 'blood_serum', 'Serum', 'Blood serum after coagulation', true),
('sample_type', 'blood_plasma', 'blood_plasma', 'Plasma', 'Blood plasma with anticoagulant', true),
('sample_type', 'tissue_liver', 'tissue_liver', 'Liver Tissue', 'Liver tissue sample', true),
('sample_type', 'tissue_brain', 'tissue_brain', 'Brain Tissue', 'Brain tissue sample', true),
('sample_type', 'tissue_heart', 'tissue_heart', 'Heart Tissue', 'Heart tissue sample', true),
('sample_type', 'tissue_kidney', 'tissue_kidney', 'Kidney Tissue', 'Kidney tissue sample', true),
('sample_type', 'tissue_lung', 'tissue_lung', 'Lung Tissue', 'Lung tissue sample', true),
('sample_type', 'tissue_spleen', 'tissue_spleen', 'Spleen Tissue', 'Spleen tissue sample', true),
('sample_type', 'tissue_muscle', 'tissue_muscle', 'Muscle Tissue', 'Skeletal muscle tissue', true),
('sample_type', 'tissue_fat', 'tissue_fat', 'Adipose Tissue', 'Fat/adipose tissue', true),
('sample_type', 'bone', 'bone', 'Bone', 'Bone sample', true),
('sample_type', 'bone_marrow', 'bone_marrow', 'Bone Marrow', 'Bone marrow sample', true),
('sample_type', 'urine', 'urine', 'Urine', 'Urine sample', true),
('sample_type', 'feces', 'feces', 'Feces', 'Fecal sample', true),
('sample_type', 'tissue_other', 'tissue_other', 'Other Tissue', 'Other tissue type', true),
('sample_type', 'fluid_other', 'fluid_other', 'Other Fluid', 'Other body fluid', true)
ON CONFLICT (category, option_key) DO NOTHING;

-- Insert collection methods
INSERT INTO system_options (category, option_key, option_value, display_text, description, is_active) VALUES
('collection_method', 'terminal_bleed', 'terminal_bleed', 'Terminal Bleed', 'Terminal blood collection at euthanasia', true),
('collection_method', 'serial_bleed', 'serial_bleed', 'Serial Blood Draw', 'Non-terminal blood collection', true),
('collection_method', 'necropsy', 'necropsy', 'Necropsy', 'Post-mortem tissue collection', true),
('collection_method', 'biopsy', 'biopsy', 'Biopsy', 'Tissue biopsy from live animal', true),
('collection_method', 'cage_collection', 'cage_collection', 'Cage Collection', 'Sample collected from cage', true),
('collection_method', 'surgical', 'surgical', 'Surgical Collection', 'Surgically obtained sample', true)
ON CONFLICT (category, option_key) DO NOTHING;

-- Insert preservation methods
INSERT INTO system_options (category, option_key, option_value, display_text, description, is_active) VALUES
('preservation_method', 'fresh', 'fresh', 'Fresh', 'Fresh sample, no preservation', true),
('preservation_method', 'frozen_minus80', 'frozen_minus80', 'Frozen -80°C', 'Frozen at -80°C', true),
('preservation_method', 'frozen_minus20', 'frozen_minus20', 'Frozen -20°C', 'Frozen at -20°C', true),
('preservation_method', 'formalin', 'formalin', 'Formalin Fixed', 'Fixed in formalin solution', true),
('preservation_method', 'ethanol', 'ethanol', 'Ethanol Preserved', 'Preserved in ethanol', true),
('preservation_method', 'rna_later', 'rna_later', 'RNAlater', 'Preserved in RNAlater solution', true),
('preservation_method', 'snap_frozen', 'snap_frozen', 'Snap Frozen', 'Snap frozen in liquid nitrogen', true)
ON CONFLICT (category, option_key) DO NOTHING;