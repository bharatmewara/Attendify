/**
 * clientAnalyticsService.js
 * ----------------------------------------------------------------------
 * Client repetition analytics and hierarchical purchase history for Attendify HRMS.
 *
 * Implements Phase 6:
 *  - Stable client identification and grouping (by mobile / email / ID)
 *  - Full hierarchical purchase history with order reference, amounts, dates, and products
 *  - First and latest purchase dates, total sales value, and average purchase value
 *  - Repeat-purchase interval analytics
 *  - Filter for repeat clients only
 *  - Distinction between approved sales and pending/rejected/refunded transactions
 */

import { query } from '../db.js';

export const roundMoney = (val) => Math.round(Number(val || 0) * 100) / 100;

export async function getHierarchicalClients({
  companyId,
  employeeId = null,
  search = '',
  dateFrom = '',
  dateTo = '',
  repeatOnly = false,
}) {
  const params = [companyId];
  let filterSql = '';

  if (employeeId) {
    params.push(Number(employeeId));
    filterSql += ` AND sub.employee_id = $${params.length}::int`;
  }

  if (dateFrom) {
    params.push(dateFrom);
    filterSql += ` AND COALESCE(sub.submitted_at::date, sub.approved_at::date) >= $${params.length}::date`;
  }

  if (dateTo) {
    params.push(dateTo);
    filterSql += ` AND COALESCE(sub.submitted_at::date, sub.approved_at::date) <= $${params.length}::date`;
  }

  if (search) {
    params.push(search.trim());
    filterSql += ` AND (
      sub.client_name ILIKE '%' || $${params.length} || '%'
      OR sub.client_mobile_1 ILIKE '%' || $${params.length} || '%'
      OR sub.client_mobile_2 ILIKE '%' || $${params.length} || '%'
      OR sub.client_email ILIKE '%' || $${params.length} || '%'
      OR sub.client_panel_username ILIKE '%' || $${params.length} || '%'
      OR sub.product_name ILIKE '%' || $${params.length} || '%'
    )`;
  }

  // 1. Fetch all matching submissions with employee details
  const sql = `
    SELECT
      sub.id,
      sub.company_id,
      sub.employee_id,
      sub.client_name,
      sub.client_mobile_1,
      sub.client_mobile_2,
      sub.client_email,
      sub.client_username,
      sub.client_panel_username,
      sub.client_panel_password,
      sub.client_location,
      sub.product_name,
      sub.package_type,
      sub.sms_quantity,
      sub.rate,
      sub.gst_applied,
      sub.price,
      sub.price_gross,
      sub.payment_mode,
      sub.screenshot_path,
      sub.kyc_path,
      sub.incentive_amount,
      sub.status,
      sub.notes,
      sub.submitted_at,
      sub.approved_at,
      sub.performance_month,
      sub.performance_year,
      e.first_name,
      e.last_name,
      e.employee_code,
      COALESCE(
        NULLIF(TRIM(sub.client_mobile_1), ''),
        NULLIF(TRIM(LOWER(sub.client_email)), ''),
        CONCAT('submission:', sub.id::text)
      ) AS client_key
    FROM incentive_submissions sub
    JOIN employees e ON e.id = sub.employee_id
    WHERE sub.company_id = $1::int
      ${filterSql}
    ORDER BY sub.submitted_at DESC, sub.id DESC
  `;

  const result = await query(sql, params);
  const rows = result.rows;

  // 2. Group hierarchically by client_key
  const clientMap = new Map();

  for (const row of rows) {
    const key = row.client_key;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        client_key: key,
        client_name: row.client_name,
        client_mobile_1: row.client_mobile_1,
        client_mobile_2: row.client_mobile_2,
        client_email: row.client_email,
        client_username: row.client_username,
        client_panel_username: row.client_panel_username,
        client_panel_password: row.client_panel_password,
        last_location: row.client_location,
        last_product: row.product_name,
        last_package_type: row.package_type,
        last_rate: row.rate,
        last_sms_quantity: row.sms_quantity,
        last_price_ex_gst: row.price,
        last_price_inc_gst: row.price_gross,
        last_gst_applied: row.gst_applied,
        last_payment_mode: row.payment_mode,
        last_kyc_path: row.kyc_path,
        last_screenshot_path: row.screenshot_path,
        last_status: row.status,
        last_submission_id: row.id,
        last_submitted_at: row.submitted_at,
        last_approved_at: row.approved_at,
        // Assigned Employee (from primary or most recent sale)
        assigned_employee: {
          id: row.employee_id,
          first_name: row.first_name,
          last_name: row.last_name,
          employee_code: row.employee_code,
        },
        first_name: row.first_name,
        last_name: row.last_name,
        employee_code: row.employee_code,
        // Aggregates
        submissions_count: 0,
        approved_count: 0,
        total_sales: 0,
        total_received: 0,
        total_gst_amount: 0,
        total_incentive: 0,
        purchases: [],
      });
    }

    const client = clientMap.get(key);
    client.submissions_count += 1;

    const netPrice = Number(row.price || 0);
    const grossPrice = row.price_gross !== null && row.price_gross !== undefined && row.price_gross !== ''
      ? Number(row.price_gross)
      : (row.gst_applied ? roundMoney(netPrice * 1.18) : netPrice);

    const gstAmount = row.gst_applied ? roundMoney(grossPrice - netPrice) : 0;
    const isApproved = String(row.status).toLowerCase() === 'approved';

    if (isApproved) {
      client.approved_count += 1;
      client.total_sales = roundMoney(client.total_sales + netPrice);
      client.total_received = roundMoney(client.total_received + grossPrice);
      client.total_gst_amount = roundMoney(client.total_gst_amount + gstAmount);
      client.total_incentive = roundMoney(client.total_incentive + Number(row.incentive_amount || 0));
    }

    // Purchase record details
    client.purchases.push({
      id: row.id,
      order_reference: `ORD-${String(row.id).padStart(5, '0')}`,
      date: row.submitted_at,
      approved_at: row.approved_at,
      product_name: row.product_name,
      package_type: row.package_type,
      sms_quantity: row.sms_quantity,
      rate: row.rate,
      price: netPrice,
      price_gross: grossPrice,
      gst_applied: row.gst_applied,
      incentive_amount: Number(row.incentive_amount || 0),
      payment_mode: row.payment_mode,
      status: row.status,
      client_location: row.client_location,
      screenshot_path: row.screenshot_path,
      kyc_path: row.kyc_path,
      employee_id: row.employee_id,
      employee_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      employee_code: row.employee_code,
    });
  }

  // 3. Post-process repeat analytics (first/latest dates, interval, avg value)
  let clientsList = Array.from(clientMap.values());

  for (const client of clientsList) {
    // Sort purchases chronologically ascending for interval calculation
    client.purchases.sort((a, b) => new Date(a.date) - new Date(b.date));

    client.first_purchase_date = client.purchases[0]?.date || null;
    client.latest_purchase_date = client.purchases[client.purchases.length - 1]?.date || null;

    client.total_purchases = client.approved_count;
    client.is_repeat_client = client.total_purchases > 1;

    client.average_purchase_value = client.total_purchases > 0
      ? roundMoney(client.total_sales / client.total_purchases)
      : 0;

    // Calculate repeat purchase intervals
    if (client.purchases.length > 1) {
      const intervals = [];
      for (let i = 1; i < client.purchases.length; i++) {
        const diffDays = Math.max(
          0,
          Math.round((new Date(client.purchases[i].date) - new Date(client.purchases[i - 1].date)) / (1000 * 60 * 60 * 24))
        );
        intervals.push(diffDays);
        client.purchases[i].interval_from_previous_days = diffDays;
      }
      const sumIntervals = intervals.reduce((a, b) => a + b, 0);
      const avgInterval = Math.round(sumIntervals / intervals.length);
      client.repeat_interval_days = avgInterval;
      client.average_repeat_interval_days = avgInterval;
    } else {
      client.repeat_interval_days = null;
      client.average_repeat_interval_days = null;
    }

    // Set submissions array for backward compatibility with dialog
    client.submissions = client.purchases.map(p => ({
      ...p,
      created_at: p.date,
    }));
  }

  // Filter for repeat clients only if requested
  if (repeatOnly) {
    clientsList = clientsList.filter((c) => c.is_repeat_client);
  }

  // Sort clients by latest purchase date descending
  clientsList.sort((a, b) => new Date(b.latest_purchase_date || 0) - new Date(a.latest_purchase_date || 0));

  return clientsList;
}
