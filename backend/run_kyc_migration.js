const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool(require('./src/config.js').db);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'sql/add_kyc_path.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    const client = await pool.connect();
    try {
      const result = await client.query(sql);
      console.log('✅ KYC migration complete:', result.command);
    } finally {
      client.release();
    }
    
    await pool.end();
    console.log('Migration successful');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

