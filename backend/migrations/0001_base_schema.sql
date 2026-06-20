-- Migration 0001: Base schema
-- Core tables: subscription_plans, companies, users, departments, designations, employees, etc.
-- This is the foundation schema for Attendify HRMS.

-- ============================================
-- 1. SUBSCRIPTION PLANS
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
-- 2. COMPANIES
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  company_code VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  logo TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial','active','suspended','expired','cancelled')),
  trial_ends_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS notification_emails TEXT;

-- ============================================
-- 3. COMPANY SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  plan_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','trial')),
  billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  amount DECIMAL(10,2),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. SUBSCRIPTION PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES company_subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2),
  payment_date DATE,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  notes TEXT,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin','company_admin','hr_manager','employee')),
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

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
-- 6. DEPARTMENTS & DESIGNATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS designations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, title)
);

-- ============================================
-- 7. EMPLOYEES
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code VARCHAR(50),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20),
  phone VARCHAR(20),
  emergency_contact VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  postal_code VARCHAR(20),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  designation_id INTEGER REFERENCES designations(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  joining_date DATE NOT NULL,
  employment_type VARCHAR(50) DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','inactive','terminated','on_leave')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);

-- ============================================
-- 8. SHIFTS
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_period_minutes INTEGER DEFAULT 15,
  working_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  punch_in_time TIMESTAMPTZ,
  punch_out_time TIMESTAMPTZ,
  punch_in_location TEXT,
  punch_out_location TEXT,
  total_hours DECIMAL(5,2),
  late_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'absent' CHECK (status IN ('present','absent','half_day','on_leave','holiday','weekend')),
  source VARCHAR(50) DEFAULT 'web',
  notes TEXT,
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance_records(company_id, work_date DESC);

-- ============================================
-- 10. LEAVE TYPES & REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  days_per_year DECIMAL(5,2) DEFAULT 0,
  carry_forward BOOLEAN DEFAULT FALSE,
  is_paid BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days DECIMAL(5,2) DEFAULT 0,
  used_days DECIMAL(5,2) DEFAULT 0,
  remaining_days DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. HOLIDAYS
-- ============================================
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(50) DEFAULT 'public' CHECK (type IN ('public','restricted','optional')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) DEFAULT 'other',
  document_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_assets (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_name VARCHAR(100) NOT NULL,
  asset_type VARCHAR(50),
  serial_number VARCHAR(100),
  assigned_date DATE,
  returned_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_documents (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  document_type VARCHAR(50),
  file_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. AUDIT LOGS
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id, created_at DESC);

-- ============================================
-- 14. BASIC PAYROLL (legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS salary_structures (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  basic_salary DECIMAL(12,2) NOT NULL,
  hra DECIMAL(12,2) DEFAULT 0,
  da DECIMAL(12,2) DEFAULT 0,
  ta DECIMAL(12,2) DEFAULT 0,
  other_allowances DECIMAL(12,2) DEFAULT 0,
  pf_employee DECIMAL(12,2) DEFAULT 0,
  pf_employer DECIMAL(12,2) DEFAULT 0,
  esi_employee DECIMAL(12,2) DEFAULT 0,
  esi_employer DECIMAL(12,2) DEFAULT 0,
  professional_tax DECIMAL(12,2) DEFAULT 0,
  tds DECIMAL(12,2) DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_calculations (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  working_days INTEGER,
  present_days INTEGER,
  leave_days INTEGER,
  gross_salary DECIMAL(12,2),
  total_deductions DECIMAL(12,2),
  net_salary DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'draft',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by INTEGER REFERENCES users(id),
  UNIQUE(employee_id, month, year)
);

-- ============================================
-- 15. SYSTEM SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

-- ============================================
-- 16. NETWORK POLICIES (Office Wi-Fi punch security)
-- ============================================
CREATE TABLE IF NOT EXISTS network_policies (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  network_cidr CIDR NOT NULL,
  employee_login_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  punch_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_policies_company ON network_policies(company_id);
