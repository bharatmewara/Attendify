-- Migration 0009: Payroll Run Items & Preview Feature Columns
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensures all columns required for the Payroll Preview / Edit feature exist.
-- Safe to run on any database state (all statements are idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Core payroll run-items table (create if missing entirely)
CREATE TABLE IF NOT EXISTS payroll_run_items (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_id            INTEGER NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id       INTEGER REFERENCES employee_salary_assignments(id),
  working_days        INTEGER NOT NULL DEFAULT 26,
  present_days        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  absent_days         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  paid_leave_days     NUMERIC(5,2)  NOT NULL DEFAULT 0,
  unpaid_leave_days   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  late_minutes        INTEGER NOT NULL DEFAULT 0,
  overtime_minutes    INTEGER NOT NULL DEFAULT 0,
  basic_earned        NUMERIC(14,2) DEFAULT 0,
  total_earnings      NUMERIC(14,2) DEFAULT 0,
  incentive_total     NUMERIC(14,2) DEFAULT 0,
  bonus_total         NUMERIC(14,2) DEFAULT 0,
  overtime_amount     NUMERIC(14,2) DEFAULT 0,
  total_deductions    NUMERIC(14,2) DEFAULT 0,
  leave_deduction     NUMERIC(14,2) DEFAULT 0,
  late_penalty        NUMERIC(14,2) DEFAULT 0,
  gross_salary        NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary          NUMERIC(14,2) NOT NULL DEFAULT 0,
  earnings_snapshot   JSONB DEFAULT '[]',
  deductions_snapshot JSONB DEFAULT '[]',
  attendance_snapshot JSONB DEFAULT '{}',
  adjustments         JSONB DEFAULT '[]',
  status              VARCHAR(20)   DEFAULT 'draft'
                      CHECK (status IN ('draft','approved','paid','cancelled')),
  processed_by        INTEGER REFERENCES users(id),
  processed_at        TIMESTAMPTZ,
  approved_by         INTEGER REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  frozen_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

-- 2. Add any columns that may be missing on existing installations
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS earnings_snapshot   JSONB DEFAULT '[]';
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS deductions_snapshot JSONB DEFAULT '[]';
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS attendance_snapshot JSONB DEFAULT '{}';
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS adjustments         JSONB DEFAULT '[]';
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS assignment_id       INTEGER REFERENCES employee_salary_assignments(id);
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS bonus_total         NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS overtime_amount     NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS leave_deduction     NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS late_penalty        NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS basic_earned        NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS incentive_total     NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS frozen_at           TIMESTAMPTZ;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS approved_by         INTEGER REFERENCES users(id);
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ;
ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS processed_at        TIMESTAMPTZ;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_pri_cycle    ON payroll_run_items(cycle_id);
CREATE INDEX IF NOT EXISTS idx_pri_employee ON payroll_run_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_pri_company  ON payroll_run_items(company_id);
CREATE INDEX IF NOT EXISTS idx_pri_status   ON payroll_run_items(status);

-- 4. Payroll adjustments table (create if missing)
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_item_id     INTEGER NOT NULL REFERENCES payroll_run_items(id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('earning','deduction')),
  label           VARCHAR(150) NOT NULL,
  reason          TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  applied_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_run_item ON payroll_adjustments(run_item_id);
CREATE INDEX IF NOT EXISTS idx_pa_employee ON payroll_adjustments(employee_id);

-- 5. Payroll audit logs (create if missing)
CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   INTEGER,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_company ON payroll_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_pal_entity  ON payroll_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pal_user    ON payroll_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pal_action  ON payroll_audit_logs(action);

-- 6. Payroll cycles — ensure status column allows all needed values
ALTER TABLE payroll_cycles ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE payroll_cycles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE payroll_cycles ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;
ALTER TABLE payroll_cycles ADD COLUMN IF NOT EXISTS payout_date DATE;
ALTER TABLE payroll_cycles ADD COLUMN IF NOT EXISTS notes       TEXT;

-- 7. Payroll settings — ensure table and columns exist
CREATE TABLE IF NOT EXISTS payroll_settings (
  id                   SERIAL PRIMARY KEY,
  company_id           INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  salary_cycle         VARCHAR(20) NOT NULL DEFAULT 'monthly',
  payroll_start_day    INTEGER NOT NULL DEFAULT 1,
  payroll_end_day      INTEGER NOT NULL DEFAULT 31,
  salary_payout_day    INTEGER NOT NULL DEFAULT 5,
  working_days_rule    INTEGER NOT NULL DEFAULT 26,
  overtime_rate        NUMERIC(5,2) DEFAULT 1.5,
  late_penalty_enabled BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id)
);

-- Seed default payroll settings for any company that doesn't have one yet
INSERT INTO payroll_settings (company_id, salary_cycle, payroll_start_day, payroll_end_day, salary_payout_day, working_days_rule)
SELECT id, 'monthly', 1, 31, 5, 26
FROM companies
WHERE is_active = true
ON CONFLICT (company_id) DO NOTHING;

-- 8. Salary structure tables (in case VPS is missing them)
CREATE TABLE IF NOT EXISTS salary_components (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_name      VARCHAR(100) NOT NULL,
  component_code      VARCHAR(50)  NOT NULL,
  component_type      VARCHAR(20)  NOT NULL CHECK (component_type IN ('earning','deduction')),
  calculation_type    VARCHAR(20)  NOT NULL CHECK (calculation_type IN ('fixed','percentage','formula','dynamic')),
  default_value       NUMERIC(14,4) DEFAULT 0,
  percentage_of       VARCHAR(100),
  percentage_value    NUMERIC(8,4),
  formula_expression  TEXT,
  is_taxable          BOOLEAN DEFAULT false,
  is_mandatory        BOOLEAN DEFAULT true,
  is_active           BOOLEAN DEFAULT true,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (company_id, component_code)
);

CREATE TABLE IF NOT EXISTS salary_structure_templates (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_name VARCHAR(150) NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS salary_template_components (
  id                  SERIAL PRIMARY KEY,
  template_id         INTEGER NOT NULL REFERENCES salary_structure_templates(id) ON DELETE CASCADE,
  component_id        INTEGER NOT NULL REFERENCES salary_components(id) ON DELETE CASCADE,
  sort_order          INTEGER DEFAULT 0,
  override_value      NUMERIC(14,4),
  override_percentage NUMERIC(8,4),
  override_formula    TEXT,
  is_active           BOOLEAN DEFAULT true,
  UNIQUE (template_id, component_id)
);

CREATE TABLE IF NOT EXISTS employee_salary_assignments (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id    INTEGER NOT NULL REFERENCES salary_structure_templates(id),
  effective_from DATE NOT NULL,
  effective_to   DATE,
  ctc            NUMERIC(14,2) NOT NULL,
  gross_salary   NUMERIC(14,2),
  payment_type   VARCHAR(20) DEFAULT 'bank_transfer',
  bank_account   VARCHAR(50),
  bank_ifsc      VARCHAR(15),
  bank_name      VARCHAR(100),
  salary_status  VARCHAR(20) DEFAULT 'active',
  notes          TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esa_employee  ON employee_salary_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_esa_company   ON employee_salary_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_esa_effective ON employee_salary_assignments(employee_id, effective_from DESC);
