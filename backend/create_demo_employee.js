import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from './src/config.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: config.databaseUrl });

async function createDemoData() {
  const client = await pool.connect();
  try {
console.log('🔄 Creating demo company...');
    // Create demo company if missing (schema_complete.sql style)
    await client.query(`
      INSERT INTO companies (company_name, company_code, email, phone, address, is_active, subscription_status)
      VALUES ('Demo Tech Ltd', 'DEMO-001', 'admin@demotech.com', '+1-555-0123', '123 Demo St', true, 'active')
      ON CONFLICT (company_code) DO NOTHING
    `);
    
    const companyRes = await client.query('SELECT id FROM companies WHERE company_code = $1', ['DEMO-001']);
    const companyId = companyRes.rows[0].id;
    console.log(`✅ Company ID: ${companyId}`);

    // Create demo leave types
    await client.query(`
      INSERT INTO leave_types (company_id, name, code, days_per_year, is_active) 
      VALUES 
        ($1, 'Casual Leave', 'CL', 12, true),
        ($1, 'Sick Leave', 'SL', 10, true),
        ($1, 'Annual Leave', 'AL', 15, true)
      ON CONFLICT DO NOTHING
    `, [companyId]);

    // Create demo departments/designations/shifts
    await client.query(`
      INSERT INTO departments (company_id, name) VALUES ($1, 'Engineering') ON CONFLICT DO NOTHING
    `, [companyId]);
    const deptRes = await client.query('SELECT id FROM departments WHERE company_id = $1 AND name = $2', [companyId, 'Engineering']);
    const deptId = deptRes.rows[0]?.id;

    await client.query(`
      INSERT INTO designations (company_id, title) VALUES ($1, 'Software Engineer') ON CONFLICT DO NOTHING
    `, [companyId]);
    const desRes = await client.query('SELECT id FROM designations WHERE company_id = $1 AND title = $2', [companyId, 'Software Engineer']);
    const desId = desRes.rows[0]?.id;

    await client.query(`
      INSERT INTO shifts (company_id, name, start_time, end_time, working_days, grace_period_minutes)
      VALUES ($1, '9-6 Shift', '09:00', '18:00', 'mon,tue,wed,thu,fri', 15)
      ON CONFLICT DO NOTHING RETURNING id
    `);
    const shiftRes = await client.query('SELECT id FROM shifts WHERE company_id = $1 AND name = $2', [companyId, '9-6 Shift']);
    const shiftId = shiftRes.rows[0].id;

    // Create user + employee
    const passwordHash = await bcrypt.hash('password', 10);
    await client.query(`
      INSERT INTO users (company_id, email, password_hash, role, is_active) 
      VALUES ($1, 'demo.employee@attendify.com', $2, 'employee', true)
      ON CONFLICT (email) DO NOTHING
    `, [companyId, passwordHash]);
    
    const userRes = await client.query('SELECT id FROM users WHERE email = $1', ['demo.employee@attendify.com']);
    const userId = userRes.rows[0].id;

    await client.query(`
      INSERT INTO employees (user_id, company_id, employee_code, first_name, last_name, phone, department_id, designation_id, joining_date, employment_type, status)
      VALUES ($1, $2, 'EMP-001', 'Demo', 'Employee', '+1-555-1234', $3, $4, '2024-01-01', 'full_time', 'active')
      ON CONFLICT DO NOTHING
    `, [userId, companyId, deptId, desId]);

    // Assign shift
    await client.query(`
      INSERT INTO employee_shifts (employee_id, shift_id, effective_from) 
      VALUES ((SELECT id FROM employees WHERE user_id = $1), $2, '2024-01-01')
    `, [userId, shiftId]);

    // Add leave balances
    const leaveTypes = await client.query('SELECT id FROM leave_types WHERE company_id = $1', [companyId]);
    const year = new Date().getFullYear();
    const empRes = await client.query('SELECT id FROM employees WHERE user_id = $1', [userId]);
    const empId = empRes.rows[0].id;
    
    for (const lt of leaveTypes.rows) {
      await client.query(`
        INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days)
        VALUES ($1, $2, $3, 12, 12)
        ON CONFLICT DO NOTHING
      `, [empId, lt.id, year]);
    }

    console.log('🎉 Demo Employee Created!');
    console.log('👤 Email: demo.employee@attendify.com');
    console.log('🔑 Password: password');
    console.log('🏢 Company: Demo Tech Ltd (ID:', companyId, ')');
    console.log('💼 Employee Code: EMP-001');
    console.log('');
    console.log('**NEXT:** Login → Test punch-in/out → 403 Fixed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createDemoData();
