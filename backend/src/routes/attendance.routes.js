import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, tenantIsolation } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { enforcePunchIp } from '../middleware/networkPolicy.js';
import { autoMarkAbsent } from '../utils/attendanceHelper.js';

const router = express.Router();
const combineDateTime = (workDate, time) => {
  if (!workDate || !time) return null;
  const dateTimeStr = `${workDate}T${time}:00`;
  const date = new Date(dateTimeStr);
  return isNaN(date.getTime()) ? null : date;
};

// Punch in
router.post('/punch-in', authenticate, tenantIsolation, enforcePunchIp, async (req, res) => {
  const { location } = req.body;
  
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    const employeeId = empResult.rows[0].id;

    const today = new Date().toISOString().split('T')[0];
    
    // Check if already punched in
    const existing = await query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
      [employeeId, today]
    );

    if (existing.rows.length > 0 && existing.rows[0].punch_in_time) {
      return res.status(400).json({ message: 'Already punched in today' });
    }

    // Get employee shift
    const shiftResult = await query(
      `SELECT s.* FROM employee_shifts es
       JOIN shifts s ON es.shift_id = s.id
       WHERE es.employee_id = $1 AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
       ORDER BY es.effective_from DESC LIMIT 1`,
      [employeeId]
    );

    const shift = shiftResult.rows[0];
    const punchInTime = new Date();
    let lateMinutes = 0;

    if (shift) {
      const [hours, minutes] = shift.start_time.split(':');
      const shiftStart = new Date();
      shiftStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      const graceTime = new Date(shiftStart.getTime() + shift.grace_period_minutes * 60000);

      if (punchInTime > graceTime) {
        lateMinutes = Math.floor((punchInTime - graceTime) / 60000);
      }

      // Max Punch-in Time Check
      if (shift.max_punch_in_time) {
        const [maxH, maxM] = shift.max_punch_in_time.split(':');
        const maxPunchIn = new Date();
        maxPunchIn.setHours(parseInt(maxH), parseInt(maxM), 0, 0);
        if (punchInTime > maxPunchIn) {
          return res.status(400).json({ message: `Punch-in allowed only before ${shift.max_punch_in_time}` });
        }
      }
    }

    const result = await query(
      `INSERT INTO attendance_records (employee_id, company_id, work_date, punch_in_time, late_minutes, status, source, punch_in_location)
       VALUES ($1::int, $2::int, $3::date, $4::timestamptz, $5::int, 'present', 'web', $6::text)
       ON CONFLICT (employee_id, work_date) 
       DO UPDATE SET punch_in_time = EXCLUDED.punch_in_time, late_minutes = EXCLUDED.late_minutes, punch_in_location = EXCLUDED.punch_in_location, status = 'present'
       RETURNING *`,
      [employeeId, req.companyId, today, punchInTime, lateMinutes, location]
    );

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: 'PUNCH_IN',
      entityType: 'attendance',
      entityId: result.rows[0].id,
      ipAddress: req.ip,
    });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Punch out
router.post('/punch-out', authenticate, tenantIsolation, async (req, res) => {
  const { location } = req.body;
  
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    const employeeId = empResult.rows[0].id;

    const today = new Date().toISOString().split('T')[0];
    
    const existing = await query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
      [employeeId, today]
    );

    if (existing.rows.length === 0 || !existing.rows[0].punch_in_time) {
      return res.status(400).json({ message: 'Please punch in first' });
    }

    if (existing.rows[0].punch_out_time) {
      return res.status(400).json({ message: 'Already punched out today' });
    }

    const punchOutTime = new Date();
    const punchInTime = new Date(existing.rows[0].punch_in_time);
    const totalHours = ((punchOutTime - punchInTime) / (1000 * 60 * 60)).toFixed(2);

    // Check early leave
    const shiftResult = await query(
      `SELECT s.* FROM employee_shifts es
       JOIN shifts s ON es.shift_id = s.id
       WHERE es.employee_id = $1 AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
       ORDER BY es.effective_from DESC LIMIT 1`,
      [employeeId]
    );

    let earlyLeaveMinutes = 0;
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0];
      const [hours, minutes] = shift.end_time.split(':');
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      if (punchOutTime < shiftEnd) {
        earlyLeaveMinutes = Math.floor((shiftEnd - punchOutTime) / 60000);
      }
    }

    // Determine status based on hours rules
    let finalStatus = 'present';
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0];
      const hours = parseFloat(totalHours);
      if (hours < (shift.min_hours_half_day || 4)) {
        finalStatus = 'absent';
      } else if (hours < (shift.min_hours_full_day || 8)) {
        finalStatus = 'half_day';
      }
    }

    const result = await query(
      `UPDATE attendance_records 
       SET punch_out_time = $1::timestamptz, total_hours = $2::decimal, early_leave_minutes = $3::int, punch_out_location = $4::text, status = $5, updated_at = NOW()
       WHERE employee_id = $6::int AND work_date = $7::date
       RETURNING *`,
      [punchOutTime, totalHours, earlyLeaveMinutes, location, finalStatus, employeeId, today]
    );

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: 'PUNCH_OUT',
      entityType: 'attendance',
      entityId: result.rows[0].id,
      ipAddress: req.ip,
    });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const getTodayAttendanceStatus = async (req, res) => {
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const result = await query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
      [empResult.rows[0].id, today]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get today's attendance status
router.get('/today', authenticate, tenantIsolation, getTodayAttendanceStatus);
// Backward-compatible alias used by some frontend builds
router.get('/today-status', authenticate, tenantIsolation, getTodayAttendanceStatus);

// Get attendance records
router.get('/records', authenticate, tenantIsolation, async (req, res) => {
  const { start_date, end_date, employee_id, status } = req.query;

  try {
    // Automatically mark absent for missing days in the past within this range
    if (start_date && end_date) {
      let targetEmpId = employee_id;
      if (req.user.role === 'employee') {
        const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
        targetEmpId = empResult.rows[0]?.id;
      }
      await autoMarkAbsent(req.companyId, targetEmpId, start_date, end_date);
    }

    let queryText = `
      SELECT ar.*, e.first_name, e.last_name, e.employee_code
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ($1::int IS NULL OR ar.company_id = $1)
    `;
    const params = [req.companyId];

    if (req.user.role === 'employee') {
      const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
      queryText += ` AND ar.employee_id = $2`;
      params.push(empResult.rows[0].id);
    } else if (employee_id) {
      queryText += ` AND ar.employee_id = $${params.length + 1}`;
      params.push(employee_id);
    }

    if (start_date) {
      queryText += ` AND ar.work_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      queryText += ` AND ar.work_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    if (status) {
      queryText += ` AND ar.status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ' ORDER BY ar.work_date DESC, e.first_name';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark absent (admin only)
router.post('/mark-absent', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { work_date } = req.body;

  try {
    if (!req.companyId) {
      return res.status(400).json({ message: 'company_id is required for mark-absent' });
    }
    const result = await query(
      `INSERT INTO attendance_records (employee_id, company_id, work_date, status)
       SELECT e.id, $1::int, $2::date, 'absent'
       FROM employees e
       WHERE e.company_id = $1::int AND e.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM attendance_records ar 
         WHERE ar.employee_id = e.id AND ar.work_date = $2::date
       )
       RETURNING *`,
      [req.companyId, work_date]
    );

    res.json({ message: 'Absent marked successfully', count: result.rowCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get attendance summary
router.get('/summary', authenticate, tenantIsolation, async (req, res) => {
  const { month, year } = req.query;

  try {
    let queryText = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'present') as present_count,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE status = 'on_leave') as leave_count,
        COALESCE(SUM(late_minutes), 0) as total_late_minutes
      FROM attendance_records
      WHERE company_id = $1
    `;
    const params = [req.companyId];

    if (req.allowAllCompanies) {
      queryText = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'present') as present_count,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE status = 'on_leave') as leave_count,
        COALESCE(SUM(late_minutes), 0) as total_late_minutes
      FROM attendance_records
      WHERE 1=1
    `;
      params.length = 0;
    }

    if (month && year) {
      queryText += ` AND EXTRACT(MONTH FROM work_date) = $${params.length + 1} AND EXTRACT(YEAR FROM work_date) = $${params.length + 2}`;
      params.push(month, year);
    }

    const result = await query(queryText, params);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get attendance regularization requests
router.get('/regularization-requests', authenticate, tenantIsolation, async (req, res) => {
  try {
    let queryText = `
      SELECT arr.*, e.first_name, e.last_name, e.employee_code
      FROM attendance_regularization_requests arr
      JOIN employees e ON arr.employee_id = e.id
      WHERE ($1::int IS NULL OR arr.company_id = $1)
    `;
    const params = [req.companyId];

    if (req.user.role === 'employee') {
      const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
      if (empResult.rows.length === 0) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }
      queryText += ` AND arr.employee_id = $2`;
      params.push(empResult.rows[0].id);
    }

    queryText += ' ORDER BY arr.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create attendance regularization request
router.post('/regularization-requests', authenticate, authorize('employee'), tenantIsolation, async (req, res) => {
  const { work_date, punch_in_time, punch_out_time, reason } = req.body;

  try {
    if (!work_date || !reason) {
      return res.status(400).json({ message: 'work_date and reason are required' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (work_date > today) {
      return res.status(400).json({ message: 'ER request can only be raised for past or current dates' });
    }

    if (punch_in_time && punch_out_time && combineDateTime(work_date, punch_out_time) <= combineDateTime(work_date, punch_in_time)) {
      return res.status(400).json({ message: 'punch_out_time must be later than punch_in_time' });
    }

    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const employeeId = empResult.rows[0].id;
    const duplicateCheck = await query(
      `SELECT id
       FROM attendance_regularization_requests
       WHERE employee_id = $1 AND work_date = $2 AND status = 'pending'
       LIMIT 1`,
      [employeeId, work_date],
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ message: 'A pending ER request already exists for this date' });
    }

    const result = await query(
      `INSERT INTO attendance_regularization_requests (
         employee_id, company_id, work_date, punch_in_time, punch_out_time, reason
       ) VALUES ($1::int, $2::int, $3::date, $4::time, $5::time, $6::text)
       RETURNING *`,
      [employeeId, req.companyId, work_date, punch_in_time || null, punch_out_time || null, reason],
    );

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: 'CREATE_ATTENDANCE_ER',
      entityType: 'attendance_regularization',
      entityId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve or reject attendance regularization request
router.put('/regularization-requests/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { status, rejection_reason } = req.body;

  try {
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }

    const requestResult = await query(
      `SELECT *
       FROM attendance_regularization_requests
       WHERE id = $1 AND ($2::int IS NULL OR company_id = $2)`,
      [req.params.id, req.companyId],
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'ER request not found' });
    }

    const regularization = requestResult.rows[0];
    if (!regularization.work_date) {
      return res.status(400).json({ message: 'Invalid work_date in ER request' });
    }
    if (regularization.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending ER requests can be updated' });
    }

    if (status === 'rejected' && !rejection_reason) {
      return res.status(400).json({ message: 'rejection_reason is required when rejecting an ER request' });
    }

    if (status === 'approved') {
      const punchInAt = regularization.punch_in_time ? combineDateTime(regularization.work_date, regularization.punch_in_time) : null;
      const punchOutAt = regularization.punch_out_time ? combineDateTime(regularization.work_date, regularization.punch_out_time) : null;
      const totalHours = (punchInAt && punchOutAt) ? ((punchOutAt - punchInAt) / (1000 * 60 * 60)).toFixed(2) : null;

      if (punchInAt || punchOutAt || totalHours !== null) {
        await query(
          `INSERT INTO attendance_records (
             employee_id, company_id, work_date, punch_in_time, punch_out_time, total_hours, status, source, notes, approved_by
           ) VALUES ($1::int, $2::int, $3::date, $4::timestamptz, $5::timestamptz, $6::decimal, 'present', 'web', $7::text, $8::int)
           ON CONFLICT (employee_id, work_date)
           DO UPDATE SET
             punch_in_time = COALESCE(EXCLUDED.punch_in_time, attendance_records.punch_in_time),
             punch_out_time = COALESCE(EXCLUDED.punch_out_time, attendance_records.punch_out_time),
             total_hours = COALESCE(EXCLUDED.total_hours, attendance_records.total_hours),
             status = CASE WHEN attendance_records.status = 'on_leave' THEN attendance_records.status ELSE 'present' END,
             notes = EXCLUDED.notes,
             approved_by = EXCLUDED.approved_by,
             updated_at = NOW()`,
          [
            regularization.employee_id,
            regularization.company_id,
            regularization.work_date,
            punchInAt,
            punchOutAt,
            totalHours,
            `Attendance ER approved: ${regularization.reason}`,
            req.user.id,
          ],
        );
      }
    }

    const updateResult = await query(
      `UPDATE attendance_regularization_requests
       SET status = $1,
           rejection_reason = $2,
           approved_by = $3,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, status === 'rejected' ? rejection_reason : null, req.user.id, req.params.id],
    );

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: status === 'approved' ? 'APPROVE_ATTENDANCE_ER' : 'REJECT_ATTENDANCE_ER',
      entityType: 'attendance_regularization',
      entityId: Number(req.params.id),
      newValues: updateResult.rows[0],
      ipAddress: req.ip,
    });

    res.json(updateResult.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

