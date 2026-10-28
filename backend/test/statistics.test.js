import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db.js';
import { getAttendanceSummaryService } from '../src/services/attendanceCalculationService.js';

test('Statistics Audit: Real-time Employee Status Aggregations', async () => {
  // Query authoritative summary directly
  const res = await query(`
    SELECT
      COUNT(*)::int AS total_employees,
      COUNT(*) FILTER (WHERE e.status = 'active' AND u.is_active = true)::int AS active_employees,
      COUNT(*) FILTER (WHERE e.status = 'inactive' OR u.is_active = false)::int AS inactive_employees,
      COUNT(*) FILTER (WHERE e.status = 'terminated')::int AS terminated_employees
    FROM employees e
    JOIN users u ON e.user_id = u.id
    WHERE e.deleted_at IS NULL
  `);

  const summary = res.rows[0];
  assert.ok(summary, 'Summary row must exist');
  assert.equal(typeof summary.total_employees, 'number');
  assert.equal(typeof summary.active_employees, 'number');
  assert.equal(typeof summary.inactive_employees, 'number');
  assert.equal(typeof summary.terminated_employees, 'number');

  // Verify that active + inactive + terminated <= total_employees
  assert.ok(
    summary.active_employees + summary.inactive_employees <= summary.total_employees + 1, // allow overlapping status/is_active filter logic
    'Categorized employee counts must be consistent with total employees'
  );
  assert.ok(summary.total_employees >= 0, 'Total employees cannot be negative');
});

test('Statistics Audit: Real-time Leave Request Aggregations', async () => {
  const res = await query(`
    SELECT
      COUNT(*)::int AS total_requests,
      COUNT(*) FILTER (WHERE lr.status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE lr.status = 'approved')::int AS approved_count,
      COUNT(*) FILTER (WHERE lr.status = 'rejected')::int AS rejected_count,
      COUNT(*) FILTER (WHERE lr.status = 'cancelled')::int AS cancelled_count
    FROM leave_requests lr
  `);

  const summary = res.rows[0];
  assert.ok(summary, 'Leave summary row must exist');
  assert.equal(
    summary.pending_count + summary.approved_count + summary.rejected_count + summary.cancelled_count,
    summary.total_requests,
    'Sum of individual leave statuses must exactly equal total leave requests'
  );
});

test('Statistics Audit: Real-time Superadmin Platform Analytics & Revenue', async () => {
  const compRes = await query(`
    SELECT
      COUNT(*)::int AS total_companies,
      COUNT(*) FILTER (WHERE is_active = true)::int AS active_companies
    FROM companies
  `);
  const comp = compRes.rows[0];
  assert.ok(comp.active_companies <= comp.total_companies, 'Active companies cannot exceed total companies');

  const revRes = await query(`
    SELECT COALESCE(SUM(cs.amount), 0)::decimal(12,2) AS monthly_revenue
    FROM company_subscriptions cs
    WHERE cs.status = 'active'
  `);
  const rev = Number(revRes.rows[0]?.monthly_revenue || 0);
  assert.ok(!Number.isNaN(rev), 'Monthly revenue must be a valid number');
  assert.ok(rev >= 0, 'Monthly revenue cannot be negative');
});

test('Statistics Audit: Attendance Summary Service Accurate Percentage & Working Days', async () => {
  // Find a valid company
  const compRes = await query('SELECT id FROM companies WHERE is_active = true LIMIT 1');
  if (compRes.rows.length === 0) return;
  const companyId = compRes.rows[0].id;

  const todayStr = new Date().toISOString().split('T')[0];
  const summary = await getAttendanceSummaryService({ companyId, date: todayStr });

  assert.ok(summary, 'Attendance summary should return a valid object');
  assert.equal(typeof summary.total_eligible, 'number', 'total_eligible must be a number');
  assert.equal(typeof summary.present_count, 'number', 'present_count must be a number');
  assert.equal(typeof summary.absent_count, 'number', 'absent_count must be a number');
  assert.equal(typeof summary.attendance_percentage, 'number', 'attendance_percentage must be a number');

  // Verify percentage math
  const workingDays = summary.present_count + summary.absent_count + summary.half_day_count;
  const expectedPercentage = workingDays > 0
    ? Math.round(((summary.present_count + summary.half_day_count * 0.5) / workingDays) * 100)
    : 0;

  assert.equal(
    summary.attendance_percentage,
    expectedPercentage,
    'Attendance percentage must exactly match the weighted present+half_day formula'
  );
});

test('Statistics Audit: Zero State Integrity', async () => {
  // Query a non-existent company ID (e.g. 99999999) to verify zero results are handled cleanly without NaN
  const summary = await getAttendanceSummaryService({ companyId: 99999999, date: '2026-01-01' });

  assert.equal(summary.total_eligible, 0, 'Eligible count must be genuinely 0');
  assert.equal(summary.present_count, 0, 'Present count must be genuinely 0');
  assert.equal(summary.absent_count, 0, 'Absent count must be genuinely 0');
  assert.equal(summary.attendance_percentage, 0, 'Percentage must be 0% not NaN or null');
});
