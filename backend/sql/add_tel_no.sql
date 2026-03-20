-- Migration: Add tel_no to companies for landline
-- Run in your DB

ALTER TABLE companies ADD COLUMN IF NOT EXISTS tel_no TEXT;

-- Verify
SELECT 'tel_no column:' AS check, column_name, data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'tel_no';
