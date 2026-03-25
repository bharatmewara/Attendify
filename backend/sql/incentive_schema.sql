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