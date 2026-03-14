-- ============================================
-- ATTENDIFY SAAS HRMS - COMPLETE DATABASE SCHEMA
-- Multi-Tenant Architecture
-- ============================================

-- Drop existing tables if needed (for fresh setup)
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS payslips CASCADE;
-- DROP TABLE IF EXISTS payroll_calculations CASCADE;
-- DROP TABLE IF EXISTS salary_structures CASCADE;
-- DROP TABLE IF EXISTS hr_documents CASCADE;
-- DROP TABLE IF EXISTS holidays CASCADE;
-- DROP TABLE IF EXISTS attendance_regularization_requests CASCADE;
-- DROP TABLE IF EXISTS leave_requests CASCADE;
-- DROP TABLE IF EXISTS leave_balances CASCADE;
-- DROP TABLE IF EXISTS leave_types CASCADE;
-- DROP TABLE IF EXISTS attendance_records CASCADE;
-- DROP TABLE IF EXISTS employee_shifts CASCADE;
-- DROP TABLE IF EXISTS shifts CASCADE;
-- DROP TABLE IF EXISTS employee_documents CASCADE;
-- DROP TABLE IF EXISTS employee_assets CASCADE;
-- DROP TABLE IF EXISTS employees CASCADE;
-- DROP TABLE IF EXISTS departments CASCADE;
-- DROP TABLE IF EXISTS designations CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS subscription_payments CASCADE;
-- DROP TABLE IF EXISTS company_subscriptions CASCADE;
-- DROP TABLE IF EXISTS subscription_plans CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;

-- ============================================
-- 1. SUBSCRIPTION PLANS (Super Admin manages)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  employee_limit INTEGER NOT NULL,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. COMPANIES (Multi-tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  company_code VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  logo_url TEXT,
  website VARCHAR(255),
  industry VARCHAR(100),
  employee_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. COMPANY SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. SUBSCRIPTION PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES company_subscriptions(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. USERS (Multi-role: super_admin, company_admin, employee)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'company_admin', 'employee')),
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5A. PASSWORD RESET TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. DEPARTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. DESIGNATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS designations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. EMPLOYEES (Extended user profile)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  phone VARCHAR(20),
  emergency_contact VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  department_id INTEGER REFERENCES departments(id),
  designation_id INTEGER REFERENCES designations(id),
  manager_id INTEGER REFERENCES employees(id),
  joining_date DATE NOT NULL,
  employment_type VARCHAR(50) CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, employee_code)
);

-- ============================================
-- 9. EMPLOYEE DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. EMPLOYEE ASSETS
-- ============================================
CREATE TABLE IF NOT EXISTS employee_assets (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(100),
  serial_number VARCHAR(100),
  assigned_date DATE NOT NULL,
  return_date DATE,
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'returned', 'damaged', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. SHIFTS
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  working_days JSONB DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
  grace_period_minutes INTEGER DEFAULT 10,
  late_penalty_per_minute DECIMAL(10,2) DEFAULT 0,
  early_leave_penalty_per_minute DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. EMPLOYEE SHIFTS
-- ============================================
CREATE TABLE IF NOT EXISTS employee_shifts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. ATTENDANCE RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  punch_in_time TIMESTAMPTZ,
  punch_out_time TIMESTAMPTZ,
  total_hours DECIMAL(5,2),
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half_day', 'on_leave')),
  source VARCHAR(50) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'biometric')),
  punch_in_location VARCHAR(255),
  punch_out_location VARCHAR(255),
  notes TEXT,
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

-- ============================================
-- 13A. NETWORK POLICIES (Office WiFi/IP controls)
-- ============================================
CREATE TABLE IF NOT EXISTS network_policies (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label VARCHAR(150) NOT NULL,
  network_cidr CIDR NOT NULL,
  employee_login_allowed BOOLEAN DEFAULT FALSE,
  punch_allowed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13B. ATTENDANCE REGULARIZATION REQUESTS (ER)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_regularization_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  punch_in_time TIME,
  punch_out_time TIME,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. LEAVE TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  days_per_year INTEGER NOT NULL,
  carry_forward BOOLEAN DEFAULT FALSE,
  max_carry_forward_days INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT TRUE,
  requires_document BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================
-- 15. LEAVE BALANCES
-- ============================================
CREATE TABLE IF NOT EXISTS leave_balances (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  used_days DECIMAL(5,2) DEFAULT 0,
  remaining_days DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- ============================================
-- 16. LEAVE REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  reason TEXT NOT NULL,
  document_url TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 17. SALARY STRUCTURES
-- ============================================
CREATE TABLE IF NOT EXISTS salary_structures (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  basic_salary DECIMAL(10,2) NOT NULL,
  allowances JSONB DEFAULT '{}',
  deductions JSONB DEFAULT '{}',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. PAYROLL CALCULATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_calculations (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic_salary DECIMAL(10,2) NOT NULL,
  total_allowances DECIMAL(10,2) DEFAULT 0,
  total_deductions DECIMAL(10,2) DEFAULT 0,
  late_penalties DECIMAL(10,2) DEFAULT 0,
  early_leave_penalties DECIMAL(10,2) DEFAULT 0,
  overtime_amount DECIMAL(10,2) DEFAULT 0,
  advance_salary DECIMAL(10,2) DEFAULT 0,
  incentives DECIMAL(10,2) DEFAULT 0,
  gross_salary DECIMAL(10,2) NOT NULL,
  net_salary DECIMAL(10,2) NOT NULL,
  working_days INTEGER NOT NULL,
  present_days INTEGER NOT NULL,
  absent_days INTEGER NOT NULL,
  leave_days INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);

-- ============================================
-- 19. PAYSLIPS
-- ============================================
CREATE TABLE IF NOT EXISTS payslips (
  id SERIAL PRIMARY KEY,
  payroll_id INTEGER NOT NULL REFERENCES payroll_calculations(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payslip_url TEXT,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 20. HR DOCUMENTS (Letters, Agreements)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL CHECK (document_type IN ('offer_letter', 'appointment_letter', 'agreement', 'termination_letter', 'other')),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  document_url TEXT,
  generated_by INTEGER REFERENCES users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 21. AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 22. HOLIDAYS
-- ============================================
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  holiday_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, holiday_date)
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance_records(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_month_year ON payroll_calculations(employee_id, month, year);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_network_policies_company ON network_policies(company_id);
CREATE INDEX IF NOT EXISTS idx_holidays_company_date ON holidays(company_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_attendance_er_employee ON attendance_regularization_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_er_company_status ON attendance_regularization_requests(company_id, status);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, employee_limit, features) VALUES
('Starter', 'Perfect for small businesses', 999.00, 9990.00, 50, '{"attendance": true, "leave": true, "basic_payroll": true}'),
('Professional', 'For growing companies', 2999.00, 29990.00, 200, '{"attendance": true, "leave": true, "payroll": true, "documents": true, "reports": true}'),
('Enterprise', 'For large organizations', 9999.00, 99990.00, 999999, '{"attendance": true, "leave": true, "payroll": true, "documents": true, "reports": true, "api_access": true, "priority_support": true}')
ON CONFLICT DO NOTHING;

-- Insert Super Admin (password: admin123)
INSERT INTO users (email, password_hash, role, is_active, email_verified) VALUES
('superadmin@attendify.com', '$2a$10$m8./IylawXBlAdPntvavdu.BTz3mMf6NRUW5vUx4fa49q8HOpSWlW', 'super_admin', true, true)
ON CONFLICT (email) DO NOTHING;

-- Insert demo company
INSERT INTO companies (company_name, company_code, email, phone, address, is_active, subscription_status) VALUES
('Demo Tech Solutions', 'DEMO001', 'admin@demotech.com', '+1234567890', '123 Tech Street, Silicon Valley', true, 'active')
ON CONFLICT (company_code) DO NOTHING;

-- Insert company admin for demo company (password: admin123)
INSERT INTO users (company_id, email, password_hash, role, is_active, email_verified) VALUES
(1, 'admin@demotech.com', '$2a$10$m8./IylawXBlAdPntvavdu.BTz3mMf6NRUW5vUx4fa49q8HOpSWlW', 'company_admin', true, true)
ON CONFLICT (email) DO NOTHING;

-- Insert demo departments
INSERT INTO departments (company_id, name, description) VALUES
(1, 'Engineering', 'Software Development Team'),
(1, 'Human Resources', 'HR Department'),
(1, 'Sales', 'Sales and Marketing'),
(1, 'Finance', 'Finance and Accounting')
ON CONFLICT DO NOTHING;

-- Insert demo designations
INSERT INTO designations (company_id, title, description) VALUES
(1, 'Software Engineer', 'Software Development'),
(1, 'Senior Software Engineer', 'Senior Development Role'),
(1, 'HR Manager', 'Human Resources Management'),
(1, 'Sales Executive', 'Sales Role')
ON CONFLICT DO NOTHING;

-- Insert demo shift
INSERT INTO shifts (company_id, name, start_time, end_time, grace_period_minutes) VALUES
(1, 'General Shift', '09:00:00', '18:00:00', 15)
ON CONFLICT DO NOTHING;

-- Insert demo leave types
INSERT INTO leave_types (company_id, name, code, days_per_year, carry_forward, is_paid) VALUES
(1, 'Casual Leave', 'CL', 12, true, true),
(1, 'Sick Leave', 'SL', 10, false, true),
(1, 'Paid Leave', 'PL', 15, true, true),
(1, 'Unpaid Leave', 'UL', 0, false, false)
ON CONFLICT DO NOTHING;

COMMIT;
