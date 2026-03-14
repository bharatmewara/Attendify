-- Add attendance regularization requests table
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

CREATE INDEX IF NOT EXISTS idx_attendance_regularization_employee ON attendance_regularization_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_regularization_company ON attendance_regularization_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_regularization_status ON attendance_regularization_requests(status);

-- Add columns to employees table for Aadhar, PAN, and bank details
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'aadhar_number') THEN
    ALTER TABLE employees ADD COLUMN aadhar_number VARCHAR(12);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'pan_number') THEN
    ALTER TABLE employees ADD COLUMN pan_number VARCHAR(10);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'bank_account_number') THEN
    ALTER TABLE employees ADD COLUMN bank_account_number VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'bank_name') THEN
    ALTER TABLE employees ADD COLUMN bank_name VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'bank_ifsc') THEN
    ALTER TABLE employees ADD COLUMN bank_ifsc VARCHAR(11);
  END IF;
END $$;

COMMIT;
