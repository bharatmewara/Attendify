-- Add demo employees for testing
INSERT INTO users (company_id, email, password_hash, role, is_active, email_verified) VALUES
(1, 'john.doe@demotech.com', '$2a$10$m8./IylawXBlAdPntvavdu.BTz3mMf6NRUW5vUx4fa49q8HOpSWlW', 'employee', true, true),
(1, 'jane.smith@demotech.com', '$2a$10$m8./IylawXBlAdPntvavdu.BTz3mMf6NRUW5vUx4fa49q8HOpSWlW', 'employee', true, true)
ON CONFLICT (email) DO NOTHING;

-- Add employee profiles
INSERT INTO employees (user_id, company_id, employee_code, first_name, last_name, phone, department_id, designation_id, joining_date, employment_type) VALUES
((SELECT id FROM users WHERE email = 'john.doe@demotech.com'), 1, 'EMP001', 'John', 'Doe', '+1234567891', 1, 1, '2024-01-15', 'full_time'),
((SELECT id FROM users WHERE email = 'jane.smith@demotech.com'), 1, 'EMP002', 'Jane', 'Smith', '+1234567892', 1, 2, '2024-02-01', 'full_time')
ON CONFLICT (company_id, employee_code) DO NOTHING;

-- Assign shifts to employees
INSERT INTO employee_shifts (employee_id, shift_id, effective_from) VALUES
(1, 1, '2024-01-15'),
(2, 1, '2024-02-01')
ON CONFLICT DO NOTHING;

-- Add leave balances for current year
INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days) VALUES
(1, 1, 2024, 12, 12), -- John - Casual Leave
(1, 2, 2024, 10, 10), -- John - Sick Leave
(1, 3, 2024, 15, 15), -- John - Paid Leave
(2, 1, 2024, 12, 12), -- Jane - Casual Leave
(2, 2, 2024, 10, 10), -- Jane - Sick Leave
(2, 3, 2024, 15, 15)  -- Jane - Paid Leave
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- Add sample salary structures
INSERT INTO salary_structures (employee_id, company_id, basic_salary, allowances, deductions, effective_from) VALUES
(1, 1, 50000.00, '{"hra": 10000, "transport": 2000, "medical": 1500}', '{"pf": 6000, "tax": 5000}', '2024-01-15'),
(2, 1, 60000.00, '{"hra": 12000, "transport": 2000, "medical": 1500}', '{"pf": 7200, "tax": 7000}', '2024-02-01')
ON CONFLICT DO NOTHING;

COMMIT;