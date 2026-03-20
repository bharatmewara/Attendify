-- Fix: Add missing tel_no and ensure logo column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tel_no TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;

-- Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'companies' AND column_name IN ('tel_no', 'logo');
