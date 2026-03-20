import pg from 'pg';
import { config } from './src/config.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: config.databaseUrl
});

async function checkColumns() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'");
    console.log('--- DATABASE CHECK ---');
    console.log('Columns in employees table:', res.rows.map(r => r.column_name).join(', '));
    
    // Also check for audit_logs table
    const auditRes = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_logs'");
    console.log('audit_logs table exists:', auditRes.rows[0].count > 0);
    
  } catch (err) {
    console.error('DATABASE ERROR:', err);
  } finally {
    await pool.end();
  }
}

checkColumns();
