/**
 * Payroll Calculation Engine
 *
 * Resolves salary component values using a safe expression parser.
 * NEVER uses eval(). Supports:
 *   - fixed amounts
 *   - percentage of a named variable (e.g. "50% of basic")
 *   - simple arithmetic formulas: basic * 0.12
 */

/**
 * Safe expression evaluator.
 * Only allows: numbers, +, -, *, /, (, ), spaces, and variable references.
 * Variables are substituted before arithmetic evaluation.
 *
 * @param {string} expression  e.g. "basic * 0.12" or "basic + hra"
 * @param {Object} context     e.g. { basic: 20000, hra: 8000 }
 * @returns {number}
 */
export function safeEval(expression, context = {}) {
  // Substitute all known variables (longest first to avoid partial matches)
  let expr = String(expression).trim();
  const keys = Object.keys(context).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = Number(context[key] || 0);
    expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
  }

  // Allow only safe arithmetic characters
  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`Unsafe formula expression: "${expression}"`);
  }

  // Use Function constructor with no access to global scope
  // eslint-disable-next-line no-new-func
  return Number(new Function(`"use strict"; return (${expr});`)());
}

/**
 * Resolves a single component value given the current computation context.
 *
 * @param {Object} component  row from salary_components / salary_template_components
 * @param {Object} context    accumulated values so far { basic, hra, ctc, gross, ... }
 * @param {Object} overrides  per-assignment overrides
 * @returns {number}
 */
export function resolveComponent(component, context, overrides = {}) {
  const calcType = overrides.override_formula
    ? 'formula'
    : overrides.override_percentage != null
      ? 'percentage'
      : overrides.override_value != null
        ? 'fixed'
        : component.calculation_type;

  switch (calcType) {
    case 'fixed':
      return Number(overrides.override_value ?? component.default_value ?? 0);

    case 'percentage': {
      const pct = Number(overrides.override_percentage ?? component.percentage_value ?? 0);
      const base = component.percentage_of
        ? Number(context[component.percentage_of.toLowerCase().replace(/\s/g, '_')] ?? 0)
        : Number(context.gross ?? 0);
      return (base * pct) / 100;
    }

    case 'formula': {
      const expr = overrides.override_formula || component.formula_expression || '0';
      return safeEval(expr, context);
    }

    case 'dynamic':
      // Dynamic components (incentives, bonuses) are injected externally
      return Number(context[component.component_code?.toLowerCase()] ?? 0);

    default:
      return 0;
  }
}

/**
 * Calculates full payroll for one employee for one cycle.
 *
 * @param {Object}  opts
 * @param {Array}   opts.components      Ordered list of {component + template_component overrides}
 * @param {number}  opts.ctc             Annual CTC
 * @param {number}  opts.workingDays     Configured working days (e.g. 26)
 * @param {number}  opts.presentDays     Actual present days this month
 * @param {number}  opts.unpaidLeaveDays Unpaid leave days
 * @param {number}  opts.lateMinutes
 * @param {number}  opts.overtimeMinutes
 * @param {number}  opts.lateRatePerMin  Penalty per late minute
 * @param {number}  opts.overtimeRatePerMin
 * @param {number}  opts.incentiveTotal  Sum of approved incentives
 * @param {number}  opts.bonusTotal
 *
 * @returns {{ earnings, deductions, grossSalary, netSalary, snapshot }}
 */
export function calculatePayroll({
  components = [],
  ctc = 0,
  workingDays = 26,
  presentDays = 0,
  unpaidLeaveDays = 0,
  lateMinutes = 0,
  overtimeMinutes = 0,
  lateRatePerMin = 0,
  overtimeRatePerMin = 0,
  incentiveTotal = 0,
  bonusTotal = 0,
}) {
  const context = {
    ctc: Number(ctc),
    gross: 0, // will be filled after earnings pass
    incentive: Number(incentiveTotal),
    bonus: Number(bonusTotal),
  };

  const earningsSnapshot = [];
  const deductionsSnapshot = [];

  // ── Pass 1: earnings ────────────────────────────────────────
  for (const comp of components.filter((c) => c.component_type === 'earning')) {
    const raw = resolveComponent(comp, context, comp);

    // Prorate attendance-sensitive components (basic, hra, etc.)
    const prorated =
      comp.is_attendance_prorated !== false && workingDays > 0
        ? (raw / workingDays) * presentDays
        : raw;

    const value = roundMoney(prorated);
    context[comp.component_code.toLowerCase()] = value;
    earningsSnapshot.push({ code: comp.component_code, name: comp.component_name, amount: value });
  }

  // Add dynamic earning components
  if (incentiveTotal > 0) {
    earningsSnapshot.push({ code: 'INCENTIVE', name: 'Incentive', amount: roundMoney(incentiveTotal) });
  }
  if (bonusTotal > 0) {
    earningsSnapshot.push({ code: 'BONUS', name: 'Bonus', amount: roundMoney(bonusTotal) });
  }
  if (overtimeMinutes > 0 && overtimeRatePerMin > 0) {
    const overtimeAmt = roundMoney(overtimeMinutes * overtimeRatePerMin);
    earningsSnapshot.push({ code: 'OT', name: 'Overtime', amount: overtimeAmt });
    context.overtime = overtimeAmt;
  }

  const totalEarnings = earningsSnapshot.reduce((s, e) => s + e.amount, 0);
  context.gross = totalEarnings;

  // ── Pass 2: deductions ──────────────────────────────────────
  for (const comp of components.filter((c) => c.component_type === 'deduction')) {
    const value = roundMoney(resolveComponent(comp, context, comp));
    context[comp.component_code.toLowerCase()] = value;
    deductionsSnapshot.push({ code: comp.component_code, name: comp.component_name, amount: value });
  }

  // Attendance-based deductions
  const perDaySalary = workingDays > 0 ? context.basic / workingDays : 0;
  const leaveDeduction = roundMoney(unpaidLeaveDays * perDaySalary);
  const latePenalty = roundMoney(lateMinutes * lateRatePerMin);

  if (leaveDeduction > 0) deductionsSnapshot.push({ code: 'LEAVE_DED', name: 'Leave Deduction', amount: leaveDeduction });
  if (latePenalty > 0) deductionsSnapshot.push({ code: 'LATE_PEN', name: 'Late Penalty', amount: latePenalty });

  const totalDeductions = deductionsSnapshot.reduce((s, d) => s + d.amount, 0);
  const grossSalary = roundMoney(totalEarnings);
  const netSalary = roundMoney(grossSalary - totalDeductions);

  return {
    earningsSnapshot,
    deductionsSnapshot,
    totalEarnings: roundMoney(totalEarnings),
    totalDeductions: roundMoney(totalDeductions),
    incentiveTotal: roundMoney(incentiveTotal),
    bonusTotal: roundMoney(bonusTotal),
    leaveDeduction,
    latePenalty,
    grossSalary,
    netSalary,
    basicEarned: roundMoney(context.basic || 0),
  };
}

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}
