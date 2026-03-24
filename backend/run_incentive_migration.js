import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'backend/.env') });
import fs from 'fs/promises';
import { pool } from './src/db.js';

async function runIncentiveMigration() {
  try {
    const sqlPath = path.join(process.cwd(), 'backend/sql', 'incentive_schema.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    console.log('Running incentive schema migration...');
    const result = await pool.query(sql);
    console.log('Incentive schema migration successful:', result.command);
    
  } catch (error) {
    console.error('Incentive schema migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runIncentiveMigration();
