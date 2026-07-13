import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, tenantIsolation } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { enforceOfficePunchIpForEmployee } from '../middleware/networkPolicy.js';
import { autoMarkAbsent } from '../utils/attendanceHelper.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();
const ATTENDANCE_TZ_OFFSET = process.env.ATTENDANCE_TZ_OFFSET || '+05:30';

const normalizeRecipients = (raw) =>
  String(raw || '')
    .split(/[,\n;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

const getCompanyAdminEmails = async (companyId) => {
  const recipients = new Set();

  const companyResult = await query(
    `SELECT email, notification_emails
     FROM companies
     WHERE id = $1::int
     LIMIT 1`,
    [companyId],
  );
  const company = companyResult.rows[0] || {};
  normalizeRecipients(company.email).forEach((email) => recipients.add(email));
  normalizeRecipients(company.notification_emails).forEach((email) => recipients.add(email));

  const adminResult = await query(
    `SELECT email
     FROM users
     WHERE company_id = $1
       AND role IN ('company_admin', 'super_admin')
       AND is_active = true`,
    [companyId],
  );
  adminResult.rows.forEach((row) => normalizeRecipients(row.email).forEach((email) => recipients.add(email)));

  return Array.from(recipients).join(',');
};

const getDateKeyInOffset = (date = new Date(), offset = ATTENDANCE_TZ_OFFSET) => {
  const match = String(offset).trim().match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    return date.toISOString().split('T')[0];
  }

  const [, sign, hh, mm] = match;
  const offsetMinutes = (Number(hh) * 60 + Number(mm)) * (sign === '+' ? 1 : -1);
  const shifted = new Date(date.getTime() + (offsetMinutes * 60 * 1000));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeWorkDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  return raw;
};

const getPreviousWorkDate = (workDate) => {
  const normalized = normalizeWorkDate(workDate);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return normalizeWorkDate(date);
};

const combineDateTime = (workDate, time) => {
  if (!workDate || !time) return null;
  const normalizedDate = normalizeWorkDate(workDate);
  const normalizedTime = String(time).trim().replace(/\.\d+$/, '');
  const timeParts = normalizedTime.split(':');
  const hh = String(timeParts[0] || '00').padStart(2, '0');
  const mi = String(timeParts[1] || '00').padStart(2, '0');
  const ss = String(timeParts[2] || '00').padStart(2, '0');
  const dateTimeStr = `${normalizedDate}T${hh}:${mi}:${ss}${ATTENDANCE_TZ_OFFSET}`;
  const date = new Date(dateTimeStr);
  return isNaN(date.getTime()) ? null : date;
};

const getShiftForWorkDate = async (employeeId, workDate, companyId = null) => {
  const result = await query(
    `SELECT s.*
     FROM employee_shifts es
     JOIN shifts s ON es.shift_id = s.id
     WHERE es.employee_id = $1::int
       AND es.effective_from <= $2::date
       AND (es.effective_to IS NULL OR es.effective_to >= $2::date)
     ORDER BY es.effective_from DESC
     LIMIT 1`,
    [employeeId, workDate],
  );

  if (result.rows[0]) return result.rows[0];
  if (!companyId) return null;

  const fallback = await query(
    `SELECT *
     FROM shifts
     WHERE company_id = $1::int
       AND is_active = TRUE
     ORDER BY id DESC
     LIMIT 1`,
    [companyId],
  );

  return fallback.rows[0] || null;
};

const resolveAttendanceStatusFromShift = (shift, totalHours) => {
  if (!shift || totalHours === null || totalHours === undefined || totalHours === '') {
    return 'present';
  }

  const hours = Number(totalHours);
  if (!Number.isFinite(hours)) return 'present';
  if (hours < Number(shift.min_hours_half_day || 4)) return 'absent';
  if (hours < Number(shift.min_hours_full_day || 8)) return 'half_day';
  return 'present';
};

const syncApprovedRegularizations = async (companyId, employeeId, startDate, endDate) => {
  const params = [companyId, startDate, endDate];
  let employeeFilterSql = '';

  if (employeeId) {
    params.push(employeeId);
    employeeFilterSql = ` AND arr.employee_id = $4::int`;
  }

  const requestsResult = await query(
    `SELECT arr.*
     FROM attendance_regularization_requests arr
     WHERE ($1::int IS NULL OR arr.company_id = $1::int)
       AND arr.status = 'approved'
       AND arr.work_date >= $2::date
       AND arr.work_date <= $3::date
       ${employeeFilterSql}
     ORDER BY arr.work_date ASC, arr.id ASC`,
    params,
  );

  for (const regularization of requestsResult.rows) {
    const normalizedWorkDate = normalizeWorkDate(regularization.work_date);
    const punchInAt = regularization.punch_in_time ? combineDateTime(normalizedWorkDate, regularization.punch_in_time) : null;
    const punchOutAt = regularization.punch_out_time ? combineDateTime(normalizedWorkDate, regularization.punch_out_time) : null;
    const totalHours = (punchInAt && punchOutAt) ? ((punchOutAt - punchInAt) / (1000 * 60 * 60)).toFixed(2) : null;
    const shift = await getShiftForWorkDate(regularization.employee_id, normalizedWorkDate, regularization.company_id);
    const resolvedStatus = resolveAttendanceStatusFromShift(shift, totalHours);
    const erNote = `Attendance ER approved: ${regularization.reason}`;
    const previousWorkDate = getPreviousWorkDate(normalizedWorkDate);

    if (previousWorkDate) {
      await query(
        `DELETE FROM attendance_records
         WHERE employee_id = $1::int
           AND company_id = $2::int
           AND work_date = $3::date
           AND notes = $4::text
           AND punch_in_time IS NULL
           AND punch_out_time IS NULL
           AND total_hours IS NULL`,
        [regularization.employee_id, regularization.company_id, previousWorkDate, erNote],
      );
    }

    await query(
      `INSERT INTO attendance_records (
         employee_id, company_id, work_date, punch_in_time, punch_out_time, total_hours, status, source, notes, approved_by
       ) VALUES ($1::int, $2::int, $3::date, $4::timestamptz, $5::timestamptz, $6::decimal, $7::varchar(50), 'web', $8::text, $9::int)
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET
         punch_in_time = COALESCE(EXCLUDED.punch_in_time, attendance_records.punch_in_time),
         punch_out_time = COALESCE(EXCLUDED.punch_out_time, attendance_records.punch_out_time),
         total_hours = COALESCE(EXCLUDED.total_hours, attendance_records.total_hours),
         status = CASE
           WHEN attendance_records.status = 'on_leave' THEN attendance_records.status
           ELSE EXCLUDED.status
         END,
         source = EXCLUDED.source,
         notes = EXCLUDED.notes,
         approved_by = COALESCE(EXCLUDED.approved_by, attendance_records.approved_by),
         updated_at = NOW()`,
      [
        regularization.employee_id,
        regularization.company_id,
        normalizedWorkDate,
        punchInAt,
        punchOutAt,
        totalHours,
        resolvedStatus,
        erNote,
        regularization.approved_by,
      ],
    );
  }
};

// Punch in
router.post('/punch-in', authenticate, tenantIsolation, enforceOfficePunchIpForEmployee, async (req, res) => {
  const { location } = req.body;
  
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    const employeeId = empResult.rows[0].id;

    const today = getDateKeyInOffset(new Date());
    
    // Check if already punched in
    const existing = await query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
      [employeeId, today]
    );

    if (existing.rows.length > 0 && existing.rows[0].punch_in_time) {
      return res.status(400).json({ message: 'Already punched in today' });
    }

    // Get employee shift
    const shift = await getShiftForWorkDate(employeeId, today, req.companyId);
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
router.post('/punch-out', authenticate, tenantIsolation, enforceOfficePunchIpForEmployee, async (req, res) => {
  const { location } = req.body;
  
  try {
    const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    const employeeId = empResult.rows[0].id;

    const today = getDateKeyInOffset(new Date());
    
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
    let earlyLeaveMinutes = 0;
    const shift = await getShiftForWorkDate(employeeId, today, req.companyId);
    if (shift) {
      const [hours, minutes] = shift.end_time.split(':');
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      if (punchOutTime < shiftEnd) {
        earlyLeaveMinutes = Math.floor((shiftEnd - punchOutTime) / 60000);
      }
    }

    // Determine status based on hours rules
    const finalStatus = resolveAttendanceStatusFromShift(shift, totalHours);

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

    const today = getDateKeyInOffset(new Date());
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
      await syncApprovedRegularizations(req.companyId, targetEmpId, start_date, end_date);
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

    const today = getDateKeyInOffset(new Date());
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

    try {
      const employeeProfile = await query(
        `SELECT e.first_name, e.last_name, u.email
         FROM employees e
         JOIN users u ON u.id = e.user_id
         WHERE e.id = $1 AND e.company_id = $2`,
        [employeeId, req.companyId],
      );
      const employee = employeeProfile.rows[0];

      const adminEmails = await getCompanyAdminEmails(req.companyId);

      if (employee?.email) {
        await sendEmail({
          to: employee.email,
          subject: `ER request submitted for ${work_date}`,
          text: `Hi ${employee.first_name},\n\nYour attendance regularization request has been submitted.\n\nWork Date: ${work_date}\nPunch In: ${punch_in_time || 'Not provided'}\nPunch Out: ${punch_out_time || 'Not provided'}\nReason: ${reason}\nStatus: Pending`,
          companyId: req.companyId,
        });
      }

      if (adminEmails && employee) {
        await sendEmail({
          to: adminEmails,
          subject: `ER request submitted: ${employee.first_name} ${employee.last_name}`,
          text: `An attendance regularization request has been submitted.\n\nEmployee: ${employee.first_name} ${employee.last_name} (${employee.email})\nWork Date: ${work_date}\nPunch In: ${punch_in_time || 'Not provided'}\nPunch Out: ${punch_out_time || 'Not provided'}\nReason: ${reason}`,
          companyId: req.companyId,
        });
      }
    } catch (emailError) {
      console.error('ER request email send failed', emailError);
    }

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
    const normalizedWorkDate = normalizeWorkDate(regularization.work_date);
    if (regularization.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending ER requests can be updated' });
    }

    if (status === 'rejected' && !rejection_reason) {
      return res.status(400).json({ message: 'rejection_reason is required when rejecting an ER request' });
    }

    if (status === 'approved') {
      const punchInAt = regularization.punch_in_time ? combineDateTime(normalizedWorkDate, regularization.punch_in_time) : null;
      const punchOutAt = regularization.punch_out_time ? combineDateTime(normalizedWorkDate, regularization.punch_out_time) : null;
      const totalHours = (punchInAt && punchOutAt) ? ((punchOutAt - punchInAt) / (1000 * 60 * 60)).toFixed(2) : null;
      const shift = await getShiftForWorkDate(regularization.employee_id, normalizedWorkDate, regularization.company_id);
      const resolvedStatus = resolveAttendanceStatusFromShift(shift, totalHours);

      await query(
        `INSERT INTO attendance_records (
           employee_id, company_id, work_date, punch_in_time, punch_out_time, total_hours, status, source, notes, approved_by
         ) VALUES ($1::int, $2::int, $3::date, $4::timestamptz, $5::timestamptz, $6::decimal, $7::varchar(50), 'web', $8::text, $9::int)
         ON CONFLICT (employee_id, work_date)
         DO UPDATE SET
           punch_in_time = COALESCE(EXCLUDED.punch_in_time, attendance_records.punch_in_time),
           punch_out_time = COALESCE(EXCLUDED.punch_out_time, attendance_records.punch_out_time),
           total_hours = COALESCE(EXCLUDED.total_hours, attendance_records.total_hours),
           status = CASE
             WHEN attendance_records.status = 'on_leave' THEN attendance_records.status
             ELSE EXCLUDED.status
           END,
           source = EXCLUDED.source,
           notes = EXCLUDED.notes,
           approved_by = EXCLUDED.approved_by,
           updated_at = NOW()`,
        [
          regularization.employee_id,
          regularization.company_id,
          normalizedWorkDate,
          punchInAt,
          punchOutAt,
          totalHours,
          resolvedStatus,
          `Attendance ER approved: ${regularization.reason}`,
          req.user.id,
        ],
      );
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

    try {
      const employeeResult = await query(
        `SELECT e.first_name, e.last_name, u.email
         FROM employees e
         JOIN users u ON u.id = e.user_id
         WHERE e.id = $1 AND e.company_id = $2`,
        [regularization.employee_id, req.companyId],
      );
      const employee = employeeResult.rows[0];
      const adminEmails = await getCompanyAdminEmails(req.companyId);
      const emailSubject = `ER request ${status}: ${employee?.first_name || ''} ${employee?.last_name || ''}`.trim();
      const employeeMessage = `Hi ${employee?.first_name || 'Employee'},\n\nYour attendance regularization request for ${normalizedWorkDate} has been ${status}.${status === 'rejected' ? `\nReason: ${rejection_reason}` : ''}\n\nPunch In: ${regularization.punch_in_time || 'Not provided'}\nPunch Out: ${regularization.punch_out_time || 'Not provided'}\nRequest Reason: ${regularization.reason}`;
      const adminMessage = `Attendance regularization request has been ${status}.\n\nEmployee: ${employee?.first_name || 'N/A'} ${employee?.last_name || ''} (${employee?.email || 'N/A'})\nWork Date: ${normalizedWorkDate}\nPunch In: ${regularization.punch_in_time || 'Not provided'}\nPunch Out: ${regularization.punch_out_time || 'Not provided'}\nRequest Reason: ${regularization.reason}${status === 'rejected' ? `\nRejection Reason: ${rejection_reason}` : ''}`;

      const mailJobs = [];
      if (employee?.email) {
        mailJobs.push(sendEmail({
          to: employee.email,
          subject: emailSubject,
          text: employeeMessage,
          companyId: req.companyId,
        }));
      }
      if (adminEmails) {
        mailJobs.push(sendEmail({
          to: adminEmails,
          subject: emailSubject,
          text: adminMessage,
          companyId: req.companyId,
        }));
      }
      if (mailJobs.length) {
        const results = await Promise.allSettled(mailJobs);
        const failed = results.find((r) => r.status === 'rejected');
        if (failed) {
          console.error('ER status email send failed', failed.reason);
        }
      }
    } catch (emailError) {
      console.error('ER approval/rejection email send failed', emailError);
    }

    res.json(updateResult.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

