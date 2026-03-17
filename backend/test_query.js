import pg from 'pg';
import { config } from './src/config.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: config.databaseUrl
});

async function testQuery() {
  try {
    const companyId = 1; // Assuming demo company ID
    console.log('Testing query with companyId:', companyId);
    
    const query = `
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.phone, e.joining_date, 
        e.employment_type, e.status, e.department_id, e.designation_id,
        u.email, u.is_active, d.name as department_name, des.title as designation_title
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ($1::int IS NULL OR e.company_id = $1)
      ORDER BY e.created_at DESC
    `;
    
    const res = await pool.query(query, [companyId]);
    console.log('Query success! Row count:', res.rowCount);
    if (res.rowCount > 0) {
        console.log('First row:', JSON.stringify(res.rows[0], null, 2));
    }
  } catch (err) {
    console.error('QUERY FAILED:', err.message);
    console.error('Full error:', err);
  } finally {
    await pool.end();
  }
}

testQuery();
