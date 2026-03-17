
import { query } from './db.js';

async function migrate() {
  try {
    await query(`
      ALTER TABLE shifts 
      ADD COLUMN IF NOT EXISTS min_hours_full_day DECIMAL(4,2) DEFAULT 8.0, 
      ADD COLUMN IF NOT EXISTS min_hours_half_day DECIMAL(4,2) DEFAULT 4.0, 
      ADD COLUMN IF NOT EXISTS max_punch_in_time TIME;
    `);
    console.log('Shifts table updated with rule columns.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
