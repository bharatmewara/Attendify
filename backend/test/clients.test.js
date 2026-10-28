import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db.js';
import { getHierarchicalClients } from '../src/services/clientAnalyticsService.js';

test('Client Analytics: Stable identification and repeat client purchase hierarchy', async () => {
  const compRes = await query(`SELECT id FROM companies WHERE is_active = true LIMIT 1`);
  if (!compRes.rows.length) return;
  const companyId = compRes.rows[0].id;

  const empRes = await query(`SELECT id FROM employees WHERE company_id = $1 LIMIT 1`, [companyId]);
  if (!empRes.rows.length) return;
  const employeeId = empRes.rows[0].id;

  const testMobile = '9876543210';
  const testEmail = 'repeat_test@client.com';

  // Insert two test submissions for the SAME client across two different dates
  const sub1 = await query(
    `INSERT INTO incentive_submissions (
       company_id, employee_id, client_name, product_name,
       client_mobile_1, client_email, price, price_gross, gst_applied,
       incentive_amount, status, submitted_at, performance_month, performance_year
     ) VALUES (
       $1, $2, 'Acme Corp', 'Product Alpha',
       $3, $4, 10000, 11800, true,
       500, 'approved', '2026-08-01 10:00:00+00', 8, 2026
     ) RETURNING id`,
    [companyId, employeeId, testMobile, testEmail],
  );

  const sub2 = await query(
    `INSERT INTO incentive_submissions (
       company_id, employee_id, client_name, product_name,
       client_mobile_1, client_email, price, price_gross, gst_applied,
       incentive_amount, status, submitted_at, performance_month, performance_year
     ) VALUES (
       $1, $2, 'Acme Corp', 'Product Beta',
       $3, $4, 25000, 29500, true,
       1250, 'approved', '2026-08-21 10:00:00+00', 8, 2026
     ) RETURNING id`,
    [companyId, employeeId, testMobile, testEmail],
  );

  try {
    // 1. Fetch clients without repeat filter
    const allClients = await getHierarchicalClients({
      companyId,
      search: 'Acme Corp',
    });

    const acmeClient = allClients.find(c => c.client_mobile_1 === testMobile);
    assert.ok(acmeClient, 'Client must be found by stable mobile identifier');

    // Verify repetition properties
    assert.equal(acmeClient.is_repeat_client, true, 'Client with 2 purchases must be marked as is_repeat_client');
    assert.equal(acmeClient.total_purchases, 2, 'Total purchases must equal 2');
    assert.equal(acmeClient.total_sales, 35000, 'Total sales must equal 10,000 + 25,000 = 35,000');
    assert.equal(acmeClient.total_received, 41300, 'Total received must equal 11,800 + 29,500 = 41,300');
    assert.equal(acmeClient.total_incentive, 1750, 'Total incentive must equal 500 + 1250 = 1,750');
    assert.equal(acmeClient.repeat_interval_days, 20, 'Interval between Aug 1 and Aug 21 must be 20 days');

    // Verify purchases array contains both orders with order_reference
    assert.equal(acmeClient.purchases.length, 2, 'Must have 2 purchases in hierarchy');
    assert.ok(acmeClient.purchases[0].order_reference.startsWith('ORD-'), 'Order ref must format as ORD-xxxxx');
    assert.ok(acmeClient.purchases[1].order_reference.startsWith('ORD-'), 'Order ref must format as ORD-xxxxx');

    // 2. Fetch with repeatOnly = true filter
    const repeatClients = await getHierarchicalClients({
      companyId,
      search: 'Acme Corp',
      repeatOnly: true,
    });
    assert.equal(repeatClients.length, 1, 'Repeat filter should include the 2x client');
    assert.equal(repeatClients[0].client_mobile_1, testMobile);
  } finally {
    await query(`DELETE FROM incentive_submissions WHERE id IN ($1, $2)`, [sub1.rows[0].id, sub2.rows[0].id]);
  }
});
