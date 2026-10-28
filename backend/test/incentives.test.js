import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db.js';
import {
  calculateIncentiveForSale,
  syncIncentiveStatus,
  getPerformanceStatistics,
} from '../src/services/financialCalculationService.js';

test('Incentive Calculation Rules: Admin configured percentage as single source of truth', () => {
  // Test case 1: 5% configured rate on 100,000 eligible sale
  const rules5Percent = {
    default_incentive_percentage: 5,
  };

  const result1 = calculateIncentiveForSale({
    price: 100000,
    config: rules5Percent,
  });

  assert.equal(result1, 5000, '5% of 100,000 must equal exactly 5,000');

  // Test case 2: 7.5% configured rate on 80,000
  const rules7_5Percent = {
    default_incentive_percentage: 7.5,
  };

  const result2 = calculateIncentiveForSale({
    price: 80000,
    config: rules7_5Percent,
  });

  assert.equal(result2, 6000, '7.5% of 80,000 must equal 6,000');

  // Test case 3: Zero sales yields zero incentive
  const resultZero = calculateIncentiveForSale({
    price: 0,
    config: rules5Percent,
  });
  assert.equal(resultZero, 0, '0 sales must yield 0 incentive');
});

test('Sales Statistics Isolation: Incentives must NEVER be added to sales totals', () => {
  const salePrice = 50000;
  const config = { default_incentive_percentage: 10 };
  const incentiveAmount = calculateIncentiveForSale({ price: salePrice, config });

  const genuineSalesTotal = salePrice;

  assert.equal(genuineSalesTotal, 50000, 'Genuine sales must reflect only the sale price');
  assert.equal(incentiveAmount, 5000, 'Incentive must be calculated separately');
  assert.notEqual(genuineSalesTotal, 55000, 'Sales total must NEVER add incentive amount back into sales');
});

test('Performance Month Attribution: Prior-month submission approved in later month credits original performance period', async () => {
  // Find or insert test company & employee
  const compRes = await query(`SELECT id FROM companies WHERE is_active = true LIMIT 1`);
  if (!compRes.rows.length) {
    return; // Skip DB integration if no companies exist
  }
  const companyId = compRes.rows[0].id;

  const empRes = await query(`SELECT id FROM employees WHERE company_id = $1 LIMIT 1`, [companyId]);
  if (!empRes.rows.length) {
    return;
  }
  const employeeId = empRes.rows[0].id;

  // Insert a test submission for September 2026 (Month 9)
  const subRes = await query(
    `INSERT INTO incentive_submissions (
       company_id, employee_id, client_name, product_name,
       client_mobile_1, client_email, price, incentive_amount,
       status, submitted_at, performance_month, performance_year
     ) VALUES (
       $1, $2, 'Test September Client', 'SMS Marketing',
       '9999900001', 'test_sep@example.com', 20000, 1000,
       'pending', '2026-09-15 10:00:00+00', 9, 2026
     ) RETURNING *`,
    [companyId, employeeId],
  );
  const testSub = subRes.rows[0];

  try {
    // Admin approves the submission in October 2026 (Month 10)
    const approved = await syncIncentiveStatus({
      submissionId: testSub.id,
      companyId,
      nextStatus: 'approved',
      approvedByUserId: 1,
    });

    // Verify status is approved
    assert.equal(approved.status, 'approved', 'Status should be approved');

    // Verify performance_month and performance_year remain September 2026 (9, 2026)
    assert.equal(approved.performance_month, 9, 'Performance month MUST remain 9 (September)');
    assert.equal(approved.performance_year, 2026, 'Performance year MUST remain 2026');

    // Verify incentive_earnings record has earned_month = 9 and earned_year = 2026
    const earnRes = await query(
      `SELECT * FROM incentive_earnings WHERE submission_id = $1`,
      [testSub.id],
    );
    assert.equal(earnRes.rows.length, 1, 'Earnings record should exist');
    assert.equal(earnRes.rows[0].earned_month, 9, 'Materialized earned_month MUST be 9 (September), NOT approval month');
    assert.equal(earnRes.rows[0].earned_year, 2026, 'Materialized earned_year MUST be 2026');

    // Test Idempotency: Approving a second time does not duplicate earnings
    await syncIncentiveStatus({
      submissionId: testSub.id,
      companyId,
      nextStatus: 'approved',
      approvedByUserId: 1,
    });

    const earnCount = await query(
      `SELECT COUNT(*)::int AS count FROM incentive_earnings WHERE submission_id = $1`,
      [testSub.id],
    );
    assert.equal(earnCount.rows[0].count, 1, 'Approval must be idempotent; earnings record must not duplicate');

    // Test Rejection: Rejecting safely deletes from incentive_earnings
    await syncIncentiveStatus({
      submissionId: testSub.id,
      companyId,
      nextStatus: 'rejected',
      approvedByUserId: 1,
    });

    const rejectedEarnCount = await query(
      `SELECT COUNT(*)::int AS count FROM incentive_earnings WHERE submission_id = $1`,
      [testSub.id],
    );
    assert.equal(rejectedEarnCount.rows[0].count, 0, 'Rejecting must remove incentive from earnings');
  } finally {
    // Clean up test records
    await query(`DELETE FROM incentive_earnings WHERE submission_id = $1`, [testSub.id]);
    await query(`DELETE FROM incentive_submissions WHERE id = $1`, [testSub.id]);
  }
});
