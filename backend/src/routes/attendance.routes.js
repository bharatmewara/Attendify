import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, tenantIsolation } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { enforcePunchIp } from '../middleware/networkPolicy.js';

const router = express.Router();

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
    }

    const result = await query(
      `INSERT INTO attendance_records (employee_id, company_id, work_date, punch_in_time, late_minutes, status, source, punch_in_location)
       VALUES ($1, $2, $3, $4, $5, 'present', 'web', $6)
       ON CONFLICT (employee_id, work_date) 
       DO UPDATE SET punch_in_time = EXCLUDED.punch_in_time, late_minutes = EXCLUDED.late_minutes, punch_in_location = EXCLUDED.punch_in_location
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

    const result = await query(
      `UPDATE attendance_records 
       SET punch_out_time = $1, total_hours = $2, early_leave_minutes = $3, punch_out_location = $4, updated_at = NOW()
       WHERE employee_id = $5 AND work_date = $6
       RETURNING *`,
      [punchOutTime, totalHours, earlyLeaveMinutes, location, employeeId, today]
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

// Get today's attendance status
router.get('/today', authenticate, tenantIsolation, async (req, res) => {
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
});

// Get attendance records
router.get('/records', authenticate, tenantIsolation, async (req, res) => {
  const { start_date, end_date, employee_id, status } = req.query;

  try {
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
       SELECT e.id, $1, $2, 'absent'
       FROM employees e
       WHERE e.company_id = $1 AND e.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM attendance_records ar 
         WHERE ar.employee_id = e.id AND ar.work_date = $2
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

export default router;
