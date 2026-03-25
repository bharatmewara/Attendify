-- FIX 403 POST ERROR - Create Demo Employee + Company
-- Run: psql DATABASE_URL -f fix_403_demo.sql

-- 1. Create demo company
INSERT INTO companies (company_name, company_code, email, is_active, subscription_status) 
VALUES ('Demo Tech', 'DEMO001', 'admin@demotech.com', true, 'active') 
ON CONFLICT (company_code) DO NOTHING;

-- 2. Get company ID
\echo 'Company ID:';
SELECT id FROM companies WHERE company_code = 'DEMO001';

-- 3. Create demo user (password: password)
INSERT INTO users (company_id, email, password_hash, role, is_active) 
VALUES (
  (SELECT id FROM companies WHERE company_code = 'DEMO001'), 
  'demo.employee@attendify.com', 
  '$2a$10$1ArkbJEdHMpcBF9bRtRNYero03WLi1UFaYzVWYY1pof7Y9ybs.erC', 
  'employee', 
  true
) ON CONFLICT (email) DO NOTHING;

-- 4. Create employee record (fixes tenantIsolation 403)
INSERT INTO employees (user_id, company_id, employee_code, first_name, last_name, status, joining_date) 
VALUES (
  (SELECT id FROM users WHERE email = 'demo.employee@attendify.com'),
  (SELECT id FROM companies WHERE company_code = 'DEMO001'),
  'EMP001', 
  'Demo', 
  'Employee', 
  'active', 
  '2024-01-01'
) ON CONFLICT DO NOTHING;

-- 5. Create basic leave types (for balance)
INSERT INTO leave_types (company_id, name, code, days_per_year, is_active) VALUES
((SELECT id FROM companies WHERE company_code = 'DEMO001'), 'Casual Leave', 'CL', 12, true),
((SELECT id FROM companies WHERE company_code = 'DEMO001'), 'Sick Leave', 'SL', 10, true);

-- 6. Add leave balances
INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days) 
SELECT 
  e.id, 
  lt.id, 
  2024, 
  lt.days_per_year, 
  lt.days_per_year
FROM employees e, leave_types lt 
WHERE e.user_id = (SELECT id FROM users WHERE email = 'demo.employee@attendify.com')
AND lt.company_id = e.company_id
ON CONFLICT DO NOTHING;

\echo '';
\echo '✅ FIXED! Login:';
\echo 'Email: demo.employee@attendify.com';
\echo 'Password: password';
\echo 'Company: Demo Tech (DEMO001)';
\echo '';
\echo 'Test: Frontend login → Punch-in → No 403';
\echo 'Delete this file after success.';

