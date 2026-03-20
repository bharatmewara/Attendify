import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
import fs from 'fs/promises';
import { pool } from './src/db.js';

async function runStatusMigration() {
  try {
    const sqlPath = path.join(process.cwd(), 'sql', 'fix_company_subscriptions_status.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    console.log('Running status migration...');
    const result = await pool.query(sql);
    console.log('Status migration successful:', result.command);
    
  } catch (error) {
    console.error('Status migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runStatusMigration();
