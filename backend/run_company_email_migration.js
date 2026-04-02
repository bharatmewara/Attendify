import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'backend/.env') });
import fs from 'fs/promises';
import { pool } from './src/db.js';

async function runCompanyEmailMigration() {
  try {
    const sqlPath = path.join(process.cwd(), 'backend/sql', 'company_notification_emails.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    console.log('Running company notification emails migration...');
    const result = await pool.query(sql);
    console.log('Migration successful:', result.command);
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runCompanyEmailMigration();

