/**
 * Payroll Calculation Engine — Attendify Enterprise HRMS
 *
 * Core logic:
 * 1. Load employee salary assignment (template + components)
 * 2. Resolve each component value (fixed / percentage / formula / dynamic)
 * 3. Fetch attendance data for the period
 * 4. Prorate basic salary based on present days
 * 5. Fetch approved incentives
 * 6. Calculate deductions (PF, ESI, TDS, leave, late penalty)
 * 7. Return complete payroll snapshot (immutable)
 */

import { query } from '../db.js';
import { parseFormula } from './formulaParser.js';

/**
 * Resolve a single component's computed value.
 *
 * @param {Object} component      - Component row from DB
 * @param {Object} resolvedMap    - Already-resolved component values { code → amount }
 * @param {Object} context        - { ctc, gross_salary, ... }
 * @returns {number}
 */
function resolveComponentValue(component, resolvedMap, context = {}) {
  const vars = { ...resolvedMap, ...context };

  switch (component.calculation_type) {
    case 'fixed':
      return Number(component.effective_value ?? component.default_value ?? 0);

    case 'percentage': {
      const base = component.effective_percentage_of
        ? (vars[component.effective_percentage_of.toLowerCase()] ?? 0)
        : (vars['basic'] ?? vars['ctc'] ?? 0);
      const pct = Number(component.effective_percentage ?? component.percentage_value ?? 0);
      return (pct / 100) * base;
    }

    case 'formula': {
      const expr = component.effective_formula ?? component.formula_expression ?? '';
      return parseFormula(expr, vars);
    }

    case 'dynamic':
      // Dynamic components (incentives, bonuses) are fetched separately
      return Number(vars[component.component_code.toLowerCase()] ?? 0);

    default:
      return 0;
  }
}

/**
 * Resolve all components of a template in dependency order.
 * We do multiple passes until all values stabilise.
 *
 * @param {Array}  components  - Array of component rows
 * @param {Object} context     - Base context { ctc, gross_salary }
 * @returns {Array}  - Array of { component, amount } sorted by display_order
 */
function resolveAllComponents(components, context = {}) {
  const resolvedMap = { ...context };
  const MAX_PASSES = 5;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    for (const comp of components) {
      const amount = resolveComponentValue(comp, resolvedMap, context);
      resolvedMap[comp.component_code.toLowerCase()] = amount;
    }
  }

  return components.map((comp) => ({
    component_id: comp.id,
    component_name: comp.component_name,
    component_code: comp.component_code,
    component_type: comp.component_type,
    calculation_type: comp.calculation_type,
    is_taxable: comp.is_taxable,
    amount: Math.round((resolvedMap[comp.component_code.toLowerCase()] ?? 0) * 100) / 100,
    sort_order: comp.sort_order ?? comp.display_order ?? 0,
  }));
}

/**
 * Fetch the active salary assignment for an employee at a given date.
 *
 * @param {number} employeeId
 * @param {number} companyId
 * @param {string} periodStart  - ISO date string
 * @returns {Object|null}
 */
export async function getEmployeeSalaryAssignment(employeeId, companyId, periodStart) {
  const result = await query(
    `SELECT esa.*, sst.template_name
     FROM employee_salary_assignments esa
     JOIN salary_structure_templates sst ON esa.template_id = sst.id
     WHERE esa.employee_id = $1
       AND esa.company_id  = $2
       AND esa.salary_status = 'active'
       AND esa.effective_from <= $3
       AND (esa.effective_to IS NULL OR esa.effective_to >= $3)
     ORDER BY esa.effective_from DESC
     LIMIT 1`,
    [employeeId, companyId, periodStart],
  );
  return result.rows[0] ?? null;
}

/**
 * Fetch template components with per-template overrides applied.
 *
 * @param {number} templateId
 * @param {number} companyId
 * @returns {Array}
 */
async function getTemplateComponents(templateId, companyId) {
  const result = await query(
    `SELECT
       sc.id,
       sc.component_name,
       sc.component_code,
       sc.component_type,
       sc.calculation_type,
       sc.default_value,
       sc.percentage_of,
       sc.percentage_value,
       sc.formula_expression,
       sc.is_taxable,
       sc.is_mandatory,
       sc.display_order,
       stc.sort_order,
       -- Template-level overrides win over component defaults
       COALESCE(stc.override_value,      sc.default_value)       AS effective_value,
       COALESCE(stc.override_percentage, sc.percentage_value)    AS effective_percentage,
       COALESCE(stc.override_formula,    sc.formula_expression)  AS effective_formula,
       sc.percentage_of AS effective_percentage_of
     FROM salary_template_components stc
     JOIN salary_components sc ON stc.component_id = sc.id
     WHERE stc.template_id = $1
       AND stc.is_active   = true
       AND sc.is_active     = true
       AND sc.company_id    = $2
       AND sc.deleted_at IS NULL
     ORDER BY stc.sort_order ASC, sc.display_order ASC`,
    [templateId, companyId],
  );
  return result.rows;
}

/**
 * Fetch attendance summary for an employee in a payroll period.
 *
 * @param {number} employeeId
 * @param {string} periodStart
 * @param {string} periodEnd
 * @returns {Object}
 */
async function getAttendanceSummary(employeeId, periodStart, periodEnd) {
  const result = await query(
    `SELECT
       COUNT(*)                               FILTER (WHERE status = 'present')   AS present_days,
       COUNT(*)                               FILTER (WHERE status = 'absent')    AS absent_days,
       COUNT(*)                               FILTER (WHERE status = 'on_leave')  AS leave_days,
       COUNT(*)                               FILTER (WHERE status = 'half_day')  AS half_days,
       COALESCE(SUM(late_minutes),        0)                                       AS total_late_minutes,
       COALESCE(SUM(early_leave_minutes), 0)                                       AS total_early_leave_minutes
     FROM attendance_records
     WHERE employee_id = $1
       AND work_date   BETWEEN $2 AND $3`,
    [employeeId, periodStart, periodEnd],
  );
  return result.rows[0] ?? {};
}

/**
 * Fetch approved incentives total for an employee in a payroll period.
 *
 * @param {number} employeeId
 * @param {number} companyId
 * @param {string} periodStart
 * @param {string} periodEnd
 * @returns {number}
 */
async function getApprovedIncentives(employeeId, companyId, periodStart, periodEnd) {
  const result = await query(
    `SELECT COALESCE(SUM(incentive_amount), 0) AS total
     FROM incentive_submissions
     WHERE employee_id = $1
       AND company_id  = $2
       AND status      = 'approved'
       AND approved_at IS NOT NULL
       AND (
         (approved_at::date BETWEEN $3 AND $4)
         OR
         (created_at::date BETWEEN $3 AND $4 AND status = 'approved')
       )`,
    [employeeId, companyId, periodStart, periodEnd],
  );
  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Fetch shift penalty rates for an employee.
 *
 * @param {number} employeeId
 * @returns {{ late_penalty_per_minute: number, early_leave_penalty_per_minute: number }}
 */
async function getShiftPenaltyRates(employeeId) {
  const result = await query(
    `SELECT s.late_penalty_per_minute, s.early_leave_penalty_per_minute
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.employee_id = $1
       AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
     ORDER BY es.effective_from DESC
     LIMIT 1`,
    [employeeId],
  );
  return result.rows[0] ?? { late_penalty_per_minute: 0, early_leave_penalty_per_minute: 0 };
}

/**
 * Fetch unpaid leave days for an employee in a payroll period.
 *
 * @param {number} employeeId
 * @param {string} periodStart
 * @param {string} periodEnd
 * @returns {number}
 */
async function getUnpaidLeaveDays(employeeId, periodStart, periodEnd) {
  const result = await query(
    `SELECT COALESCE(SUM(lr.total_days), 0) AS total_unpaid
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.employee_id = $1
       AND lr.status       = 'approved'
       AND lt.is_paid      = false
       AND lr.start_date  <= $3
       AND lr.end_date    >= $2`,
    [employeeId, periodStart, periodEnd],
  );
  return Number(result.rows[0]?.total_unpaid ?? 0);
}

/**
 * Main payroll calculation function for a single employee.
 *
 * @param {Object} params
 * @param {number} params.employeeId
 * @param {number} params.companyId
 * @param {string} params.periodStart   - ISO date "YYYY-MM-DD"
 * @param {string} params.periodEnd     - ISO date "YYYY-MM-DD"
 * @param {number} params.workingDays   - Configurable working days (from payroll_settings)
 * @param {number} params.overtimeRate  - Overtime multiplier (default 1.5)
 * @returns {Object} Payroll calculation result
 */
export async function calculateEmployeePayroll({
  employeeId,
  companyId,
  periodStart,
  periodEnd,
  workingDays = 26,
  overtimeRate = 1.5,
}) {
  // 1. Get salary assignment
  const assignment = await getEmployeeSalaryAssignment(employeeId, companyId, periodStart);
  if (!assignment) {
    return {
      success: false,
      reason: 'no_assignment',
      message: 'No active salary assignment found for this employee',
    };
  }

  // 2. Get template components
  const components = await getTemplateComponents(assignment.template_id, companyId);
  if (components.length === 0) {
    return {
      success: false,
      reason: 'no_components',
      message: 'Salary template has no active components',
    };
  }

  // 3. Get attendance
  const attendance = await getAttendanceSummary(employeeId, periodStart, periodEnd);
  const presentDays    = Number(attendance.present_days ?? 0);
  const absentDays     = Number(attendance.absent_days ?? 0);
  const leaveDays      = Number(attendance.leave_days ?? 0);
  const halfDays       = Number(attendance.half_days ?? 0);
  const lateMinutes    = Number(attendance.total_late_minutes ?? 0);
  const earlyLeaveMin  = Number(attendance.total_early_leave_minutes ?? 0);

  // 4. Get unpaid leave days
  const unpaidLeaveDays = await getUnpaidLeaveDays(employeeId, periodStart, periodEnd);

  // 5. Get approved incentives
  const incentiveTotal = await getApprovedIncentives(employeeId, companyId, periodStart, periodEnd);

  // 6. Get shift penalties
  const shiftPenalties = await getShiftPenaltyRates(employeeId);

  // 7. Build context for formula resolution
  const ctc = Number(assignment.ctc ?? 0);
  const grossSalary = Number(assignment.gross_salary ?? ctc);
  const paidDays = presentDays + leaveDays + (halfDays * 0.5);
  const dailyRate = grossSalary / workingDays;

  // Context passed to formula parser
  const baseContext = {
    ctc,
    gross: grossSalary,
    gross_salary: grossSalary,
    working_days: workingDays,
    present_days: presentDays,
    paid_days: paidDays,
    daily_rate: dailyRate,
    incentive: incentiveTotal,
  };

  // 8. Resolve all component values
  const resolvedComponents = resolveAllComponents(components, baseContext);

  // Split into earnings and deductions
  const earningComponents   = resolvedComponents.filter(c => c.component_type === 'earning');
  const deductionComponents = resolvedComponents.filter(c => c.component_type === 'deduction');

  // 9. Prorate earnings based on present days
  // Find basic salary component to prorate
  const basicComponent = earningComponents.find(c =>
    c.component_code.toLowerCase() === 'basic' ||
    c.component_name.toLowerCase().includes('basic')
  );
  const basicMonthly = basicComponent?.amount ?? 0;
  const basicEarned  = (basicMonthly / workingDays) * paidDays;

  // Prorate all earning components (except dynamic like incentives)
  const proratedEarnings = earningComponents.map(c => {
    if (c.calculation_type === 'dynamic') {
      return { ...c, amount: incentiveTotal };
    }
    const proratedAmount = (c.amount / workingDays) * paidDays;
    return { ...c, amount: Math.round(proratedAmount * 100) / 100 };
  });

  // 10. Calculate penalties and leave deductions
  const latePenalty       = Number(shiftPenalties.late_penalty_per_minute)       * lateMinutes;
  const earlyLeavePenalty = Number(shiftPenalties.early_leave_penalty_per_minute) * earlyLeaveMin;
  const leaveDeduction    = unpaidLeaveDays * dailyRate;

  // 11. Overtime
  const overtimeHours  = Math.floor((attendance.total_overtime_minutes ?? 0) / 60);
  const hourlyRate     = dailyRate / 8;
  const overtimeAmount = overtimeHours * hourlyRate * overtimeRate;

  // 12. Compute totals
  const totalEarnings   = proratedEarnings.reduce((s, c) => s + c.amount, 0);
  const totalDeductions = deductionComponents.reduce((s, c) => s + c.amount, 0);
  const grossPay        = totalEarnings + overtimeAmount;
  const netSalary       = Math.max(0, grossPay - totalDeductions - leaveDeduction - latePenalty - earlyLeavePenalty);

  // 13. Build snapshot
  return {
    success: true,
    assignment_id: assignment.id,
    ctc,
    gross_salary: grossSalary,
    working_days: workingDays,
    present_days: presentDays,
    absent_days: absentDays,
    paid_leave_days: leaveDays,
    unpaid_leave_days: unpaidLeaveDays,
    late_minutes: lateMinutes,
    overtime_minutes: attendance.total_overtime_minutes ?? 0,
    basic_earned: Math.round(basicEarned * 100) / 100,
    incentive_total: incentiveTotal,
    overtime_amount: Math.round(overtimeAmount * 100) / 100,
    total_earnings: Math.round(totalEarnings * 100) / 100,
    total_deductions: Math.round((totalDeductions + leaveDeduction + latePenalty + earlyLeavePenalty) * 100) / 100,
    leave_deduction: Math.round(leaveDeduction * 100) / 100,
    late_penalty: Math.round((latePenalty + earlyLeavePenalty) * 100) / 100,
    gross_salary_paid: Math.round(grossPay * 100) / 100,
    net_salary: Math.round(netSalary * 100) / 100,
    earnings_snapshot: proratedEarnings,
    deductions_snapshot: deductionComponents.map(c => ({
      ...c,
      amount: Math.round(c.amount * 100) / 100,
    })),
    attendance_snapshot: {
      present_days: presentDays,
      absent_days: absentDays,
      leave_days: leaveDays,
      half_days: halfDays,
      unpaid_leave_days: unpaidLeaveDays,
      late_minutes: lateMinutes,
      late_penalty: Math.round(latePenalty * 100) / 100,
      early_leave_penalty: Math.round(earlyLeavePenalty * 100) / 100,
    },
  };
}

/**
 * Run payroll for all active employees in a company for a given cycle.
 *
 * @param {number} cycleId
 * @param {number} companyId
 * @param {string} periodStart
 * @param {string} periodEnd
 * @param {number} workingDays
 * @param {number} processedBy  - User ID
 * @param {Object} pgClient     - PostgreSQL client (for transaction support)
 * @returns {{ processed: number, skipped: number, errors: Array }}
 */
export async function runPayrollCycle(cycleId, companyId, periodStart, periodEnd, workingDays, processedBy, pgClient) {
  const qFn = pgClient
    ? (text, params) => pgClient.query(text, params)
    : query;

  // Get all active employees
  const empResult = await qFn(
    `SELECT e.id, e.first_name, e.last_name, e.employee_code
     FROM employees e
     WHERE e.company_id = $1
       AND e.status     = 'active'`,
    [companyId],
  );

  const employees = empResult.rows;
  let processed = 0;
  let skipped   = 0;
  const errors  = [];

  for (const emp of employees) {
    try {
      const calc = await calculateEmployeePayroll({
        employeeId: emp.id,
        companyId,
        periodStart,
        periodEnd,
        workingDays,
      });

      if (!calc.success) {
        skipped++;
        errors.push({ employee_id: emp.id, employee_code: emp.employee_code, reason: calc.message });
        continue;
      }

      // Upsert run item
      await qFn(
        `INSERT INTO payroll_run_items (
           company_id, cycle_id, employee_id, assignment_id,
           working_days, present_days, absent_days, paid_leave_days,
           unpaid_leave_days, late_minutes, overtime_minutes,
           basic_earned, total_earnings, incentive_total, overtime_amount,
           total_deductions, leave_deduction, late_penalty,
           gross_salary, net_salary,
           earnings_snapshot, deductions_snapshot, attendance_snapshot,
           status, processed_by, processed_at, updated_at
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $15,
           $16, $17, $18,
           $19, $20,
           $21, $22, $23,
           'draft', $24, now(), now()
         )
         ON CONFLICT (cycle_id, employee_id) DO UPDATE SET
           assignment_id        = EXCLUDED.assignment_id,
           working_days         = EXCLUDED.working_days,
           present_days         = EXCLUDED.present_days,
           absent_days          = EXCLUDED.absent_days,
           paid_leave_days      = EXCLUDED.paid_leave_days,
           unpaid_leave_days    = EXCLUDED.unpaid_leave_days,
           late_minutes         = EXCLUDED.late_minutes,
           overtime_minutes     = EXCLUDED.overtime_minutes,
           basic_earned         = EXCLUDED.basic_earned,
           total_earnings       = EXCLUDED.total_earnings,
           incentive_total      = EXCLUDED.incentive_total,
           overtime_amount      = EXCLUDED.overtime_amount,
           total_deductions     = EXCLUDED.total_deductions,
           leave_deduction      = EXCLUDED.leave_deduction,
           late_penalty         = EXCLUDED.late_penalty,
           gross_salary         = EXCLUDED.gross_salary,
           net_salary           = EXCLUDED.net_salary,
           earnings_snapshot    = EXCLUDED.earnings_snapshot,
           deductions_snapshot  = EXCLUDED.deductions_snapshot,
           attendance_snapshot  = EXCLUDED.attendance_snapshot,
           processed_by         = EXCLUDED.processed_by,
           processed_at         = now(),
           updated_at           = now()
         WHERE payroll_run_items.frozen_at IS NULL`,
        [
          companyId, cycleId, emp.id, calc.assignment_id,
          calc.working_days, calc.present_days, calc.absent_days, calc.paid_leave_days,
          calc.unpaid_leave_days, calc.late_minutes, calc.overtime_minutes,
          calc.basic_earned, calc.total_earnings, calc.incentive_total, calc.overtime_amount,
          calc.total_deductions, calc.leave_deduction, calc.late_penalty,
          calc.gross_salary_paid, calc.net_salary,
          JSON.stringify(calc.earnings_snapshot),
          JSON.stringify(calc.deductions_snapshot),
          JSON.stringify(calc.attendance_snapshot),
          processedBy,
        ],
      );

      processed++;
    } catch (err) {
      errors.push({ employee_id: emp.id, employee_code: emp.employee_code, reason: err.message });
    }
  }

  return { processed, skipped, errors, total: employees.length };
}
