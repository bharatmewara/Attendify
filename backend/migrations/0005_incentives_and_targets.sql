-- Migration 0005: Incentives and sales targets schema
-- Tables for client submissions, incentive earnings, and sales targets

-- Incentive submissions (client data entered by employees)
CREATE TABLE IF NOT EXISTS incentive_submissions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  client_mobile_1 VARCHAR(20),
  client_mobile_2 VARCHAR(20),
  client_email VARCHAR(255),
  client_username VARCHAR(255),
  client_panel_username VARCHAR(255),
  client_panel_password VARCHAR(255),
  client_location VARCHAR(255),
  sms_quantity INTEGER,
  rate NUMERIC(10,4),
  gst_applied BOOLEAN DEFAULT FALSE,
  price_gross NUMERIC(10,2),
  price NUMERIC(10,2),
  payment_mode VARCHAR(50),
  package_type VARCHAR(20),
  screenshot_path VARCHAR(255),
  kyc_path TEXT,
  incentive_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paid')),
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incentive_submissions_company ON incentive_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_incentive_submissions_employee ON incentive_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_incentive_submissions_status ON incentive_submissions(status);

-- Incentive earnings (approved records materialized)
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
  sms_quantity INTEGER,
  price NUMERIC(10,2),
  incentive_amount NUMERIC(10,2) NOT NULL,
  client_location VARCHAR(255),
  submitted_at TIMESTAMPTZ,
  approved_by INTEGER,
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incentive_earnings_company_month ON incentive_earnings(company_id, earned_year, earned_month);
CREATE INDEX IF NOT EXISTS idx_incentive_earnings_employee_month ON incentive_earnings(employee_id, earned_year, earned_month);

-- Company incentive rules (JSON config)
CREATE TABLE IF NOT EXISTS company_incentive_rules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- Sales target tiers
CREATE TABLE IF NOT EXISTS company_sales_target_tiers (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  min_sales_amount DECIMAL(12,2) NOT NULL,
  target_total_salary DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, min_sales_amount)
);

-- Employee monthly sales targets
CREATE TABLE IF NOT EXISTS employee_monthly_sales_targets (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  target_sales_amount DECIMAL(12,2) NOT NULL,
  set_by INTEGER REFERENCES users(id),
  set_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_employee_monthly_sales_targets_company_month
  ON employee_monthly_sales_targets(company_id, year, month);

-- Extra payroll fields for target-based income
ALTER TABLE payroll_calculations ADD COLUMN IF NOT EXISTS sales_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE payroll_calculations ADD COLUMN IF NOT EXISTS target_total_salary DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll_calculations ADD COLUMN IF NOT EXISTS extra_income DECIMAL(10,2) DEFAULT 0;
