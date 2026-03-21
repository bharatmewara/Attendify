import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { autoMarkAbsent } from '../utils/attendanceHelper.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();

// Get salary structures
router.get('/salary-structure/:employeeId', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM salary_structures 
       WHERE employee_id = $1 AND ($2::int IS NULL OR company_id = $2) AND is_active = true
       ORDER BY effective_from DESC LIMIT 1`,
      [req.params.employeeId, req.companyId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create/Update salary structure
router.post('/salary-structure', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { employee_id, basic_salary, allowances, deductions, effective_from } = req.body;

  try {
    // Deactivate previous salary structures
    await query(
      'UPDATE salary_structures SET is_active = false WHERE employee_id = $1 AND company_id = $2',
      [employee_id, req.companyId]
    );

    const result = await query(
      `INSERT INTO salary_structures (employee_id, company_id, basic_salary, allowances, deductions, effective_from)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [employee_id, req.companyId, basic_salary, JSON.stringify(allowances), JSON.stringify(deductions), effective_from]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Calculate payroll for a month
router.post('/calculate', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { month, year, employee_id, incentive_amount = 0 } = req.body;

  try {
    // Before calculating, run auto-mark absent for the entire month for all employees (or the specific one)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    await autoMarkAbsent(req.companyId, employee_id || null, startDate, endDate);

    let employeeIds = [];
    
    if (employee_id) {
      employeeIds = [employee_id];
    } else {
      const empResult = await query(
        'SELECT id FROM employees WHERE company_id = $1 AND status = $2',
        [req.companyId, 'active']
      );
      employeeIds = empResult.rows.map(e => e.id);
    }

    const results = [];

    for (const empId of employeeIds) {
      // Get salary structure
      const salaryResult = await query(
        'SELECT * FROM salary_structures WHERE employee_id = $1 AND is_active = true LIMIT 1',
        [empId]
      );

      if (salaryResult.rows.length === 0) continue;

      const salary = salaryResult.rows[0];

      // Get attendance data
      const attendanceResult = await query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'present') as present_days,
          COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
          COUNT(*) FILTER (WHERE status = 'on_leave') as leave_days,
          COALESCE(SUM(late_minutes), 0) as total_late_minutes,
          COALESCE(SUM(early_leave_minutes), 0) as total_early_leave_minutes
         FROM attendance_records
         WHERE employee_id = $1 AND EXTRACT(MONTH FROM work_date) = $2 AND EXTRACT(YEAR FROM work_date) = $3`,
        [empId, month, year]
      );

      const attendance = attendanceResult.rows[0];

      // Get shift for penalties
      const shiftResult = await query(
        `SELECT s.late_penalty_per_minute, s.early_leave_penalty_per_minute
         FROM employee_shifts es
         JOIN shifts s ON es.shift_id = s.id
         WHERE es.employee_id = $1 AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
         LIMIT 1`,
        [empId]
      );

      const shift = shiftResult.rows[0] || { late_penalty_per_minute: 0, early_leave_penalty_per_minute: 0 };

      // Calculate
      const workingDays = 26; // Standard working days
      const basicSalary = parseFloat(salary.basic_salary);
      const allowances = salary.allowances || {};
      const deductions = salary.deductions || {};

      const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + parseFloat(val || 0), 0);
      const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + parseFloat(val || 0), 0);

      const approvedIncentiveResult = await query(
        `SELECT COALESCE(SUM(ic.incentive_amount * ir.quantity), 0) AS total
         FROM incentive_requests ir
         JOIN incentive_configs ic ON ic.id = ir.incentive_config_id
         WHERE ir.employee_id = $1
           AND ir.company_id = $2
           AND ir.status = 'approved'
           AND EXTRACT(MONTH FROM ir.requested_at) = $3
           AND EXTRACT(YEAR FROM ir.requested_at) = $4`,
        [empId, req.companyId, month, year],
      );

      const approvedIncentives = Number(approvedIncentiveResult.rows[0]?.total || 0);
      const manualIncentive = employee_id && Number(employee_id) === Number(empId) ? Number(incentive_amount || 0) : 0;
      const incentives = approvedIncentives + manualIncentive;

      const latePenalties = parseFloat(shift.late_penalty_per_minute) * parseInt(attendance.total_late_minutes || 0);
      const earlyLeavePenalties = parseFloat(shift.early_leave_penalty_per_minute) * parseInt(attendance.total_early_leave_minutes || 0);
      const presentDays = Number(attendance.present_days || 0);
      const proratedBasicSalary = (basicSalary / workingDays) * presentDays;

      const grossSalary = proratedBasicSalary + totalAllowances + incentives;
      const netSalary = grossSalary - totalDeductions - latePenalties - earlyLeavePenalties;

      // Save payroll calculation
      const payrollResult = await query(
        `INSERT INTO payroll_calculations (
          employee_id, company_id, month, year, basic_salary, total_allowances, total_deductions,
          late_penalties, early_leave_penalties, incentives, gross_salary, net_salary, working_days,
          present_days, absent_days, leave_days, status, processed_by, processed_at
        ) VALUES ($1::int, $2::int, $3::int, $4::int, $5::decimal, $6::decimal, $7::decimal, $8::decimal, $9::decimal, $10::decimal, $11::decimal, $12::decimal, $13::int, $14::int, $15::int, $16::int, 'processed', $17::int, NOW())
        ON CONFLICT (employee_id, month, year) 
        DO UPDATE SET 
          basic_salary = EXCLUDED.basic_salary,
          total_allowances = EXCLUDED.total_allowances,
          total_deductions = EXCLUDED.total_deductions,
          late_penalties = EXCLUDED.late_penalties,
          early_leave_penalties = EXCLUDED.early_leave_penalties,
          incentives = EXCLUDED.incentives,
          gross_salary = EXCLUDED.gross_salary,
          net_salary = EXCLUDED.net_salary,
          working_days = EXCLUDED.working_days,
          present_days = EXCLUDED.present_days,
          absent_days = EXCLUDED.absent_days,
          leave_days = EXCLUDED.leave_days,
          processed_by = EXCLUDED.processed_by,
          processed_at = NOW()
        RETURNING *`,
        [
          empId, req.companyId, month, year, basicSalary, totalAllowances, totalDeductions,
          latePenalties, earlyLeavePenalties, incentives, grossSalary, netSalary, workingDays,
          attendance.present_days, attendance.absent_days, attendance.leave_days, req.user.id
        ]
      );

      results.push(payrollResult.rows[0]);
    }

    res.json({ message: 'Payroll calculated successfully', count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Credit salary and send email notification
router.post('/credit', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { month, year, employee_id, note } = req.body;

  if (!month || !year || !employee_id) {
    return res.status(400).json({ message: 'month, year, and employee_id are required' });
  }

  try {
    const payResult = await query(
      `SELECT pc.*, e.first_name, e.last_name, u.email
       FROM payroll_calculations pc
       JOIN employees e ON pc.employee_id = e.id
       JOIN users u ON e.user_id = u.id
       WHERE pc.employee_id = $1 AND pc.month = $2 AND pc.year = $3 AND pc.company_id = $4`,
      [employee_id, month, year, req.companyId]
    );

    if (payResult.rows.length === 0) {
      return res.status(404).json({ message: 'Payroll record not found for given employee/month/year' });
    }

    const payroll = payResult.rows[0];
    await query(
      `UPDATE payroll_calculations SET status = 'paid', processed_at = NOW() WHERE id = $1`,
      [payroll.id]
    );

    const subject = `Salary credited for ${month}/${year}`;
    const text = `Hello ${payroll.first_name},\n\nYour salary for ${month}/${year} has been credited. Net salary: ₹${payroll.net_salary}.\n${note ? `Note: ${note}\n` : ''}\nThank you for your effort!\nAttendify`;

    try {
      await sendEmail({ to: payroll.email, subject, text });
    } catch (emailError) {
      console.error('Salary credit email failed', emailError);
    }

    res.json({ message: 'Salary marked as paid and email notification sent', payroll_id: payroll.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get payroll records
router.get('/records', authenticate, tenantIsolation, async (req, res) => {
  const { month, year, employee_id } = req.query;

  try {
    let queryText = `
      SELECT pc.*, e.first_name, e.last_name, e.employee_code
      FROM payroll_calculations pc
      JOIN employees e ON pc.employee_id = e.id
      WHERE ($1::int IS NULL OR pc.company_id = $1)
    `;
    const params = [req.companyId];

    if (month) {
      queryText += ` AND pc.month = $${params.length + 1}`;
      params.push(month);
    }

    if (year) {
      queryText += ` AND pc.year = $${params.length + 1}`;
      params.push(year);
    }

    if (employee_id) {
      queryText += ` AND pc.employee_id = $${params.length + 1}`;
      params.push(employee_id);
    }

    queryText += ' ORDER BY pc.year DESC, pc.month DESC, e.first_name';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee payslips
router.get('/payslips', authenticate, tenantIsolation, async (req, res) => {
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const result = await query(
      `SELECT ps.*, pc.month, pc.year, pc.net_salary
       FROM payslips ps
       JOIN payroll_calculations pc ON ps.payroll_id = pc.id
       WHERE ps.employee_id = $1
       ORDER BY pc.year DESC, pc.month DESC`,
      [empResult.rows[0].id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate payslip
router.post('/payslips/:payrollId', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const payrollResult = await query(
      'SELECT * FROM payroll_calculations WHERE id = $1 AND ($2::int IS NULL OR company_id = $2)',
      [req.params.payrollId, req.companyId]
    );

    if (payrollResult.rows.length === 0) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    const payroll = payrollResult.rows[0];

    // Check if payslip already exists
    const existingPayslip = await query(
      'SELECT * FROM payslips WHERE payroll_id = $1',
      [payroll.id]
    );

    if (existingPayslip.rows.length > 0) {
      return res.json(existingPayslip.rows[0]);
    }

    // Generate payslip (in real app, generate PDF here)
    const payslipUrl = `/payslips/${payroll.id}.pdf`;

    const result = await query(
      `INSERT INTO payslips (payroll_id, employee_id, company_id, payslip_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payroll.id, payroll.employee_id, req.companyId, payslipUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;




