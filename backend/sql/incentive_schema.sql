-- Drop existing incentive tables if they exist
DROP TABLE IF EXISTS incentive_requests;
DROP TABLE IF EXISTS incentive_configs;

-- Create a new table to store incentive submissions
CREATE TABLE IF NOT EXISTS incentive_submissions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  sms_quantity INTEGER,
  rate NUMERIC(10, 4),
  price NUMERIC(10, 2),
  payment_mode VARCHAR(50),
  screenshot_path VARCHAR(255),
  package_type VARCHAR(20),
  client_location VARCHAR(255),
  incentive_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by INTEGER,
  approved_at TIMESTAMPTZ,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);
