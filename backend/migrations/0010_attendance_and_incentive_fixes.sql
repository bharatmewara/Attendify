-- Migration 0010: Attendance lifecycle eligibility, performance period attribution, and safe data repairs

-- 1. Employees: Add exit_date to track employment lifecycle end (resignation/termination)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS exit_date DATE;

-- Populate exit_date from deleted_at for existing soft-deleted employees
UPDATE employees
SET exit_date = deleted_at::date
WHERE deleted_at IS NOT NULL AND exit_date IS NULL;

-- Populate exit_date from updated_at for existing terminated/inactive employees without exit_date
UPDATE employees
SET exit_date = updated_at::date
WHERE status IN ('terminated', 'resigned', 'inactive') AND exit_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_status_lifecycle ON employees(company_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_dates ON employees(joining_date, exit_date);

-- 2. Incentive Submissions: Explicit performance period tracking
ALTER TABLE incentive_submissions ADD COLUMN IF NOT EXISTS performance_month INTEGER CHECK (performance_month BETWEEN 1 AND 12);
ALTER TABLE incentive_submissions ADD COLUMN IF NOT EXISTS performance_year INTEGER;

-- Backfill performance_month and performance_year from submitted_at
UPDATE incentive_submissions
SET performance_month = EXTRACT(MONTH FROM submitted_at)::int,
    performance_year = EXTRACT(YEAR FROM submitted_at)::int
WHERE performance_month IS NULL;

CREATE INDEX IF NOT EXISTS idx_incentive_submissions_perf_period ON incentive_submissions(company_id, performance_year, performance_month);
CREATE INDEX IF NOT EXISTS idx_incentive_submissions_emp_perf ON incentive_submissions(employee_id, performance_year, performance_month);

-- 3. Correct Historical Incentive Earnings Discrepancy
-- Realign earned_month/earned_year to original submission performance period
UPDATE incentive_earnings ie
SET earned_month = s.performance_month,
    earned_year = s.performance_year,
    earned_at = s.submitted_at
FROM incentive_submissions s
WHERE ie.submission_id = s.id
  AND (ie.earned_month <> s.performance_month OR ie.earned_year <> s.performance_year);

-- 4. Clean up invalid synthetic absences created for ineligible dates (after exit date or before joining date)
DELETE FROM attendance_records ar
USING employees e
WHERE ar.employee_id = e.id
  AND ar.status = 'absent'
  AND (
    (e.exit_date IS NOT NULL AND ar.work_date > e.exit_date)
    OR (e.deleted_at IS NOT NULL AND ar.work_date > e.deleted_at::date)
    OR (e.joining_date IS NOT NULL AND ar.work_date < e.joining_date)
  );

-- 5. Ensure Unique Constraint on attendance_records (employee_id, work_date)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_attendance_employee_date'
  ) THEN
    -- In case duplicates existed historically, remove duplicates first keeping the newest
    DELETE FROM attendance_records a
    USING attendance_records b
    WHERE a.id < b.id 
      AND a.employee_id = b.employee_id 
      AND a.work_date = b.work_date;

    ALTER TABLE attendance_records 
    ADD CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, work_date);
  END IF;
END $$;
