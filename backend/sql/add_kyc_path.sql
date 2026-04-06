-- Add KYC path column to incentive_submissions
ALTER TABLE incentive_submissions ADD COLUMN IF NOT EXISTS kyc_path VARCHAR;

-- Create index for queries
CREATE INDEX IF NOT EXISTS idx_incentive_submissions_kyc_path ON incentive_submissions(kyc_path) WHERE kyc_path IS NOT NULL;

