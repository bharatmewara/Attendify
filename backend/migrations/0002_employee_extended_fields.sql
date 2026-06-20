-- Migration 0002: Employee extended fields
-- Adds Aadhar, PAN, bank details to employees table
-- Adds attendance regularization requests table

-- Employee KYC and bank fields
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(12);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(11);

-- Attendance regularization requests
CREATE TABLE IF NOT EXISTS attendance_regularization_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  punch_in_time TIME,
  punch_out_time TIME,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_regularization_employee ON attendance_regularization_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_regularization_company ON attendance_regularization_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_regularization_status ON attendance_regularization_requests(status);

-- Shift min hours and max punch-in time
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS min_hours_full_day DECIMAL(4,2) DEFAULT 8.0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS min_hours_half_day DECIMAL(4,2) DEFAULT 4.0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS max_punch_in_time TIME;
