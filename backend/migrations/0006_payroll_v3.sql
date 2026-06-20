-- Migration 0006: Payroll V3 Enterprise System
-- Full payroll engine: components, templates, assignments, cycles, run items, adjustments, audit logs
-- HR Manager role support, company payslip/bank/GST fields
-- All statements are idempotent (safe on existing databases)

-- HR Manager role support
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','company_admin','hr_manager','employee'));

-- Company payslip / bank / GST fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gst_number     VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pan_number     VARCHAR(10);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name      VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account   VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_ifsc      VARCHAR(15);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payslip_footer TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tel_no         VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_email  VARCHAR(255);

-- Payroll settings per company
CREATE TABLE IF NOT EXISTS payroll_settings (
  id                   SERIAL PRIMARY KEY,
  company_id           INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  salary_cycle         VARCHAR(20) NOT NULL DEFAULT 'monthly'
                       CHECK (salary_cycle IN ('monthly','biweekly','weekly')),
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

-- Salary component catalogue
CREATE TABLE IF NOT EXISTS salary_components (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_name      VARCHAR(100) NOT NULL,
  component_code      VARCHAR(50)  NOT NULL,
  component_type      VARCHAR(20)  NOT NULL CHECK (component_type IN ('earning','deduction')),
  calculation_type    VARCHAR(20)  NOT NULL
                      CHECK (calculation_type IN ('fixed','percentage','formula','dynamic')),
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

CREATE INDEX IF NOT EXISTS idx_sc_company_active ON salary_components(company_id, is_active);

-- Salary structure templates
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

CREATE INDEX IF NOT EXISTS idx_sst_company ON salary_structure_templates(company_id, is_active);

-- Template <-> Component mapping
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

-- Employee salary assignment
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id    INTEGER NOT NULL REFERENCES salary_structure_templates(id),
  effective_from DATE NOT NULL,
  effective_to   DATE,
  ctc            NUMERIC(14,2) NOT NULL,
  gross_salary   NUMERIC(14,2),
  payment_type   VARCHAR(20) DEFAULT 'bank_transfer'
                 CHECK (payment_type IN ('bank_transfer','cash','cheque')),
  bank_account   VARCHAR(50),
  bank_ifsc      VARCHAR(15),
  bank_name      VARCHAR(100),
  salary_status  VARCHAR(20) DEFAULT 'active'
                 CHECK (salary_status IN ('active','revised','inactive')),
  notes          TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esa_employee  ON employee_salary_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_esa_company   ON employee_salary_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_esa_effective ON employee_salary_assignments(employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_esa_active    ON employee_salary_assignments(employee_id, salary_status);

-- Payroll cycles
CREATE TABLE IF NOT EXISTS payroll_cycles (
  id           SERIAL PRIMARY KEY,
  company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_month  INTEGER NOT NULL CHECK (cycle_month BETWEEN 1 AND 12),
  cycle_year   INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  payout_date  DATE,
  status       VARCHAR(20) DEFAULT 'draft'
               CHECK (status IN ('draft','processing','approved','paid','cancelled')),
  initiated_by INTEGER REFERENCES users(id),
  approved_by  INTEGER REFERENCES users(id),
  approved_at  TIMESTAMPTZ,
  paid_at      TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, cycle_month, cycle_year)
);

CREATE INDEX IF NOT EXISTS idx_pc_company_status ON payroll_cycles(company_id, status);

-- Payroll run items (per-employee snapshot)
CREATE TABLE IF NOT EXISTS payroll_run_items (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_id            INTEGER NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id       INTEGER REFERENCES employee_salary_assignments(id),
  working_days        INTEGER NOT NULL DEFAULT 26,
  present_days        NUMERIC(5,2) NOT NULL DEFAULT 0,
  absent_days         NUMERIC(5,2) NOT NULL DEFAULT 0,
  paid_leave_days     NUMERIC(5,2) NOT NULL DEFAULT 0,
  unpaid_leave_days   NUMERIC(5,2) NOT NULL DEFAULT 0,
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
  status              VARCHAR(20) DEFAULT 'draft'
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

CREATE INDEX IF NOT EXISTS idx_pri_cycle    ON payroll_run_items(cycle_id);
CREATE INDEX IF NOT EXISTS idx_pri_employee ON payroll_run_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_pri_company  ON payroll_run_items(company_id);
CREATE INDEX IF NOT EXISTS idx_pri_status   ON payroll_run_items(status);

-- Payroll adjustments (bonus/deduction per run item)
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

-- Payroll audit log
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

-- Extend payslips table (columns may or may not exist — all idempotent)
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS cycle_id              INTEGER REFERENCES payroll_cycles(id);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS month                 INTEGER;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS year                  INTEGER;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS gross_salary          NUMERIC(14,2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS net_salary            NUMERIC(14,2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS snapshot_data         JSONB;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS run_item_id           INTEGER REFERENCES payroll_run_items(id);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS generated_at          TIMESTAMPTZ DEFAULT now();
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS downloaded_at         TIMESTAMPTZ;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS viewed_by_employee_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_company  ON payslips(company_id);

-- Payroll calculation backward compat columns
ALTER TABLE payroll_calculations ADD COLUMN IF NOT EXISTS sales_total         NUMERIC(12,2) DEFAULT 0;
ALTER TABLE payroll_calculations ADD COLUMN IF NOT EXISTS target_total_salary NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payroll_calculations ADD COLUMN IF NOT EXISTS extra_income        NUMERIC(10,2) DEFAULT 0;

-- Seed default payroll settings for existing companies (safe: ON CONFLICT DO NOTHING)
INSERT INTO payroll_settings (company_id, salary_cycle, payroll_start_day, payroll_end_day, salary_payout_day, working_days_rule)
SELECT id, 'monthly', 1, 31, 5, 26
FROM companies
WHERE is_active = true
ON CONFLICT (company_id) DO NOTHING;
