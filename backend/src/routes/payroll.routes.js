/**
 * Payroll Routes — Attendify Enterprise HRMS
 *
 * Full REST API for enterprise payroll:
 *   - Payroll Settings
 *   - Salary Components
 *   - Salary Structure Templates
 *   - Employee Salary Assignment
 *   - Payroll Cycles (create, run, approve, mark-paid)
 *   - Payroll Run Items
 *   - Payslips
 *   - Audit Log
 *   - Backward-compatible legacy endpoints
 */

import express from 'express';
import { pool, query } from '../db.js';
import {
  authenticate,
  authorize,
  requireCompanyContext,
  tenantIsolation,
} from '../middleware/auth.middleware.js';
import { autoMarkAbsent } from '../utils/attendanceHelper.js';
import { sendEmail } from '../utils/email.js';
import { runPayrollCycle, calculateEmployeePayroll } from '../services/payrollEngine.js';
import { validateFormula } from '../services/formulaParser.js';
import { writePayrollAudit, getRequestMeta } from '../utils/payrollAudit.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/settings', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM payroll_settings WHERE company_id = $1',
      [req.companyId],
    );
    if (result.rows.length === 0) {
      // Return defaults if not configured yet
      return res.json({
        company_id: req.companyId,
        salary_cycle: 'monthly',
        payroll_start_day: 1,
        payroll_end_day: 31,
        salary_payout_day: 5,
        working_days_rule: 26,
        overtime_rate: 1.5,
        late_penalty_enabled: true,
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/settings', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const {
    salary_cycle = 'monthly',
    payroll_start_day = 1,
    payroll_end_day = 31,
    salary_payout_day = 5,
    working_days_rule = 26,
    overtime_rate = 1.5,
    late_penalty_enabled = true,
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO payroll_settings
         (company_id, salary_cycle, payroll_start_day, payroll_end_day,
          salary_payout_day, working_days_rule, overtime_rate, late_penalty_enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (company_id) DO UPDATE SET
         salary_cycle         = EXCLUDED.salary_cycle,
         payroll_start_day    = EXCLUDED.payroll_start_day,
         payroll_end_day      = EXCLUDED.payroll_end_day,
         salary_payout_day    = EXCLUDED.salary_payout_day,
         working_days_rule    = EXCLUDED.working_days_rule,
         overtime_rate        = EXCLUDED.overtime_rate,
         late_penalty_enabled = EXCLUDED.late_penalty_enabled,
         updated_at           = now()
       RETURNING *`,
      [req.companyId, salary_cycle, payroll_start_day, payroll_end_day,
       salary_payout_day, working_days_rule, overtime_rate, late_penalty_enabled],
    );

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'settings_updated', entityType: 'payroll_settings',
      newValues: req.body, ...getRequestMeta(req),
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SALARY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/components', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM salary_components
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY display_order ASC, component_type, component_name`,
      [req.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/components', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const {
    component_name, component_code, component_type,
    calculation_type, default_value, percentage_of,
    percentage_value, formula_expression, is_taxable,
    is_mandatory = true, display_order = 0,
  } = req.body;

  if (!component_name || !component_code || !component_type || !calculation_type) {
    return res.status(400).json({ message: 'component_name, component_code, component_type, and calculation_type are required' });
  }

  if (!['earning', 'deduction'].includes(component_type)) {
    return res.status(400).json({ message: 'component_type must be earning or deduction' });
  }

  if (!['fixed', 'percentage', 'formula', 'dynamic'].includes(calculation_type)) {
    return res.status(400).json({ message: 'Invalid calculation_type' });
  }

  // Validate formula if provided
  if (calculation_type === 'formula' && formula_expression) {
    const check = validateFormula(formula_expression);
    if (!check.valid) {
      return res.status(400).json({ message: `Invalid formula: ${check.error}` });
    }
  }

  try {
    const result = await query(
      `INSERT INTO salary_components
         (company_id, component_name, component_code, component_type,
          calculation_type, default_value, percentage_of, percentage_value,
          formula_expression, is_taxable, is_mandatory, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [req.companyId, component_name, component_code.toUpperCase(), component_type,
       calculation_type, default_value === '' ? 0 : (default_value ?? 0), percentage_of === '' ? null : (percentage_of ?? null), percentage_value === '' ? null : (percentage_value ?? null),
       formula_expression === '' ? null : (formula_expression ?? null), is_taxable ?? false, is_mandatory, display_order === '' ? 0 : (display_order ?? 0)],
    );

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'component_created', entityType: 'salary_component',
      entityId: result.rows[0].id, newValues: result.rows[0], ...getRequestMeta(req),
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: `Component code '${component_code}' already exists` });
    res.status(500).json({ message: err.message });
  }
});

router.put('/components/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { id } = req.params;
  const {
    component_name, component_type, calculation_type,
    default_value, percentage_of, percentage_value,
    formula_expression, is_taxable, is_mandatory, is_active, display_order,
  } = req.body;

  if (calculation_type === 'formula' && formula_expression) {
    const check = validateFormula(formula_expression);
    if (!check.valid) {
      return res.status(400).json({ message: `Invalid formula: ${check.error}` });
    }
  }

  try {
    const old = await query('SELECT * FROM salary_components WHERE id = $1 AND company_id = $2', [id, req.companyId]);
    if (old.rows.length === 0) return res.status(404).json({ message: 'Component not found' });

    const result = await query(
      `UPDATE salary_components SET
         component_name     = COALESCE($1, component_name),
         component_type     = COALESCE($2, component_type),
         calculation_type   = COALESCE($3, calculation_type),
         default_value      = COALESCE($4, default_value),
         percentage_of      = COALESCE($5, percentage_of),
         percentage_value   = COALESCE($6, percentage_value),
         formula_expression = COALESCE($7, formula_expression),
         is_taxable         = COALESCE($8, is_taxable),
         is_mandatory       = COALESCE($9, is_mandatory),
         is_active          = COALESCE($10, is_active),
         display_order      = COALESCE($11, display_order),
         updated_at         = now()
       WHERE id = $12 AND company_id = $13
       RETURNING *`,
      [component_name, component_type, calculation_type, default_value === '' ? 0 : default_value,
       percentage_of === '' ? null : percentage_of, percentage_value === '' ? null : percentage_value, formula_expression === '' ? null : formula_expression, is_taxable,
       is_mandatory, is_active, display_order === '' ? 0 : display_order, id, req.companyId],
    );

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'component_updated', entityType: 'salary_component', entityId: Number(id),
      oldValues: old.rows[0], newValues: result.rows[0], ...getRequestMeta(req),
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/components/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    await query(
      'UPDATE salary_components SET deleted_at = now(), is_active = false WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId],
    );
    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'component_deleted', entityType: 'salary_component',
      entityId: Number(req.params.id), ...getRequestMeta(req),
    });
    res.json({ message: 'Component deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SALARY STRUCTURE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/templates', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT sst.*,
         COUNT(stc.id) AS component_count,
         u.email AS created_by_email
       FROM salary_structure_templates sst
       LEFT JOIN salary_template_components stc ON stc.template_id = sst.id AND stc.is_active = true
       LEFT JOIN users u ON sst.created_by = u.id
       WHERE sst.company_id = $1 AND sst.deleted_at IS NULL
       GROUP BY sst.id, u.email
       ORDER BY sst.template_name`,
      [req.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/templates', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { template_name, description, components = [] } = req.body;

  if (!template_name) return res.status(400).json({ message: 'template_name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tResult = await client.query(
      `INSERT INTO salary_structure_templates (company_id, template_name, description, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.companyId, template_name, description ?? null, req.user.id],
    );
    const template = tResult.rows[0];

    // Attach components
    for (const comp of components) {
      await client.query(
        `INSERT INTO salary_template_components
           (template_id, component_id, sort_order, override_value, override_percentage, override_formula)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (template_id, component_id) DO NOTHING`,
        [template.id, comp.component_id, comp.sort_order ?? 0,
         comp.override_value ?? null, comp.override_percentage ?? null, comp.override_formula ?? null],
      );
    }

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'template_created', entityType: 'salary_structure_template',
      entityId: template.id, newValues: { template_name, component_count: components.length },
      ...getRequestMeta(req),
    });

    res.status(201).json(template);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.get('/templates/:id', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const tResult = await query(
      'SELECT * FROM salary_structure_templates WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.companyId],
    );
    if (tResult.rows.length === 0) return res.status(404).json({ message: 'Template not found' });

    const compResult = await query(
      `SELECT stc.*, sc.component_name, sc.component_code, sc.component_type,
              sc.calculation_type, sc.default_value, sc.percentage_of, sc.percentage_value,
              sc.formula_expression, sc.is_taxable, sc.is_mandatory, sc.display_order
       FROM salary_template_components stc
       JOIN salary_components sc ON stc.component_id = sc.id
       WHERE stc.template_id = $1 AND stc.is_active = true AND sc.deleted_at IS NULL
       ORDER BY stc.sort_order, sc.display_order`,
      [req.params.id],
    );

    res.json({ ...tResult.rows[0], components: compResult.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/templates/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { template_name, description, is_active, components } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE salary_structure_templates SET
         template_name = COALESCE($1, template_name),
         description   = COALESCE($2, description),
         is_active     = COALESCE($3, is_active),
         updated_at    = now()
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [template_name, description, is_active, req.params.id, req.companyId],
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Template not found' });
    }

    // Update components if provided
    if (Array.isArray(components)) {
      // Deactivate all existing
      await client.query('UPDATE salary_template_components SET is_active = false WHERE template_id = $1', [req.params.id]);

      // Re-insert/update active ones
      for (const comp of components) {
        await client.query(
          `INSERT INTO salary_template_components
             (template_id, component_id, sort_order, override_value, override_percentage, override_formula, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,true)
           ON CONFLICT (template_id, component_id) DO UPDATE SET
             sort_order          = EXCLUDED.sort_order,
             override_value      = EXCLUDED.override_value,
             override_percentage = EXCLUDED.override_percentage,
             override_formula    = EXCLUDED.override_formula,
             is_active           = true`,
          [req.params.id, comp.component_id, comp.sort_order ?? 0,
           comp.override_value ?? null, comp.override_percentage ?? null, comp.override_formula ?? null],
        );
      }
    }

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'template_updated', entityType: 'salary_structure_template',
      entityId: Number(req.params.id), ...getRequestMeta(req),
    });

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.delete('/templates/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    await query(
      'UPDATE salary_structure_templates SET deleted_at = now(), is_active = false WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId],
    );
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE SALARY ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/assignments', authenticate, authorize('company_admin', 'super_admin', 'hr_manager'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT esa.*,
         e.first_name, e.last_name, e.employee_code,
         sst.template_name
       FROM employee_salary_assignments esa
       JOIN employees e ON esa.employee_id = e.id
       JOIN salary_structure_templates sst ON esa.template_id = sst.id
       WHERE esa.company_id = $1
       ORDER BY e.first_name, esa.effective_from DESC`,
      [req.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/assignments/:employeeId', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT esa.*,
         sst.template_name,
         e.first_name, e.last_name, e.employee_code
       FROM employee_salary_assignments esa
       JOIN salary_structure_templates sst ON esa.template_id = sst.id
       JOIN employees e ON esa.employee_id = e.id
       WHERE esa.employee_id = $1 AND esa.company_id = $2
       ORDER BY esa.effective_from DESC`,
      [req.params.employeeId, req.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/assignments', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const {
    employee_id, template_id, effective_from, ctc,
    gross_salary, payment_type = 'bank_transfer',
    bank_account, bank_ifsc, bank_name, notes,
  } = req.body;

  if (!employee_id || !template_id || !effective_from || !ctc) {
    return res.status(400).json({ message: 'employee_id, template_id, effective_from, ctc are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deactivate previous assignment (set effective_to)
    await client.query(
      `UPDATE employee_salary_assignments
       SET salary_status = 'revised', effective_to = $1::date - 1, updated_at = now()
       WHERE employee_id = $2 AND company_id = $3 AND salary_status = 'active'`,
      [effective_from, employee_id, req.companyId],
    );

    const result = await client.query(
      `INSERT INTO employee_salary_assignments
         (company_id, employee_id, template_id, effective_from, ctc, gross_salary,
          payment_type, bank_account, bank_ifsc, bank_name, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [req.companyId, employee_id, template_id, effective_from, ctc,
       gross_salary ?? ctc, payment_type, bank_account ?? null, bank_ifsc ?? null,
       bank_name ?? null, notes ?? null, req.user.id],
    );

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'assignment_created', entityType: 'employee_salary_assignment',
      entityId: result.rows[0].id, newValues: result.rows[0], ...getRequestMeta(req),
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.put('/assignments/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { ctc, gross_salary, payment_type, bank_account, bank_ifsc, bank_name, notes } = req.body;
  try {
    const result = await query(
      `UPDATE employee_salary_assignments SET
         ctc          = COALESCE($1, ctc),
         gross_salary = COALESCE($2, gross_salary),
         payment_type = COALESCE($3, payment_type),
         bank_account = COALESCE($4, bank_account),
         bank_ifsc    = COALESCE($5, bank_ifsc),
         bank_name    = COALESCE($6, bank_name),
         notes        = COALESCE($7, notes),
         updated_at   = now()
       WHERE id = $8 AND company_id = $9
       RETURNING *`,
      [ctc, gross_salary, payment_type, bank_account, bank_ifsc, bank_name, notes, req.params.id, req.companyId],
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Assignment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL CYCLES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/cycles', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT pc.*,
         COUNT(pri.id) AS total_employees,
         SUM(pri.net_salary) AS total_net_salary,
         SUM(pri.gross_salary) AS total_gross_salary,
         u1.email AS initiated_by_email,
         u2.email AS approved_by_email
       FROM payroll_cycles pc
       LEFT JOIN payroll_run_items pri ON pri.cycle_id = pc.id
       LEFT JOIN users u1 ON pc.initiated_by = u1.id
       LEFT JOIN users u2 ON pc.approved_by  = u2.id
       WHERE pc.company_id = $1
       GROUP BY pc.id, u1.email, u2.email
       ORDER BY pc.cycle_year DESC, pc.cycle_month DESC`,
      [req.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/cycles', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { cycle_month, cycle_year, payout_date, notes } = req.body;

  if (!cycle_month || !cycle_year) {
    return res.status(400).json({ message: 'cycle_month and cycle_year are required' });
  }

  try {
    // Get payroll settings for period dates
    const settingsResult = await query(
      'SELECT * FROM payroll_settings WHERE company_id = $1',
      [req.companyId],
    );
    const settings = settingsResult.rows[0] ?? { payroll_start_day: 1, payroll_end_day: 31, salary_payout_day: 5 };

    const periodStart = `${cycle_year}-${String(cycle_month).padStart(2, '0')}-${String(settings.payroll_start_day).padStart(2, '0')}`;
    const lastDayOfMonth = new Date(cycle_year, cycle_month, 0).getDate();
    const endDay = Math.min(settings.payroll_end_day, lastDayOfMonth);
    const periodEnd = `${cycle_year}-${String(cycle_month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const result = await query(
      `INSERT INTO payroll_cycles
         (company_id, cycle_month, cycle_year, period_start, period_end, payout_date, initiated_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.companyId, cycle_month, cycle_year, periodStart, periodEnd,
       payout_date ?? null, req.user.id, notes ?? null],
    );

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'cycle_created', entityType: 'payroll_cycle',
      entityId: result.rows[0].id,
      newValues: { cycle_month, cycle_year, period_start: periodStart, period_end: periodEnd },
      ...getRequestMeta(req),
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: `Payroll cycle for ${cycle_month}/${cycle_year} already exists` });
    res.status(500).json({ message: err.message });
  }
});

router.get('/cycles/:id', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const cycleResult = await query(
      `SELECT pc.*, u1.email AS initiated_by_email, u2.email AS approved_by_email
       FROM payroll_cycles pc
       LEFT JOIN users u1 ON pc.initiated_by = u1.id
       LEFT JOIN users u2 ON pc.approved_by  = u2.id
       WHERE pc.id = $1 AND pc.company_id = $2`,
      [req.params.id, req.companyId],
    );
    if (cycleResult.rows.length === 0) return res.status(404).json({ message: 'Cycle not found' });

    const itemsResult = await query(
      `SELECT pri.*,
         e.first_name, e.last_name, e.employee_code,
         d.name AS department_name, dg.title AS designation_title
       FROM payroll_run_items pri
       JOIN employees e ON pri.employee_id = e.id
       LEFT JOIN departments d  ON e.department_id  = d.id
       LEFT JOIN designations dg ON e.designation_id = dg.id
       WHERE pri.cycle_id = $1
       ORDER BY e.first_name`,
      [req.params.id],
    );

    res.json({ ...cycleResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL RUN
// ─────────────────────────────────────────────────────────────────────────────

router.post('/cycles/:id/run', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const cycleId = Number(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock and fetch cycle
    const cycleResult = await client.query(
      'SELECT * FROM payroll_cycles WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [cycleId, req.companyId],
    );
    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    const cycle = cycleResult.rows[0];
    if (cycle.status === 'approved' || cycle.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Cannot re-run a ${cycle.status} payroll cycle` });
    }

    // Update cycle status to processing
    await client.query(
      'UPDATE payroll_cycles SET status = $1, updated_at = now() WHERE id = $2',
      ['processing', cycleId],
    );

    // Get settings
    const settingsResult = await client.query(
      'SELECT working_days_rule, overtime_rate FROM payroll_settings WHERE company_id = $1',
      [req.companyId],
    );
    const settings = settingsResult.rows[0] ?? { working_days_rule: 26, overtime_rate: 1.5 };

    // Auto-mark absents for the period
    try {
      await autoMarkAbsent(req.companyId, null, cycle.period_start, cycle.period_end);
    } catch (e) {
      console.warn('[payroll/run] autoMarkAbsent warning:', e.message);
    }

    await client.query('COMMIT');

    // Run outside the transaction (bulk, uses its own queries)
    const runResult = await runPayrollCycle(
      cycleId,
      req.companyId,
      cycle.period_start,
      cycle.period_end,
      settings.working_days_rule,
      req.user.id,
      null, // Use global pool for bulk run
    );

    // Update cycle status to draft (ready for review)
    await query(
      'UPDATE payroll_cycles SET status = $1, updated_at = now() WHERE id = $2',
      ['draft', cycleId],
    );

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'payroll_run', entityType: 'payroll_cycle', entityId: cycleId,
      newValues: { processed: runResult.processed, skipped: runResult.skipped, errors: runResult.errors },
      ...getRequestMeta(req),
    });

    res.json({
      message: 'Payroll calculated successfully',
      cycle_id: cycleId,
      ...runResult,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post('/cycles/:id/approve', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const cycleId = Number(req.params.id);
  const client  = await pool.connect();

  try {
    await client.query('BEGIN');

    const cycleResult = await client.query(
      'SELECT * FROM payroll_cycles WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [cycleId, req.companyId],
    );
    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Cycle not found' });
    }

    const cycle = cycleResult.rows[0];
    if (cycle.status !== 'draft' && cycle.status !== 'processing') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Cannot approve a ${cycle.status} cycle` });
    }

    // Freeze all run items
    await client.query(
      `UPDATE payroll_run_items
       SET status = 'approved', frozen_at = now(), approved_by = $1, approved_at = now(), updated_at = now()
       WHERE cycle_id = $2 AND frozen_at IS NULL`,
      [req.user.id, cycleId],
    );

    // Update cycle
    await client.query(
      'UPDATE payroll_cycles SET status = $1, approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $3',
      ['approved', req.user.id, cycleId],
    );

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'payroll_approved', entityType: 'payroll_cycle', entityId: cycleId,
      ...getRequestMeta(req),
    });

    res.json({ message: 'Payroll cycle approved and frozen', cycle_id: cycleId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post('/cycles/:id/mark-paid', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const cycleId = Number(req.params.id);
  const { send_emails = false } = req.body;
  const client  = await pool.connect();

  try {
    await client.query('BEGIN');

    const cycleResult = await client.query(
      'SELECT * FROM payroll_cycles WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [cycleId, req.companyId],
    );
    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Cycle not found' });
    }

    const cycle = cycleResult.rows[0];
    if (cycle.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Cycle must be approved before marking paid' });
    }

    await client.query(
      "UPDATE payroll_run_items SET status = 'paid', updated_at = now() WHERE cycle_id = $1",
      [cycleId],
    );
    await client.query(
      'UPDATE payroll_cycles SET status = $1, paid_at = now(), updated_at = now() WHERE id = $2',
      ['paid', cycleId],
    );

    await client.query('COMMIT');

    // Optionally send salary credit emails
    if (send_emails) {
      const itemsResult = await query(
        `SELECT pri.net_salary, e.first_name, u.email
         FROM payroll_run_items pri
         JOIN employees e ON pri.employee_id = e.id
         JOIN users u ON e.user_id = u.id
         WHERE pri.cycle_id = $1`,
        [cycleId],
      );

      const monthName = new Date(cycle.cycle_year, cycle.cycle_month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

      for (const item of itemsResult.rows) {
        try {
          await sendEmail({
            to: item.email,
            subject: `Salary Credited — ${monthName}`,
            text: `Hello ${item.first_name},\n\nYour salary for ${monthName} has been credited.\nNet Salary: ₹${Number(item.net_salary).toLocaleString('en-IN')}\n\nThank you!\nAttendify`,
          });
        } catch (emailErr) {
          console.error('[payroll/mark-paid] Email failed for', item.email, emailErr.message);
        }
      }
    }

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'payroll_paid', entityType: 'payroll_cycle', entityId: cycleId,
      newValues: { send_emails }, ...getRequestMeta(req),
    });

    res.json({ message: 'Payroll marked as paid', cycle_id: cycleId });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post('/cycles/:id/cancel', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const cycleId = Number(req.params.id);
  try {
    const result = await query(
      "UPDATE payroll_cycles SET status = 'cancelled', updated_at = now() WHERE id = $1 AND company_id = $2 AND status IN ('draft','processing') RETURNING *",
      [cycleId, req.companyId],
    );
    if (result.rows.length === 0) return res.status(409).json({ message: 'Cannot cancel — cycle not found or already approved/paid' });
    res.json({ message: 'Cycle cancelled', cycle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/cycles/:id/revert', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const cycleId = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const cycleRes = await client.query('SELECT status FROM payroll_cycles WHERE id = $1 AND company_id = $2 FOR UPDATE', [cycleId, req.companyId]);
    if (cycleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Cycle not found' });
    }
    const cycle = cycleRes.rows[0];
    if (cycle.status !== 'paid' && cycle.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Cannot revert a ${cycle.status} cycle` });
    }

    // Revert cycle status back to draft, unfreeze items, and remove paid_at date
    const updated = await client.query(
      "UPDATE payroll_cycles SET status = 'draft', paid_at = NULL, approved_at = NULL, updated_at = now() WHERE id = $1 RETURNING *",
      [cycleId]
    );
    
    // Unfreeze run items
    await client.query(
      "UPDATE payroll_run_items SET frozen_at = NULL, updated_at = now() WHERE cycle_id = $1",
      [cycleId]
    );

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'payroll_reverted', entityType: 'payroll_cycle', entityId: cycleId,
      newValues: { status: 'draft' }, ...getRequestMeta(req),
    });

    res.json({ message: 'Payroll reverted to draft', cycle: updated.rows[0] });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RUN ITEMS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/cycles/:id/items', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT pri.*,
         e.first_name, e.last_name, e.employee_code, e.bank_account_number, e.bank_name, e.bank_ifsc,
         d.name  AS department_name,
         dg.title AS designation_title
       FROM payroll_run_items pri
       JOIN employees e ON pri.employee_id = e.id
       LEFT JOIN departments d   ON e.department_id   = d.id
       LEFT JOIN designations dg ON e.designation_id = dg.id
       WHERE pri.cycle_id = $1 AND pri.company_id = $2
       ORDER BY e.first_name`,
      [req.params.id, req.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/run-items/:id', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT pri.*,
         e.first_name, e.last_name, e.employee_code, e.bank_account_number, e.bank_name, e.bank_ifsc,
         d.name AS department_name, dg.title AS designation_title,
         pc.cycle_month, pc.cycle_year, pc.period_start, pc.period_end
       FROM payroll_run_items pri
       JOIN employees e ON pri.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations dg ON e.designation_id = dg.id
       JOIN payroll_cycles pc ON pri.cycle_id = pc.id
       WHERE pri.id = $1 AND pri.company_id = $2`,
      [req.params.id, req.companyId],
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Run item not found' });

    // Fetch adjustments
    const adjResult = await query(
      'SELECT * FROM payroll_adjustments WHERE run_item_id = $1 ORDER BY created_at',
      [req.params.id],
    );

    res.json({ ...result.rows[0], adjustments: adjResult.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/run-items/:id/adjust', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { adjustment_type, label, reason, amount } = req.body;

  if (!adjustment_type || !label || !reason || !amount) {
    return res.status(400).json({ message: 'adjustment_type, label, reason, amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify item is not frozen
    const itemResult = await client.query(
      'SELECT * FROM payroll_run_items WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [req.params.id, req.companyId],
    );
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Run item not found' });
    }
    if (itemResult.rows[0].frozen_at) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Cannot adjust a frozen payroll item' });
    }

    // Insert adjustment
    const adjResult = await client.query(
      `INSERT INTO payroll_adjustments (company_id, run_item_id, employee_id, adjustment_type, label, reason, amount, applied_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.companyId, req.params.id, itemResult.rows[0].employee_id, adjustment_type, label, reason, amount, req.user.id],
    );

    // Recompute net salary
    const sign = adjustment_type === 'earning' ? 1 : -1;
    await client.query(
      `UPDATE payroll_run_items SET
         net_salary   = net_salary + $1,
         total_earnings    = CASE WHEN $2 = 'earning' THEN total_earnings + $3 ELSE total_earnings END,
         total_deductions  = CASE WHEN $2 = 'deduction' THEN total_deductions + $3 ELSE total_deductions END,
         updated_at   = now()
       WHERE id = $4`,
      [sign * amount, adjustment_type, amount, req.params.id],
    );

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'run_item_adjusted', entityType: 'payroll_run_item', entityId: Number(req.params.id),
      newValues: adjResult.rows[0], ...getRequestMeta(req),
    });

    res.json(adjResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ─── PATCH individual component amount in snapshot ────────────────────────────
// Body: { earnings_snapshot?: [...], deductions_snapshot?: [...] }
// Allows the preview dialog to save edited component amounts.
router.put('/run-items/:id/snapshot', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { earnings_snapshot, deductions_snapshot } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query(
      'SELECT * FROM payroll_run_items WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [req.params.id, req.companyId],
    );
    if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Run item not found' }); }
    if (itemRes.rows[0].frozen_at)  { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Cannot edit a frozen payroll item' }); }

    const item = itemRes.rows[0];

    // Use provided snapshots or fall back to existing ones
    const newEarnings   = earnings_snapshot   ?? item.earnings_snapshot   ?? [];
    const newDeductions = deductions_snapshot ?? item.deductions_snapshot ?? [];

    // Recalculate totals from updated snapshots
    const totalEarnings   = newEarnings.reduce((s, c)   => s + Number(c.amount ?? 0), 0);
    const totalDeductions = newDeductions.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const incentiveTotal  = newEarnings.filter(c => c.calculation_type === 'dynamic' || c.component_code?.toLowerCase() === 'incentive').reduce((s, c) => s + Number(c.amount ?? 0), 0);

    // Fetch existing adjustments to include in net
    const adjRes = await client.query(
      "SELECT adjustment_type, amount FROM payroll_adjustments WHERE run_item_id = $1",
      [req.params.id],
    );
    const adjNet = adjRes.rows.reduce((s, a) => s + (a.adjustment_type === 'earning' ? 1 : -1) * Number(a.amount), 0);

    const newNet = totalEarnings - totalDeductions + adjNet;

    await client.query(
      `UPDATE payroll_run_items SET
         earnings_snapshot   = $1,
         deductions_snapshot = $2,
         total_earnings      = $3,
         total_deductions    = $4,
         incentive_total     = $5,
         net_salary          = $6,
         updated_at          = now()
       WHERE id = $7`,
      [
        JSON.stringify(newEarnings),
        JSON.stringify(newDeductions),
        totalEarnings,
        totalDeductions,
        incentiveTotal,
        newNet,
        req.params.id,
      ],
    );

    await client.query('COMMIT');

    await writePayrollAudit({
      companyId: req.companyId, userId: req.user.id,
      action: 'run_item_snapshot_edited', entityType: 'payroll_run_item', entityId: Number(req.params.id),
      oldValues: { total_earnings: item.total_earnings, total_deductions: item.total_deductions, net_salary: item.net_salary },
      newValues: { total_earnings: totalEarnings, total_deductions: totalDeductions, net_salary: newNet },
      ...getRequestMeta(req),
    });

    res.json({ message: 'Snapshot updated', total_earnings: totalEarnings, total_deductions: totalDeductions, net_salary: newNet });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// Recalculate single employee
router.post('/run-items/:id/recalculate', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT pri.*, pc.period_start, pc.period_end
       FROM payroll_run_items pri
       JOIN payroll_cycles pc ON pri.cycle_id = pc.id
       WHERE pri.id = $1 AND pri.company_id = $2 FOR UPDATE`,
      [req.params.id, req.companyId],
    );
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Run item not found' });
    }

    const item = itemResult.rows[0];
    if (item.frozen_at) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Cannot recalculate a frozen payroll item' });
    }

    const settingsResult = await client.query(
      'SELECT working_days_rule FROM payroll_settings WHERE company_id = $1',
      [req.companyId],
    );
    const workingDays = settingsResult.rows[0]?.working_days_rule ?? 26;

    await client.query('COMMIT');

    const calc = await calculateEmployeePayroll({
      employeeId: item.employee_id,
      companyId: req.companyId,
      periodStart: item.period_start,
      periodEnd: item.period_end,
      workingDays,
    });

    if (!calc.success) return res.status(400).json({ message: calc.message });

    await query(
      `UPDATE payroll_run_items SET
         working_days = $1, present_days = $2, absent_days = $3, paid_leave_days = $4,
         unpaid_leave_days = $5, late_minutes = $6, basic_earned = $7, total_earnings = $8,
         incentive_total = $9, overtime_amount = $10, total_deductions = $11,
         leave_deduction = $12, late_penalty = $13, gross_salary = $14, net_salary = $15,
         earnings_snapshot = $16, deductions_snapshot = $17, attendance_snapshot = $18,
         processed_by = $19, processed_at = now(), updated_at = now()
       WHERE id = $20`,
      [
        calc.working_days, calc.present_days, calc.absent_days, calc.paid_leave_days,
        calc.unpaid_leave_days, calc.late_minutes, calc.basic_earned, calc.total_earnings,
        calc.incentive_total, calc.overtime_amount, calc.total_deductions,
        calc.leave_deduction, calc.late_penalty, calc.gross_salary_paid, calc.net_salary,
        JSON.stringify(calc.earnings_snapshot), JSON.stringify(calc.deductions_snapshot),
        JSON.stringify(calc.attendance_snapshot), req.user.id, req.params.id,
      ],
    );

    res.json({ message: 'Recalculated', ...calc });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYSLIPS
// ─────────────────────────────────────────────────────────────────────────────

// Company admin: get/generate payslip for a run item
router.get('/run-items/:id/payslip', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT pri.*,
         e.first_name, e.last_name, e.employee_code, e.bank_account_number, e.bank_name, e.bank_ifsc,
         e.joining_date, e.pan_number,
         d.name AS department_name, dg.title AS designation_title,
         pc.cycle_month, pc.cycle_year, pc.period_start, pc.period_end, pc.payout_date,
         c.company_name, c.address, c.phone, c.email AS company_email, c.logo_url,
         c.website, c.gst_number, c.pan_number AS company_pan, c.bank_name AS company_bank_name,
         c.payslip_footer,
         esa.payment_type, esa.bank_account AS emp_bank_account, esa.bank_ifsc AS emp_bank_ifsc,
         esa.bank_name AS emp_bank_name, esa.ctc
       FROM payroll_run_items pri
       JOIN employees e ON pri.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations dg ON e.designation_id = dg.id
       JOIN payroll_cycles pc ON pri.cycle_id = pc.id
       JOIN companies c ON pri.company_id = c.id
       LEFT JOIN employee_salary_assignments esa ON pri.assignment_id = esa.id
       WHERE pri.id = $1 AND pri.company_id = $2`,
      [req.params.id, req.companyId],
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Payroll run item not found' });

    const item = result.rows[0];

    // Fetch adjustments
    const adjResult = await query(
      'SELECT * FROM payroll_adjustments WHERE run_item_id = $1 ORDER BY created_at',
      [req.params.id],
    );

    // Update viewed_at if employee
    if (req.user.role === 'employee') {
      await query(
        'UPDATE payslips SET viewed_by_employee_at = now() WHERE run_item_id = $1',
        [req.params.id],
      );
    }

    res.json({ ...item, adjustments: adjResult.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Employee: view my payslips
router.get('/my-payslips', authenticate, tenantIsolation, async (req, res) => {
  try {
    const empResult = await query(
      'SELECT id, company_id FROM employees WHERE user_id = $1',
      [req.user.id],
    );
    if (empResult.rows.length === 0) return res.status(404).json({ message: 'Employee profile not found' });

    const emp = empResult.rows[0];
    const result = await query(
      `SELECT pri.id, pri.cycle_id, pri.gross_salary, pri.net_salary, pri.status, pri.frozen_at,
         pc.cycle_month, pc.cycle_year, pc.period_start, pc.period_end, pc.payout_date,
         pri.present_days, pri.working_days, pri.total_deductions, pri.incentive_total
       FROM payroll_run_items pri
       JOIN payroll_cycles pc ON pri.cycle_id = pc.id
       WHERE pri.employee_id = $1 AND pri.company_id = $2
         AND pri.status IN ('approved','paid')
       ORDER BY pc.cycle_year DESC, pc.cycle_month DESC`,
      [emp.id, emp.company_id],
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my-payslips/:runItemId', authenticate, tenantIsolation, async (req, res) => {
  try {
    const empResult = await query(
      'SELECT id, company_id FROM employees WHERE user_id = $1',
      [req.user.id],
    );
    if (empResult.rows.length === 0) return res.status(404).json({ message: 'Employee profile not found' });

    const emp = empResult.rows[0];
    const result = await query(
      `SELECT pri.*,
         e.first_name, e.last_name, e.employee_code, e.pan_number, e.joining_date,
         d.name AS department_name, dg.title AS designation_title,
         pc.cycle_month, pc.cycle_year, pc.period_start, pc.period_end, pc.payout_date,
         c.company_name, c.address, c.phone, c.email AS company_email, c.logo_url,
         c.website, c.gst_number, c.payslip_footer,
         esa.payment_type, esa.bank_account AS emp_bank_account, esa.bank_ifsc AS emp_bank_ifsc,
         esa.bank_name AS emp_bank_name, esa.ctc
       FROM payroll_run_items pri
       JOIN employees e ON pri.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations dg ON e.designation_id = dg.id
       JOIN payroll_cycles pc ON pri.cycle_id = pc.id
       JOIN companies c ON pri.company_id = c.id
       LEFT JOIN employee_salary_assignments esa ON pri.assignment_id = esa.id
       WHERE pri.id = $1 AND pri.employee_id = $2 AND pri.status IN ('approved','paid')`,
      [req.params.runItemId, emp.id],
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Payslip not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────

router.get('/history', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  const { month, year, employee_id, status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let whereClause = 'WHERE pri.company_id = $1';
    const params = [req.companyId];

    if (month) { params.push(month); whereClause += ` AND pc.cycle_month = $${params.length}`; }
    if (year)  { params.push(year);  whereClause += ` AND pc.cycle_year  = $${params.length}`; }
    if (employee_id) { params.push(employee_id); whereClause += ` AND pri.employee_id = $${params.length}`; }
    if (status)      { params.push(status);       whereClause += ` AND pri.status = $${params.length}`; }

    params.push(Number(limit)); params.push(offset);

    const result = await query(
      `SELECT pri.id, pri.gross_salary, pri.net_salary, pri.status, pri.present_days, pri.working_days,
         pri.incentive_total, pri.total_deductions, pri.late_penalty, pri.frozen_at,
         e.first_name, e.last_name, e.employee_code,
         pc.cycle_month, pc.cycle_year
       FROM payroll_run_items pri
       JOIN employees e ON pri.employee_id = e.id
       JOIN payroll_cycles pc ON pri.cycle_id = pc.id
       ${whereClause}
       ORDER BY pc.cycle_year DESC, pc.cycle_month DESC, e.first_name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

router.get('/audit-logs', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const result = await query(
      `SELECT pal.*, u.email AS user_email
       FROM payroll_audit_logs pal
       LEFT JOIN users u ON pal.user_id = u.id
       WHERE pal.company_id = $1
       ORDER BY pal.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.companyId, Number(limit), offset],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA VALIDATOR (utility endpoint)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/validate-formula', authenticate, async (req, res) => {
  const { expression } = req.body;
  if (!expression) return res.status(400).json({ message: 'expression is required' });
  const result = validateFormula(expression);
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD-COMPATIBLE LEGACY ENDPOINTS
// (kept so existing frontend still works during migration)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/salary-structure/:employeeId', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM salary_structures
       WHERE employee_id = $1 AND ($2::int IS NULL OR company_id = $2) AND is_active = true
       ORDER BY effective_from DESC LIMIT 1`,
      [req.params.employeeId, req.companyId],
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/salary-structure', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { employee_id, basic_salary, allowances, deductions, effective_from } = req.body;
  try {
    await query(
      'UPDATE salary_structures SET is_active = false WHERE employee_id = $1 AND company_id = $2',
      [employee_id, req.companyId],
    );
    const result = await query(
      `INSERT INTO salary_structures (employee_id, company_id, basic_salary, allowances, deductions, effective_from)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [employee_id, req.companyId, basic_salary, JSON.stringify(allowances), JSON.stringify(deductions), effective_from],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/calculate', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { month, year, employee_id, incentive_amount = 0 } = req.body;
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0];
    await autoMarkAbsent(req.companyId, employee_id || null, startDate, endDate);

    let empIds = [];
    if (employee_id) {
      empIds = [employee_id];
    } else {
      const r = await query('SELECT id FROM employees WHERE company_id = $1 AND status = $2', [req.companyId, 'active']);
      empIds = r.rows.map(e => e.id);
    }

    const results = [];
    for (const empId of empIds) {
      const salaryResult = await query('SELECT * FROM salary_structures WHERE employee_id = $1 AND is_active = true LIMIT 1', [empId]);
      if (!salaryResult.rows.length) continue;
      const salary = salaryResult.rows[0];

      const attResult = await query(
        `SELECT COUNT(*) FILTER (WHERE status = 'present') AS present_days,
                COUNT(*) FILTER (WHERE status = 'absent')  AS absent_days,
                COUNT(*) FILTER (WHERE status = 'on_leave') AS leave_days,
                COALESCE(SUM(late_minutes), 0) AS total_late_minutes,
                COALESCE(SUM(early_leave_minutes), 0) AS total_early_leave_minutes
         FROM attendance_records
         WHERE employee_id = $1 AND EXTRACT(MONTH FROM work_date) = $2 AND EXTRACT(YEAR FROM work_date) = $3`,
        [empId, month, year],
      );
      const att = attResult.rows[0];

      const shiftResult = await query(
        `SELECT s.late_penalty_per_minute, s.early_leave_penalty_per_minute
         FROM employee_shifts es JOIN shifts s ON es.shift_id = s.id
         WHERE es.employee_id = $1 AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE) LIMIT 1`,
        [empId],
      );
      const shift = shiftResult.rows[0] ?? { late_penalty_per_minute: 0, early_leave_penalty_per_minute: 0 };

      const workingDaysResult = await query('SELECT working_days_rule FROM payroll_settings WHERE company_id = $1', [req.companyId]);
      const workingDays = workingDaysResult.rows[0]?.working_days_rule ?? 26;

      const basicSalary       = parseFloat(salary.basic_salary);
      const allowances        = salary.allowances || {};
      const deductions        = salary.deductions || {};
      const totalAllowances   = Object.values(allowances).reduce((s, v) => s + parseFloat(v || 0), 0);
      const totalDeductions   = Object.values(deductions).reduce((s, v) => s + parseFloat(v || 0), 0);

      const incResult = await query(
        `SELECT COALESCE(SUM(incentive_amount),0) AS total FROM incentive_submissions
         WHERE employee_id=$1 AND company_id=$2 AND status='approved' AND approved_at IS NOT NULL
           AND EXTRACT(MONTH FROM approved_at)=$3 AND EXTRACT(YEAR FROM approved_at)=$4`,
        [empId, req.companyId, month, year],
      );
      const incentives = Number(incResult.rows[0]?.total ?? 0) + Number(incentive_amount);

      const tierResult = await query(
        `SELECT min_sales_amount, target_total_salary FROM company_sales_target_tiers
         WHERE company_id=$1 AND is_active=TRUE AND min_sales_amount <= $2
         ORDER BY min_sales_amount DESC LIMIT 1`,
        [req.companyId, 0],
      );
      const targetTotalSalary = Number(tierResult.rows[0]?.target_total_salary ?? 0);
      const extraIncome       = Math.max(0, targetTotalSalary - basicSalary);

      const presentDays        = Number(att.present_days ?? 0);
      const latePenalties      = parseFloat(shift.late_penalty_per_minute) * parseInt(att.total_late_minutes || 0);
      const earlyLeavePenalties = parseFloat(shift.early_leave_penalty_per_minute) * parseInt(att.total_early_leave_minutes || 0);
      const proratedBasic      = (basicSalary / workingDays) * presentDays;
      const proratedExtra      = (extraIncome  / workingDays) * presentDays;
      const grossSalary        = proratedBasic + proratedExtra + totalAllowances + incentives;
      const netSalary          = grossSalary - totalDeductions - latePenalties - earlyLeavePenalties;

      const payrollResult = await query(
        `INSERT INTO payroll_calculations (
           employee_id, company_id, month, year, basic_salary, total_allowances, total_deductions,
           late_penalties, early_leave_penalties, sales_total, target_total_salary, extra_income,
           incentives, gross_salary, net_salary, working_days, present_days, absent_days, leave_days,
           status, processed_by, processed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'processed',$20,NOW())
         ON CONFLICT (employee_id, month, year) DO UPDATE SET
           basic_salary=EXCLUDED.basic_salary, total_allowances=EXCLUDED.total_allowances,
           total_deductions=EXCLUDED.total_deductions, late_penalties=EXCLUDED.late_penalties,
           early_leave_penalties=EXCLUDED.early_leave_penalties, sales_total=EXCLUDED.sales_total,
           target_total_salary=EXCLUDED.target_total_salary, extra_income=EXCLUDED.extra_income,
           incentives=EXCLUDED.incentives, gross_salary=EXCLUDED.gross_salary, net_salary=EXCLUDED.net_salary,
           working_days=EXCLUDED.working_days, present_days=EXCLUDED.present_days,
           absent_days=EXCLUDED.absent_days, leave_days=EXCLUDED.leave_days,
           processed_by=EXCLUDED.processed_by, processed_at=NOW()
         RETURNING *`,
        [empId, req.companyId, month, year, basicSalary, totalAllowances, totalDeductions,
         latePenalties, earlyLeavePenalties, 0, targetTotalSalary, extraIncome,
         incentives, grossSalary, netSalary, workingDays,
         att.present_days, att.absent_days, att.leave_days, req.user.id],
      );
      results.push(payrollResult.rows[0]);
    }

    res.json({ message: 'Payroll calculated successfully', count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/credit', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { month, year, employee_id, note } = req.body;
  if (!month || !year || !employee_id) return res.status(400).json({ message: 'month, year, employee_id required' });

  try {
    const payResult = await query(
      `SELECT pc.*, e.first_name, e.last_name, u.email
       FROM payroll_calculations pc JOIN employees e ON pc.employee_id = e.id JOIN users u ON e.user_id = u.id
       WHERE pc.employee_id = $1 AND pc.month = $2 AND pc.year = $3 AND pc.company_id = $4`,
      [employee_id, month, year, req.companyId],
    );
    if (!payResult.rows.length) return res.status(404).json({ message: 'Payroll record not found' });
    const payroll = payResult.rows[0];

    await query("UPDATE payroll_calculations SET status = 'paid', processed_at = NOW() WHERE id = $1", [payroll.id]);
    try {
      await sendEmail({
        to: payroll.email,
        subject: `Salary credited for ${month}/${year}`,
        text: `Hello ${payroll.first_name},\n\nYour salary for ${month}/${year} has been credited. Net: ₹${payroll.net_salary}.\n${note ? `Note: ${note}\n` : ''}\nThank you!\nAttendify`,
      });
    } catch (e) { console.error('Email failed:', e.message); }

    res.json({ message: 'Salary marked as paid', payroll_id: payroll.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/records', authenticate, tenantIsolation, async (req, res) => {
  const { month, year, employee_id } = req.query;
  try {
    let q = `SELECT pc.*, e.first_name, e.last_name, e.employee_code
             FROM payroll_calculations pc JOIN employees e ON pc.employee_id = e.id
             WHERE ($1::int IS NULL OR pc.company_id = $1)`;
    const params = [req.companyId];
    if (month)       { params.push(month);       q += ` AND pc.month = $${params.length}`; }
    if (year)        { params.push(year);         q += ` AND pc.year = $${params.length}`; }
    if (employee_id) { params.push(employee_id);  q += ` AND pc.employee_id = $${params.length}`; }
    q += ' ORDER BY pc.year DESC, pc.month DESC, e.first_name';
    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/payslips', authenticate, tenantIsolation, async (req, res) => {
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (!empResult.rows.length) return res.status(404).json({ message: 'Employee profile not found' });
    const result = await query(
      `SELECT ps.*, pc.month, pc.year, pc.net_salary
       FROM payslips ps JOIN payroll_calculations pc ON ps.payroll_id = pc.id
       WHERE ps.employee_id = $1 ORDER BY pc.year DESC, pc.month DESC`,
      [empResult.rows[0].id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/payslips/:payrollId', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const payrollResult = await query(
      'SELECT * FROM payroll_calculations WHERE id = $1 AND ($2::int IS NULL OR company_id = $2)',
      [req.params.payrollId, req.companyId],
    );
    if (!payrollResult.rows.length) return res.status(404).json({ message: 'Payroll record not found' });
    const payroll = payrollResult.rows[0];

    const existing = await query('SELECT * FROM payslips WHERE payroll_id = $1', [payroll.id]);
    if (existing.rows.length) return res.json(existing.rows[0]);

    const payslipUrl = `/payslips/${payroll.id}.pdf`;
    const result = await query(
      'INSERT INTO payslips (payroll_id, employee_id, company_id, payslip_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [payroll.id, payroll.employee_id, req.companyId, payslipUrl],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
