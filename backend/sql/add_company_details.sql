-- Migration: Add company logo field and KYC documents table
-- Run this SQL in your PostgreSQL database

-- Add logo column to companies table (safe IF NOT EXISTS)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS logo TEXT;

-- Create KYC documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kyc_company_id ON kyc_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_kyc_uploaded_at ON kyc_documents(uploaded_at);

-- Insert sample KYC types if needed
INSERT INTO kyc_documents (company_id, document_type, file_url, status, notes) 
SELECT 1, 'sample', 'sample.pdf', 'approved', 'Sample KYC document'
WHERE NOT EXISTS (
  SELECT 1 FROM kyc_documents WHERE document_type = 'sample'
) LIMIT 1;

-- Verify changes
SELECT 'Companies logo column:' AS check, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'companies' AND column_name = 'logo';

SELECT 'KYC table created:' AS check, COUNT(*) AS row_count 
FROM kyc_documents;
