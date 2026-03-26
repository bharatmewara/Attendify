-- Sales target tiers + monthly targets schema
-- Note: This file is intentionally non-destructive (no DROP TABLE) to avoid data loss.

-- Company-wide sales-to-salary tiers
CREATE TABLE IF NOT EXISTS company_sales_target_tiers (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  min_sales_amount DECIMAL(12,2) NOT NULL,
  target_total_salary DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, min_sales_amount)
);

CREATE INDEX IF NOT EXISTS idx_company_sales_target_tiers_company
  ON company_sales_target_tiers(company_id, min_sales_amount);

-- Per-employee monthly targets (admin-set)
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

CREATE INDEX IF NOT EXISTS idx_employee_monthly_sales_targets_employee_month
  ON employee_monthly_sales_targets(employee_id, year, month);

-- Payroll fields needed for target-based extra income display
ALTER TABLE IF EXISTS payroll_calculations
  ADD COLUMN IF NOT EXISTS sales_total DECIMAL(12,2) DEFAULT 0;

ALTER TABLE IF EXISTS payroll_calculations
  ADD COLUMN IF NOT EXISTS target_total_salary DECIMAL(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS payroll_calculations
  ADD COLUMN IF NOT EXISTS extra_income DECIMAL(10,2) DEFAULT 0;
