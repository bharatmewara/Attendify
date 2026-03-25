-- Incentives schema
-- Note: This file is intentionally non-destructive (no DROP TABLE) to avoid data loss.

CREATE TABLE IF NOT EXISTS incentive_submissions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  client_mobile_1 VARCHAR(20),
  client_mobile_2 VARCHAR(20),
  client_email VARCHAR(255),
  client_username VARCHAR(255),
  sms_quantity INTEGER,
  rate NUMERIC(10, 4),
  price NUMERIC(10, 2),
  payment_mode VARCHAR(50),
  screenshot_path VARCHAR(255),
  package_type VARCHAR(20),
  client_location VARCHAR(255),
  incentive_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by INTEGER,
  approved_at TIMESTAMPTZ,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

ALTER TABLE IF EXISTS incentive_submissions
  ADD COLUMN IF NOT EXISTS client_mobile_1 VARCHAR(20);

ALTER TABLE IF EXISTS incentive_submissions
  ADD COLUMN IF NOT EXISTS client_mobile_2 VARCHAR(20);

ALTER TABLE IF EXISTS incentive_submissions
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);

ALTER TABLE IF EXISTS incentive_submissions
  ADD COLUMN IF NOT EXISTS client_username VARCHAR(255);
-- Monthly incentive earnings (materialized view-like table)
CREATE TABLE IF NOT EXISTS incentive_earnings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  submission_id INTEGER NOT NULL UNIQUE REFERENCES incentive_submissions(id) ON DELETE CASCADE,
  earned_month INTEGER NOT NULL,
  earned_year INTEGER NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  package_type VARCHAR(20),
  payment_mode VARCHAR(50),
  price NUMERIC(10,2),
  incentive_amount NUMERIC(10,2) NOT NULL,
  client_location VARCHAR(255),
  submitted_at TIMESTAMPTZ,
  approved_by INTEGER,
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incentive_earnings_company_month ON incentive_earnings(company_id, earned_year, earned_month);
CREATE INDEX IF NOT EXISTS idx_incentive_earnings_employee_month ON incentive_earnings(employee_id, earned_year, earned_month);
