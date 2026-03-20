import { query } from './src/db.js';

async function checkSchema() {
  try {
    const result = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'shifts'");
    console.log('Columns in shifts table:');
    result.rows.forEach(row => console.log(row.column_name));
    process.exit(0);
  } catch (err) {
    console.error('Error checking schema:', err);
    process.exit(1);
  }
}

checkSchema();
