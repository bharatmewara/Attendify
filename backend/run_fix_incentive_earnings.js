const { query } = require('./src/db.js');

(async () => {
  try {
    // Backfill all missing incentive_earnings for approved submissions (company_id = 9)
    const missing = await query(`
      SELECT s.*
      FROM incentive_submissions s
      LEFT JOIN incentive_earnings ie ON ie.submission_id = s.id
      WHERE s.company_id = 9 AND s.status = 'approved' AND s.approved_at IS NOT NULL
      AND ie.id IS NULL
    `);
    
    console.log(`Found ${missing.rows.length} missing earnings entries to backfill...`);
    
    for (const s of missing.rows) {
      await query(`
        INSERT INTO incentive_earnings (
          company_id, employee_id, submission_id, earned_month, earned_year, earned_at,
          client_name, product_name, package_type, payment_mode, sms_quantity, price, incentive_amount, client_location,
          submitted_at, approved_by, approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (submission_id) DO UPDATE SET
          earned_month = EXCLUDED.earned_month, earned_year = EXCLUDED.earned_year, earned_at = EXCLUDED.earned_at,
          client_name = EXCLUDED.client_name, product_name = EXCLUDED.product_name, package_type = EXCLUDED.package_type,
          payment_mode = EXCLUDED.payment_mode, sms_quantity = EXCLUDED.sms_quantity, price = EXCLUDED.price,
          incentive_amount = EXCLUDED.incentive_amount, client_location = EXCLUDED.client_location,
          approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at
      `, [
          s.company_id, s.employee_id, s.id,
          (new Date(s.approved_at)).getMonth() + 1, (new Date(s.approved_at)).getFullYear(), s.approved_at,
          s.client_name, s.product_name, s.package_type, s.payment_mode, s.sms_quantity, s.price, s.incentive_amount, s.client_location,
          s.submitted_at, s.approved_by, s.approved_at
        ]);
      console.log(`Backfilled submission #${s.id} for employee ${s.employee_id}`);
    }
    
    console.log('✅ Backfill complete! Check frontend Monthly Incentive Info table.');
  } catch (error) {
    console.error('Backfill failed:', error);
  } finally {
    process.exit(0);
  }
})();

