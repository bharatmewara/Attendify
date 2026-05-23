-- VPS Repair Script: Leave + Email Notification Consistency
-- Safe to run multiple times (idempotent where possible).
-- Run with: psql "$DATABASE_URL" -f backend/sql/vps_leave_email_repair.sql

BEGIN;

-- 1) Ensure leave_requests.status supports cancelled (older VPS DBs may miss this value)
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname
  INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'leave_requests'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leave_requests DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.leave_requests
    ADD CONSTRAINT leave_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));
END $$;

-- 2) Normalize leave request statuses (if any invalid values exist)
UPDATE public.leave_requests
SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'approved', 'rejected', 'cancelled');

-- 3) Ensure users.company_id is populated from employees.company_id where missing
UPDATE public.users u
SET company_id = e.company_id,
    updated_at = NOW()
FROM public.employees e
WHERE e.user_id = u.id
  AND u.company_id IS NULL
  AND e.company_id IS NOT NULL;

-- 4) Ensure leave_requests.company_id is populated from employees.company_id where missing
UPDATE public.leave_requests lr
SET company_id = e.company_id,
    updated_at = NOW()
FROM public.employees e
WHERE lr.employee_id = e.id
  AND lr.company_id IS NULL
  AND e.company_id IS NOT NULL;

-- 5) Ensure company-admin recipients are active and have clean emails
UPDATE public.users
SET email = LOWER(TRIM(email)),
    updated_at = NOW()
WHERE role IN ('company_admin', 'super_admin')
  AND email IS NOT NULL
  AND email <> LOWER(TRIM(email));

-- 6) Helpful indexes for leave mail query paths
CREATE INDEX IF NOT EXISTS idx_users_company_role_active
  ON public.users(company_id, role, is_active);

CREATE INDEX IF NOT EXISTS idx_leave_requests_company_employee_status
  ON public.leave_requests(company_id, employee_id, status);

-- 7) Add not-null constraints carefully (only if no nulls exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE company_id IS NULL AND role IN ('company_admin', 'employee')) THEN
    BEGIN
      ALTER TABLE public.users ALTER COLUMN company_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      -- Ignore if already constrained or blocked by schema differences
      NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leave_requests WHERE company_id IS NULL) THEN
    BEGIN
      ALTER TABLE public.leave_requests ALTER COLUMN company_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

COMMIT;

-- Post-run verification queries (optional):
-- SELECT status, COUNT(*) FROM public.leave_requests GROUP BY status ORDER BY status;
-- SELECT role, is_active, COUNT(*) FROM public.users WHERE role IN ('company_admin','super_admin') GROUP BY role, is_active ORDER BY role, is_active;
-- SELECT COUNT(*) AS bad_admin_emails FROM public.users WHERE role IN ('company_admin','super_admin') AND (email IS NULL OR TRIM(email) = '');
-- SELECT COUNT(*) AS leave_without_company FROM public.leave_requests WHERE company_id IS NULL;

