import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'backend/.env') });
import fs from 'fs/promises';
import { pool } from './src/db.js';

async function runMigration() {
  try {
    const sqlPath = path.join(process.cwd(), 'sql', 'fix_company_subscriptions_unique.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    console.log('Running migration...');
    const result = await pool.query(sql);
    console.log('Migration successful:', result.command);
    
    // Check constraint
    const check = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'company_subscriptions' AND constraint_type = 'UNIQUE'
    `);
    console.log('Unique constraints:', check.rows);
    
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
