-- Migration 0007: Employee soft-delete and email reuse fix
-- Adds deleted_at column to employees so that deleting an employee
-- anonymizes their email in users table, freeing it for reuse.

-- Soft-delete column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Fast index for active employees queries
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON employees(deleted_at) WHERE deleted_at IS NULL;

-- Index for incentive_submissions by employee (for my-clients endpoint)
CREATE INDEX IF NOT EXISTS idx_incentive_submissions_employee_id ON incentive_submissions(employee_id) WHERE employee_id IS NOT NULL;

COMMENT ON COLUMN employees.deleted_at IS 'NULL = active employee. Non-null = soft-deleted timestamp. Email in users table is anonymized on delete.';
