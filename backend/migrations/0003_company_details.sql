-- Migration 0003: Company details (logo, KYC, notification emails, tel)
-- Adds company branding, KYC document storage, and extra fields

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notification_emails TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tel_no VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS kyc_path TEXT;

-- KYC documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected')),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_kyc_company_id ON kyc_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_documents(status);
