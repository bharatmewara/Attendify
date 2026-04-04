-- Add serial_number column to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS serial_number VARCHAR(50);

-- Generate for existing (example for company_id = 9, adjust company initials)
UPDATE employees 
SET serial_number = CONCAT('PCI/', EXTRACT(YEAR FROM joining_date)::text, '/', LPAD(employee_code::text, 3, '0'))
WHERE company_id = 9 AND serial_number IS NULL AND joining_date IS NOT NULL AND employee_code IS NOT NULL;

-- Verify
SELECT employee_id, employee_code, joining_date, serial_number FROM employees WHERE company_id = 9 LIMIT 5;

