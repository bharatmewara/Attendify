/**
 * financialCalculationService.js
 * ----------------------------------------------------------------------
 * Authoritative financial calculation service for Attendify HRMS.
 *
 * Rules:
 *  1. Sales Statistics MUST represent genuine sales transactions only.
 *  2. Incentive amounts must NEVER be added to sales, revenue, or sales totals.
 *  3. Incentives are calculated separately using the admin-configured policy.
 *  4. Admin-configured percentage / slabs is the SINGLE SOURCE OF TRUTH.
 *  5. Performance period is strictly the month & year of original performance/submission,
 *     regardless of approval date. Approving a previous month's claim in a later month
 *     must NEVER reattribute the incentive to the approval month.
 *  6. Approval actions are idempotent.
 */

import { query } from '../db.js';
import {
  calculateIncentiveFromRules,
  defaultIncentiveRulesConfigV1,
} from '../utils/incentive_rules.js';

export const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Fetch company-configured incentive rules from database
 */
export async function getCompanyIncentiveRules(companyId) {
  try {
    const result = await query(
      `SELECT config
       FROM company_incentive_rules
       WHERE company_id = $1::int
         AND is_active = TRUE
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [companyId],
    );
    return result.rows[0]?.config || defaultIncentiveRulesConfigV1();
  } catch (error) {
    console.error('Failed to fetch incentive rules:', error.message);
    return defaultIncentiveRulesConfigV1();
  }
}

/**
 * Calculate incentive for a sale transaction based on admin rules
 */
export function calculateIncentiveForSale({
  config,
  productName,
  smsQuantity,
  rate,
  price,
  packageType = 'new',
}) {
  const priceNum = roundMoney(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return 0;
  }

  // 1. If rules config provides rule-based calculation (slabs, product percent, flat)
  const ruleResult = calculateIncentiveFromRules({
    config,
    productName,
    smsQuantity,
    rate,
    price: priceNum,
    packageType,
  });

  if (ruleResult !== null && ruleResult !== undefined && Number.isFinite(ruleResult)) {
    return roundMoney(ruleResult);
  }

  // 2. Check for company-level default incentive percentage
  const defaultPct = Number(config?.default_incentive_percentage ?? config?.incentive_percentage);
  if (Number.isFinite(defaultPct) && defaultPct >= 0) {
    let incentive = (priceNum * defaultPct) / 100;
    if (String(packageType).toLowerCase() === 'renew') {
      const mult = Number(config?.renewal_multiplier ?? 0.5);
      incentive *= Number.isFinite(mult) ? mult : 0.5;
    }
    return roundMoney(incentive);
  }

  return 0;
}

/**
 * Authoritative Performance Statistics Calculation
 *
 * Guaranteed invariants:
 * - Sales Statistics = genuine qualifying sales only
 * - Incentive Statistics = calculated incentives only
 * - Grouped strictly by performance period (performance_month & performance_year)
 */
export async function getPerformanceStatistics({ companyId, employeeId = null, month, year }) {
  const targetMonth = Number(month);
  const targetYear = Number(year);

  // If no employee specified, return company/team breakdown for all relevant employees
  if (!employeeId) {
    const teamResult = await query(
      `SELECT
         e.id AS employee_id,
         e.first_name,
         e.last_name,
         e.employee_code,
         e.status AS employment_status,
         COALESCE(COUNT(s.id), 0)::int AS clients_total,
         COALESCE(SUM(s.price), 0)::decimal(12,2) AS sales_total,
         COALESCE(SUM(COALESCE(s.price_gross, s.price)), 0)::decimal(12,2) AS sales_gross_total,
         COALESCE(SUM(s.incentive_amount), 0)::decimal(12,2) AS incentives_total,
         COALESCE(COUNT(s.id) FILTER (WHERE s.package_type = 'new'), 0)::int AS new_count,
         COALESCE(COUNT(s.id) FILTER (WHERE s.package_type = 'renew'), 0)::int AS renew_count
       FROM employees e
       LEFT JOIN incentive_submissions s
         ON s.employee_id = e.id
        AND s.company_id = e.company_id
        AND s.status = 'approved'
        AND COALESCE(s.performance_month, EXTRACT(MONTH FROM s.submitted_at)::int) = $2
        AND COALESCE(s.performance_year, EXTRACT(YEAR FROM s.submitted_at)::int) = $3
       WHERE e.company_id = $1::int
         AND (e.deleted_at IS NULL OR s.id IS NOT NULL)
       GROUP BY e.id
       ORDER BY sales_total DESC, e.first_name ASC`,
      [companyId, targetMonth, targetYear],
    );

    // Organization-level aggregates
    const orgSummary = teamResult.rows.reduce(
      (acc, row) => {
        acc.clients_total += Number(row.clients_total || 0);
        acc.sales_total += Number(row.sales_total || 0);
        acc.sales_gross_total += Number(row.sales_gross_total || 0);
        acc.incentives_total += Number(row.incentives_total || 0);
        acc.new_count += Number(row.new_count || 0);
        acc.renew_count += Number(row.renew_count || 0);
        return acc;
      },
      { clients_total: 0, sales_total: 0, sales_gross_total: 0, incentives_total: 0, new_count: 0, renew_count: 0 },
    );

    return {
      month: targetMonth,
      year: targetYear,
      summary: orgSummary,
      employees: teamResult.rows,
    };
  }

  // Single Employee Performance Summary
  const summaryResult = await query(
    `SELECT
       COALESCE(COUNT(*), 0)::int AS clients_total,
       COALESCE(SUM(price), 0)::decimal(12,2) AS sales_total,
       COALESCE(SUM(COALESCE(price_gross, price)), 0)::decimal(12,2) AS sales_gross_total,
       COALESCE(SUM(incentive_amount), 0)::decimal(12,2) AS incentives_total,
       COALESCE(SUM(sms_quantity), 0)::bigint AS sms_total,
       COALESCE(COUNT(*) FILTER (WHERE package_type = 'new'), 0)::int AS new_count,
       COALESCE(COUNT(*) FILTER (WHERE package_type = 'renew'), 0)::int AS renew_count
     FROM incentive_submissions
     WHERE company_id = $1::int
       AND employee_id = $2::int
       AND status = 'approved'
       AND COALESCE(performance_month, EXTRACT(MONTH FROM submitted_at)::int) = $3
       AND COALESCE(performance_year, EXTRACT(YEAR FROM submitted_at)::int) = $4`,
    [companyId, employeeId, targetMonth, targetYear],
  );
  const summary = summaryResult.rows[0];

  // Payment Breakdown
  const paymentsResult = await query(
    `SELECT COALESCE(payment_mode, 'Unknown') AS payment_mode,
            COALESCE(SUM(price), 0)::decimal(12,2) AS total
     FROM incentive_submissions
     WHERE company_id = $1::int
       AND employee_id = $2::int
       AND status = 'approved'
       AND COALESCE(performance_month, EXTRACT(MONTH FROM submitted_at)::int) = $3
       AND COALESCE(performance_year, EXTRACT(YEAR FROM submitted_at)::int) = $4
     GROUP BY COALESCE(payment_mode, 'Unknown')
     ORDER BY total DESC`,
    [companyId, employeeId, targetMonth, targetYear],
  );

  // Detailed Transactions
  const detailsResult = await query(
    `SELECT
       id,
       client_name,
       product_name,
       package_type,
       payment_mode,
       sms_quantity,
       rate,
       price,
       price_gross,
       gst_applied,
       incentive_amount,
       client_location,
       client_mobile_1,
       client_mobile_2,
       client_email,
       client_panel_username,
       client_panel_password,
       submitted_at,
       approved_at,
       COALESCE(performance_month, EXTRACT(MONTH FROM submitted_at)::int) AS performance_month,
       COALESCE(performance_year, EXTRACT(YEAR FROM submitted_at)::int) AS performance_year
     FROM incentive_submissions
     WHERE company_id = $1::int
       AND employee_id = $2::int
       AND status = 'approved'
       AND COALESCE(performance_month, EXTRACT(MONTH FROM submitted_at)::int) = $3
       AND COALESCE(performance_year, EXTRACT(YEAR FROM submitted_at)::int) = $4
     ORDER BY submitted_at DESC, id DESC`,
    [companyId, employeeId, targetMonth, targetYear],
  );

  // Target and salary tiers
  const targetResult = await query(
    `SELECT target_sales_amount
     FROM employee_monthly_sales_targets
     WHERE company_id = $1::int
       AND employee_id = $2::int
       AND month = $3::int
       AND year = $4::int`,
    [companyId, employeeId, targetMonth, targetYear],
  );
  const target_sales_amount = targetResult.rows[0]?.target_sales_amount ?? null;
  const targetSalesValue = target_sales_amount !== null && target_sales_amount !== undefined
    ? Number(target_sales_amount)
    : null;

  const salesTotalNum = Number(summary?.sales_total || 0);

  const tierResult = await query(
    `SELECT min_sales_amount, target_total_salary
     FROM company_sales_target_tiers
     WHERE company_id = $1::int
       AND is_active = TRUE
       AND min_sales_amount <= $2::decimal(12,2)
     ORDER BY min_sales_amount DESC
     LIMIT 1`,
    [companyId, salesTotalNum],
  );

  const tierAtTargetResult =
    targetSalesValue !== null && Number.isFinite(targetSalesValue)
      ? await query(
          `SELECT min_sales_amount, target_total_salary
           FROM company_sales_target_tiers
           WHERE company_id = $1::int
             AND is_active = TRUE
             AND min_sales_amount <= $2::decimal(12,2)
           ORDER BY min_sales_amount DESC
           LIMIT 1`,
          [companyId, targetSalesValue],
        )
      : { rows: [] };

  const employeeResult = await query(
    `SELECT id, first_name, last_name, employee_code, status
     FROM employees
     WHERE id = $1::int AND company_id = $2::int`,
    [employeeId, companyId],
  );

  return {
    month: targetMonth,
    year: targetYear,
    employee: employeeResult.rows[0] || { id: employeeId },
    target_sales_amount,
    tier_applied: tierResult.rows[0] || null,
    tier_at_target: tierAtTargetResult.rows[0] || null,
    summary: {
      ...summary,
      sales_total: salesTotalNum,
      incentives_total: Number(summary?.incentives_total || 0),
    },
    payment_breakdown: paymentsResult.rows,
    details: detailsResult.rows,
  };
}

/**
 * Performance History across multiple months
 * Grouped strictly by original performance month (performance_year & performance_month)
 */
export async function getPerformanceHistory({ companyId, employeeId, monthsBack = 6 }) {
  const safeMonths = Math.max(1, Math.min(36, Number(monthsBack) || 6));

  const rowsResult = await query(
    `SELECT
       COALESCE(performance_year, EXTRACT(YEAR FROM submitted_at)::int) AS year,
       COALESCE(performance_month, EXTRACT(MONTH FROM submitted_at)::int) AS month,
       id,
       client_name,
       product_name,
       package_type,
       payment_mode,
       sms_quantity,
       rate,
       price,
       price_gross,
       gst_applied,
       incentive_amount,
       client_location,
       client_mobile_1,
       client_mobile_2,
       client_email,
       client_panel_username,
       client_panel_password,
       submitted_at,
       approved_at
     FROM incentive_submissions
     WHERE company_id = $1::int
       AND employee_id = $2::int
       AND status = 'approved'
       AND submitted_at >= (date_trunc('month', NOW()) - (($3::int - 1) * INTERVAL '1 month'))
     ORDER BY submitted_at DESC
     LIMIT 5000`,
    [companyId, employeeId, safeMonths],
  );

  const groupsMap = new Map();
  for (const row of rowsResult.rows) {
    const key = `${row.year}-${row.month}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        year: Number(row.year),
        month: Number(row.month),
        summary: {
          clients_total: 0,
          sales_total: 0,
          incentives_total: 0,
          sms_total: 0,
        },
        details: [],
      });
    }
    const group = groupsMap.get(key);
    group.details.push(row);
    group.summary.clients_total += 1;
    group.summary.sales_total = roundMoney(group.summary.sales_total + Number(row.price || 0));
    group.summary.incentives_total = roundMoney(group.summary.incentives_total + Number(row.incentive_amount || 0));
    group.summary.sms_total += Number(row.sms_quantity || 0);
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return { months_back: safeMonths, groups };
}

/**
 * Idempotent Incentive Approval & Earnings Synchronization
 *
 * Ensures:
 * - Approval does NOT change performance month/year.
 * - Prior-month submissions approved in subsequent months credit the original performance month.
 * - Repeated approvals do NOT duplicate records or amounts.
 * - Rejections and refunds safely remove materialized earnings.
 */
export async function syncIncentiveStatus({
  submissionId,
  companyId,
  nextStatus,
  approvedByUserId,
}) {
  const allowed = ['pending', 'approved', 'rejected', 'refunded'];
  if (!allowed.includes(String(nextStatus))) {
    throw new Error(`Invalid status: ${nextStatus}. Must be one of ${allowed.join(', ')}`);
  }

  // 1. Fetch current submission
  const existing = await query(
    `SELECT *
     FROM incentive_submissions
     WHERE id = $1::int AND company_id = $2::int`,
    [submissionId, companyId],
  );
  if (!existing.rows.length) {
    throw new Error('Incentive submission not found');
  }

  const current = existing.rows[0];
  const perfMonth = current.performance_month || new Date(current.submitted_at).getUTCMonth() + 1;
  const perfYear = current.performance_year || new Date(current.submitted_at).getUTCFullYear();

  // 2. Update submission status and metadata without touching performance_month / performance_year
  const updateResult = await query(
    `UPDATE incentive_submissions
     SET status = $1::varchar(20),
         approved_by = CASE WHEN $1::varchar(20) = 'approved' THEN $2::int ELSE NULL END,
         approved_at = CASE WHEN $1::varchar(20) = 'approved' THEN COALESCE(approved_at, NOW()) ELSE NULL END,
         performance_month = COALESCE(performance_month, $3::int),
         performance_year = COALESCE(performance_year, $4::int)
     WHERE id = $5::int
       AND company_id = $6::int
     RETURNING *`,
    [nextStatus, approvedByUserId, perfMonth, perfYear, submissionId, companyId],
  );
  const updated = updateResult.rows[0];

  // 3. Sync incentive_earnings materialized table
  if (updated.status === 'approved') {
    await query(
      `INSERT INTO incentive_earnings (
         company_id, employee_id, submission_id,
         earned_month, earned_year, earned_at,
         client_name, product_name, package_type, payment_mode, sms_quantity, price, incentive_amount, client_location,
         submitted_at, approved_by, approved_at
       )
       VALUES (
         $1::int, $2::int, $3::int,
         $4::int, $5::int, $6::timestamptz,
         $7, $8, $9, $10, $11::int, $12::decimal(10,2), $13::decimal(10,2), $14,
         $15::timestamptz, $16::int, $17::timestamptz
       )
       ON CONFLICT (submission_id)
       DO UPDATE SET
         earned_month = EXCLUDED.earned_month,
         earned_year = EXCLUDED.earned_year,
         earned_at = EXCLUDED.earned_at,
         client_name = EXCLUDED.client_name,
         product_name = EXCLUDED.product_name,
         package_type = EXCLUDED.package_type,
         payment_mode = EXCLUDED.payment_mode,
         sms_quantity = EXCLUDED.sms_quantity,
         price = EXCLUDED.price,
         incentive_amount = EXCLUDED.incentive_amount,
         client_location = EXCLUDED.client_location,
         approved_by = EXCLUDED.approved_by,
         approved_at = EXCLUDED.approved_at`,
      [
        updated.company_id,
        updated.employee_id,
        updated.id,
        perfMonth,
        perfYear,
        updated.submitted_at, // earned_at corresponds to performance/submission period
        updated.client_name,
        updated.product_name,
        updated.package_type,
        updated.payment_mode,
        updated.sms_quantity || null,
        updated.price || 0,
        updated.incentive_amount,
        updated.client_location,
        updated.submitted_at,
        updated.approved_by,
        updated.approved_at,
      ],
    );
  } else {
    // Rejected, refunded, or pending: remove from earnings
    await query(
      `DELETE FROM incentive_earnings
       WHERE submission_id = $1::int AND company_id = $2::int`,
      [submissionId, companyId],
    );
  }

  return updated;
}
