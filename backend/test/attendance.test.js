import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db.js';
import {
  isEmployeeEligibleOnDate,
  autoMarkAbsentService,
  getAttendanceSummaryService,
  getDayWiseGroupedAttendanceService,
} from '../src/services/attendanceCalculationService.js';

test('Attendance Lifecycle Eligibility: Active vs Inactive vs Terminated employees', () => {
  // Case 1: Active employee, joining date in the past, no exit date -> Eligible
  const activeEmp = {
    id: 101,
    status: 'active',
    joining_date: '2026-01-01',
    exit_date: null,
    deleted_at: null,
  };
  assert.equal(isEmployeeEligibleOnDate(activeEmp, '2026-05-15'), true, 'Active employee should be eligible');

  // Case 2: Employee before their joining date -> Ineligible
  assert.equal(isEmployeeEligibleOnDate(activeEmp, '2025-12-31'), false, 'Employee before joining date should be ineligible');

  // Case 3: Terminated employee with exit date 2026-06-30
  const terminatedEmp = {
    id: 102,
    status: 'terminated',
    joining_date: '2026-01-01',
    exit_date: '2026-06-30',
    deleted_at: null,
  };
  // Date before exit date -> Eligible historically
  assert.equal(isEmployeeEligibleOnDate(terminatedEmp, '2026-05-15'), true, 'Terminated employee before exit date should be eligible');
  // Date on exit date -> Eligible
  assert.equal(isEmployeeEligibleOnDate(terminatedEmp, '2026-06-30'), true, 'Terminated employee on exit date should be eligible');
  // Date after exit date -> INELIGIBLE (must not accumulate absences)
  assert.equal(isEmployeeEligibleOnDate(terminatedEmp, '2026-07-01'), false, 'Terminated employee after exit date MUST NOT be eligible');
  assert.equal(isEmployeeEligibleOnDate(terminatedEmp, '2026-10-28'), false, 'Terminated employee current date MUST NOT be eligible');

  // Case 4: Soft-deleted employee with deleted_at 2026-08-15
  const deletedEmp = {
    id: 103,
    status: 'inactive',
    joining_date: '2026-01-01',
    exit_date: null,
    deleted_at: '2026-08-15',
  };
  assert.equal(isEmployeeEligibleOnDate(deletedEmp, '2026-08-10'), true, 'Soft-deleted employee before deletion date should be eligible');
  assert.equal(isEmployeeEligibleOnDate(deletedEmp, '2026-08-20'), false, 'Soft-deleted employee after deletion date MUST NOT be eligible');
});

test('Day-wise Grouped Attendance: Returns reconciled counts and groups', async () => {
  const compRes = await query(`SELECT id FROM companies WHERE is_active = true LIMIT 1`);
  if (!compRes.rows.length) return;
  const companyId = compRes.rows[0].id;

  const grouped = await getDayWiseGroupedAttendanceService({
    companyId,
    startDate: '2026-10-01',
    endDate: '2026-10-28',
    limit: 10,
  });

  assert.ok(grouped, 'Grouped response must be returned');
  assert.ok(Array.isArray(grouped.dates), 'dates property must be an array');

  if (grouped.dates.length > 0) {
    const firstDay = grouped.dates[0];
    assert.ok(firstDay.date, 'Day must have date');
    assert.ok(firstDay.day_name, 'Day must have day_name');
    assert.ok(firstDay.counts, 'Day must have counts object');
    assert.ok(typeof firstDay.counts.present === 'number', 'Counts must contain numeric present count');
    assert.ok(typeof firstDay.counts.absent === 'number', 'Counts must contain numeric absent count');
    assert.ok(typeof firstDay.counts.attendance_percentage === 'number', 'Counts must contain attendance_percentage');
    assert.ok(Array.isArray(firstDay.records), 'Day must have records array');
  }
});
