import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();

const applyApprovedLeaveEffects = async ({ leave, companyId }) => {
  const currentYear = new Date().getFullYear();
  await query(
    `UPDATE leave_balances
     SET used_days = used_days + $1, remaining_days = remaining_days - $1, updated_at = NOW()
     WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4`,
    [leave.total_days, leave.employee_id, leave.leave_type_id, currentYear],
  );

  const startDate = new Date(leave.start_date);
  const endDate = new Date(leave.end_date);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    await query(
      `INSERT INTO attendance_records (employee_id, company_id, work_date, status)
       VALUES ($1, $2, $3, 'on_leave')
       ON CONFLICT (employee_id, work_date) DO UPDATE SET status = 'on_leave'`,
      [leave.employee_id, companyId, d.toISOString().split('T')[0]],
    );
  }
};

const getLeaveDays = (startDate, endDate) =>
  Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

const syncLeaveTypeBalancesForEmployees = async ({ companyId, leaveTypeId, daysPerYear }) => {
  const currentYear = new Date().getFullYear();
  const employeesResult = await query(
    `SELECT id
     FROM employees
     WHERE company_id = $1
       AND status = 'active'`,
    [companyId],
  );

  for (const employee of employeesResult.rows) {
    await query(
      `INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days, used_days)
       VALUES ($1, $2, $3, $4, $4, 0)
       ON CONFLICT (employee_id, leave_type_id, year)
       DO UPDATE SET
         total_days = EXCLUDED.total_days,
         remaining_days = GREATEST(0, EXCLUDED.total_days - leave_balances.used_days),
         updated_at = NOW()`,
      [employee.id, leaveTypeId, currentYear, Number(daysPerYear || 0)],
    );
  }
};

// Get leave types
router.get('/types', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM leave_types WHERE ($1::int IS NULL OR company_id = $1) AND is_active = true ORDER BY name',
      [req.companyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create leave type
router.post('/types', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { name, code, days_per_year, carry_forward, max_carry_forward_days, is_paid, requires_document } = req.body;

  try {
    const result = await query(
      `INSERT INTO leave_types (company_id, name, code, days_per_year, carry_forward, max_carry_forward_days, is_paid, requires_document)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.companyId, name, code, days_per_year, carry_forward, max_carry_forward_days, is_paid, requires_document]
    );

    const leaveType = result.rows[0];
    await syncLeaveTypeBalancesForEmployees({
      companyId: req.companyId,
      leaveTypeId: leaveType.id,
      daysPerYear: leaveType.days_per_year,
    });

    res.status(201).json(leaveType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update leave type
router.put('/types/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { name, code, days_per_year, carry_forward, max_carry_forward_days, is_paid, requires_document } = req.body;

  try {
    const result = await query(
      `UPDATE leave_types
       SET name = $1,
           code = $2,
           days_per_year = $3,
           carry_forward = $4,
           max_carry_forward_days = $5,
           is_paid = $6,
           requires_document = $7,
           updated_at = NOW()
       WHERE id = $8
         AND company_id = $9
         AND is_active = true
       RETURNING *`,
      [name, code, days_per_year, carry_forward, max_carry_forward_days, is_paid, requires_document, req.params.id, req.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Leave policy not found' });
    }

    const leaveType = result.rows[0];
    await syncLeaveTypeBalancesForEmployees({
      companyId: req.companyId,
      leaveTypeId: leaveType.id,
      daysPerYear: leaveType.days_per_year,
    });

    return res.json(leaveType);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Delete (deactivate) leave type
router.delete('/types/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `UPDATE leave_types
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
         AND company_id = $2
         AND is_active = true
       RETURNING id`,
      [req.params.id, req.companyId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Leave policy not found' });
    }

    return res.json({ message: 'Leave policy deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
// Get leave requests
router.get('/requests', authenticate, tenantIsolation, async (req, res) => {
  const { status, employee_id } = req.query;

  try {
    let queryText = `
      SELECT lr.*, e.first_name, e.last_name, e.employee_code, lt.name as leave_type_name,
             u.email as approver_email
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users u ON lr.approved_by = u.id
      WHERE ($1::int IS NULL OR lr.company_id = $1)
    `;
    const params = [req.companyId];

    if (req.user.role === 'employee') {
      const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
      queryText += ` AND lr.employee_id = $2`;
      params.push(empResult.rows[0].id);
    } else if (employee_id) {
      queryText += ` AND lr.employee_id = $${params.length + 1}`;
      params.push(employee_id);
    }

    if (status) {
      queryText += ` AND lr.status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ' ORDER BY lr.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Apply for leave
router.post('/requests', authenticate, tenantIsolation, async (req, res) => {
  const { leave_type_id, start_date, end_date, reason, document_url } = req.body;

  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    const employeeId = empResult.rows[0].id;

    // Calculate total days
    const totalDays = getLeaveDays(start_date, end_date);

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const balanceResult = await query(
      'SELECT remaining_days FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3',
      [employeeId, leave_type_id, currentYear]
    );

    if (balanceResult.rows.length === 0 || balanceResult.rows[0].remaining_days < totalDays) {
      return res.status(400).json({ message: 'Insufficient leave balance' });
    }

    const result = await query(
      `INSERT INTO leave_requests (
        employee_id, company_id, leave_type_id, start_date, end_date, total_days, reason, document_url, status
       ) VALUES ($1::int, $2::int, $3::int, $4::date, $5::date, $6::decimal, $7::text, $8::text, 'pending')
       RETURNING *`,
      [employeeId, req.companyId, leave_type_id, start_date, end_date, totalDays, reason, document_url || null]
    );

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: 'APPLY_LEAVE',
      entityType: 'leave_request',
      entityId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
    });

    // Send notification emails: to employee and company admin(s)
    try {
      const employeeResult = await query(
        `SELECT u.email, e.first_name, e.last_name
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1 AND e.company_id = $2`,
        [employeeId, req.companyId]
      );
      const employee = employeeResult.rows[0];

      const adminResult = await query(
        `SELECT u.email FROM users u WHERE u.company_id = $1 AND u.role IN ('company_admin', 'super_admin') AND u.is_active = true`,
        [req.companyId]
      );
      const adminEmails = adminResult.rows.map((r) => r.email).join(',');

      const subject = `Leave Request Submitted: ${result.rows[0].total_days} day(s)`;
      const body = `Hi ${employee.first_name},\n\nYour leave request from ${start_date} to ${end_date} has been submitted and is pending approval.\n\nReason: ${reason || 'No reason provided'}\n\nThanks,\nAttendify`; 

      await sendEmail({
        to: employee.email,
        subject,
        text: body,
      });

      if (adminEmails) {
        await sendEmail({
          to: adminEmails,
          subject: `Leave request pending approval: ${employee.first_name} ${employee.last_name}`,
          text: `A leave request has been submitted by ${employee.first_name} ${employee.last_name} (${employee.email}).\n\nFrom: ${start_date}\nTo: ${end_date}\nTotal Days: ${result.rows[0].total_days}\nReason: ${reason || 'No reason provided'}`,
        });
      }
    } catch (emailError) {
      console.error('Leave application email send failed', emailError);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Apply leave on behalf of employee
router.post('/requests/admin', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { employee_id, leave_type_id, start_date, end_date, reason, document_url, status = 'pending' } = req.body;

  try {
    const totalDays = getLeaveDays(start_date, end_date);
    const currentYear = new Date().getFullYear();
    const balanceResult = await query(
      'SELECT remaining_days FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3',
      [employee_id, leave_type_id, currentYear],
    );

    if (balanceResult.rows.length === 0 || Number(balanceResult.rows[0].remaining_days) < totalDays) {
      return res.status(400).json({ message: 'Insufficient leave balance' });
    }

    const result = await query(
      `INSERT INTO leave_requests (
        employee_id, company_id, leave_type_id, start_date, end_date, total_days, reason, document_url, status, approved_by, approved_at
       ) VALUES ($1::int, $2::int, $3::int, $4::date, $5::date, $6::decimal, $7::text, $8::text, $9::text, $10::int, $11::timestamptz)
       RETURNING *`,
      [
        employee_id,
        req.companyId,
        leave_type_id,
        start_date,
        end_date,
        totalDays,
        reason,
        document_url || null,
        status,
        status === 'approved' ? req.user.id : null,
        status === 'approved' ? new Date() : null,
      ],
    );

    if (status === 'approved') {
      await applyApprovedLeaveEffects({ leave: result.rows[0], companyId: req.companyId });
    }

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Approve/Reject leave
router.put('/requests/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  try {
    const leaveResult = await query(
      'SELECT * FROM leave_requests WHERE id = $1 AND ($2::int IS NULL OR company_id = $2)',
      [id, req.companyId]
    );

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];

    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave request already processed' });
    }

    const result = await query(
      `UPDATE leave_requests 
       SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, rejection_reason, id]
    );

    // Update leave balance if approved
    if (status === 'approved') {
      await applyApprovedLeaveEffects({ leave, companyId: req.companyId });
    }

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: status === 'approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      entityType: 'leave_request',
      entityId: id,
      newValues: result.rows[0],
      ipAddress: req.ip,
    });

    try {
      const employeeResult = await query(
        `SELECT u.email, e.first_name, e.last_name
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1 AND e.company_id = $2`,
        [leave.employee_id, req.companyId]
      );
      if (employeeResult.rows.length) {
        const employee = employeeResult.rows[0];
        const formatDate = (v) => (v ? new Date(v).toISOString().split('T')[0] : 'N/A');
        const subject = status === 'approved' ? 'Leave Request Approved' : 'Leave Request Rejected';
        const text = `Hi ${employee.first_name},\n\nYour leave request from ${formatDate(leave.start_date)} to ${formatDate(leave.end_date)} has been ${status}.${
          status === 'rejected' ? ` Reason: ${rejection_reason || 'Not specified'}` : ''
        }\n\nRegards,\nAttendify`;

        await sendEmail({
          to: employee.email,
          subject,
          text,
        });
      }
    } catch (emailError) {
      console.error('Leave approval/rejection email failed', emailError);
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get leave balance
router.get('/balance', authenticate, tenantIsolation, async (req, res) => {
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const currentYear = new Date().getFullYear();
    const result = await query(
      `SELECT lb.*, lt.name as leave_type_name, lt.code
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = $1 AND lb.year = $2`,
      [empResult.rows[0].id, currentYear]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee leave balance (for admin)
router.get('/balance/:employeeId', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const result = await query(
      `SELECT lb.*, lt.name as leave_type_name, lt.code
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = $1 AND lb.year = $2`,
      [req.params.employeeId, currentYear]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign or Update leave balance (for admin)
router.post('/balance', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { employee_id, leave_type_id, days_to_add } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    // We update by adding days_to_add to existing total_days and remaining_days
    const result = await query(
      `INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days, used_days)
       VALUES ($1, $2, $3, $4, $4, 0)
       ON CONFLICT (employee_id, leave_type_id, year)
       DO UPDATE SET 
         total_days = leave_balances.total_days + EXCLUDED.total_days,
         remaining_days = leave_balances.remaining_days + EXCLUDED.remaining_days,
         updated_at = NOW()
       RETURNING *`,
      [employee_id, leave_type_id, currentYear, days_to_add]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete leave request (admin only)
router.delete('/requests/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM leave_requests WHERE id = $1 AND ($2::int IS NULL OR company_id = $2) RETURNING id',
      [req.params.id, req.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Leave request not found' });
    res.json({ message: 'Leave request deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;




