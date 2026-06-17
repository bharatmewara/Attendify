-- ============================================================
-- PAYROLL V2 SCHEMA  (non-destructive, adds new tables)
-- Run once against the attendify database
-- ============================================================

-- ── Payroll settings per company ────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_settings (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  salary_cycle    VARCHAR(20)  NOT NULL DEFAULT 'monthly'
                  CHECK (salary_cycle IN ('monthly','biweekly','weekly')),
  payroll_start_day   INTEGER NOT NULL DEFAULT 1,
  payroll_end_day     INTEGER NOT NULL DEFAULT 31,
  salary_payout_day   INTEGER NOT NULL DEFAULT 5,
  working_days_rule   INTEGER NOT NULL DEFAULT 26,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id)
);

-- ── Salary component catalogue ───────────────────────────────
CREATE TABLE IF NOT EXISTS salary_components (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_name    VARCHAR(100) NOT NULL,
  component_code    VARCHAR(50)  NOT NULL,
  component_type    VARCHAR(20)  NOT NULL CHECK (component_type IN ('earning','deduction')),
  calculation_type  VARCHAR(20)  NOT NULL
                    CHECK (calculation_type IN ('fixed','percentage','formula','dynamic')),
  default_value     NUMERIC(14,4) DEFAULT 0,
  percentage_of     VARCHAR(100),
  percentage_value  NUMERIC(8,4),
  formula_expression TEXT,
  is_taxable        BOOLEAN DEFAULT false,
  is_mandatory      BOOLEAN DEFAULT true,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, component_code)
);

-- ── Salary structure templates ───────────────────────────────
CREATE TABLE IF NOT EXISTS salary_structure_templates (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_name   VARCHAR(150) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Template ↔ Component mapping ────────────────────────────
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

-- ── Employee salary assignment ───────────────────────────────
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id     INTEGER NOT NULL REFERENCES salary_structure_templates(id),
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  ctc             NUMERIC(14,2) NOT NULL,
  gross_salary    NUMERIC(14,2),
  payment_type    VARCHAR(20) DEFAULT 'bank_transfer'
                  CHECK (payment_type IN ('bank_transfer','cash','cheque')),
  bank_account    VARCHAR(50),
  bank_ifsc       VARCHAR(15),
  salary_status   VARCHAR(20) DEFAULT 'active'
                  CHECK (salary_status IN ('active','revised','inactive')),
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esa_employee ON employee_salary_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_esa_effective ON employee_salary_assignments (employee_id, effective_from DESC);

-- ── Payroll cycles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_cycles (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_month     INTEGER NOT NULL CHECK (cycle_month BETWEEN 1 AND 12),
  cycle_year      INTEGER NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  payout_date     DATE,
  status          VARCHAR(20) DEFAULT 'draft'
                  CHECK (status IN ('draft','processing','approved','paid','cancelled')),
  initiated_by    INTEGER REFERENCES users(id),
  approved_by     INTEGER REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, cycle_month, cycle_year)
);

-- ── Payroll run items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_run_items (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_id            INTEGER NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id       INTEGER REFERENCES employee_salary_assignments(id),
  working_days        INTEGER NOT NULL DEFAULT 26,
  present_days        INTEGER NOT NULL DEFAULT 0,
  absent_days         INTEGER NOT NULL DEFAULT 0,
  paid_leave_days     INTEGER NOT NULL DEFAULT 0,
  unpaid_leave_days   INTEGER NOT NULL DEFAULT 0,
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
  status              VARCHAR(20) DEFAULT 'draft'
                      CHECK (status IN ('draft','approved','paid','cancelled')),
  processed_by        INTEGER REFERENCES users(id),
  processed_at        TIMESTAMPTZ,
  frozen_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_pri_cycle    ON payroll_run_items (cycle_id);
CREATE INDEX IF NOT EXISTS idx_pri_employee ON payroll_run_items (employee_id);
CREATE INDEX IF NOT EXISTS idx_pri_company  ON payroll_run_items (company_id);

-- ── Payroll adjustments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_item_id     INTEGER NOT NULL REFERENCES payroll_run_items(id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('earning','deduction')),
  reason          TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  applied_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Payroll audit log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50),
  entity_id     INTEGER,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_company ON payroll_audit_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_pal_entity  ON payroll_audit_logs (entity_type, entity_id);

-- ── Extend existing payslips table ──────────────────────────
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS snapshot_data JSONB;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS run_item_id   INTEGER REFERENCES payroll_run_items(id);
