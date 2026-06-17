-- ============================================================
-- FIX: Employee Soft-Delete & Email Reuse
-- Safe to run multiple times (idempotent)
-- ============================================================

-- 1. Add deleted_at column to employees (soft-delete marker)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add index for fast "active employees" queries
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON employees(deleted_at) WHERE deleted_at IS NULL;

-- 3. Make sure attendance_records won't block employee delete cascade
-- (attendance records should stay for history — they reference employee_id which we keep)

-- 4. Fix: Update all existing GET queries to exclude soft-deleted employees
-- This is handled in application code, not SQL.

-- 5. Add network_policies table if not exists (for Wi-Fi punch security)
CREATE TABLE IF NOT EXISTS network_policies (
  id                      SERIAL PRIMARY KEY,
  company_id              INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label                   VARCHAR(100) NOT NULL,
  network_cidr            CIDR NOT NULL,
  employee_login_allowed  BOOLEAN NOT NULL DEFAULT FALSE,
  punch_allowed           BOOLEAN NOT NULL DEFAULT TRUE,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_policies_company ON network_policies(company_id);

-- 6. Add my_clients endpoint support: ensure incentive_submissions has employee_id indexed
CREATE INDEX IF NOT EXISTS idx_incentive_submissions_employee ON incentive_submissions(employee_id) WHERE employee_id IS NOT NULL;

-- 7. Ensure proper cascade for employee delete (don't fail on FK refs)
-- payroll_run_items -> employees: keep historical data
-- attendance_records -> employees: keep historical data
-- No changes needed - soft delete keeps the row

COMMENT ON COLUMN employees.deleted_at IS 'NULL = active employee. Non-null = soft-deleted at this timestamp';
