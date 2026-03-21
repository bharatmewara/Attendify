import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { sendEmail } from '../utils/email.js';
import { config } from '../config.js';

const router = express.Router();

const nullable = (value) => (value === '' || value === undefined ? null : value);
const sanitizeDocuments = (documents = []) =>
  (Array.isArray(documents) ? documents : [])
    .filter((document) => document?.document_name && document?.file_url)
    .map((document) => ({
      document_type: document.document_type || 'other',
      document_name: document.document_name,
      file_url: document.file_url,
      file_size: Number(document.file_size) || null,
    }));

router.get('/', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.phone, e.joining_date, 
        e.employment_type, e.status, e.department_id, e.designation_id,
        u.email, u.is_active, d.name as department_name, des.title as designation_title
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ($1::int IS NULL OR e.company_id = $1)
      ORDER BY e.created_at DESC
    `, [req.companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/documents', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  try {
    const { employee_id, document_type } = req.query;
    let queryText = `
      SELECT ed.*, e.first_name, e.last_name, e.employee_code, u.email as uploaded_by_email
      FROM employee_documents ed
      JOIN employees e ON ed.employee_id = e.id
      LEFT JOIN users u ON ed.uploaded_by = u.id
      WHERE ed.company_id = $1
    `;
    const params = [req.companyId];

    if (employee_id) {
      queryText += ` AND ed.employee_id = $${params.length + 1}`;
      params.push(employee_id);
    }
    if (document_type) {
      queryText += ` AND ed.document_type = $${params.length + 1}`;
      params.push(document_type);
    }

    queryText += ' ORDER BY ed.uploaded_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching company documents:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.date_of_birth, e.gender, 
        e.phone, e.emergency_contact, e.emergency_contact_name, e.address, 
        e.city, e.state, e.country, e.postal_code, e.department_id, e.designation_id, 
        e.manager_id, e.joining_date, e.employment_type, e.status, 
        e.aadhar_number, e.pan_number, e.bank_account_number, e.bank_name, e.bank_ifsc,
        u.email, u.is_active, d.name as department_name, des.title as designation_title
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.id = $1 AND ($2::int IS NULL OR e.company_id = $2)
    `, [req.params.id, req.companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/profile', authenticate, tenantIsolation, async (req, res) => {
  try {
    const employeeResult = await query(
      `SELECT 
        e.id, e.user_id, e.employee_code, e.first_name, e.last_name, e.date_of_birth, e.gender, 
        e.phone, e.emergency_contact, e.emergency_contact_name, e.address, 
        e.city, e.state, e.country, e.postal_code, e.department_id, e.designation_id, 
        e.manager_id, e.joining_date, e.employment_type, e.status, 
        e.aadhar_number, e.pan_number, e.bank_account_number, e.bank_name, e.bank_ifsc,
        u.email, u.is_active, d.name as department_name, des.title as designation_title
       FROM employees e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       WHERE e.id = $1 AND ($2::int IS NULL OR e.company_id = $2)`,
      [req.params.id, req.companyId],
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    if (req.user.role === 'employee') {
      const selfResult = await query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (selfResult.rows[0]?.id !== employee.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const currentYear = new Date().getFullYear();
    const [attendanceSummary, attendanceRecords, leaveRequests, leaveBalances, payroll, documents, assets, shift, salary] =
      await Promise.all([
        query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'present') as present_count,
             COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
             COUNT(*) FILTER (WHERE status = 'on_leave') as leave_count,
             COALESCE(SUM(late_minutes), 0) as total_late_minutes
           FROM attendance_records
           WHERE employee_id = $1`,
          [employee.id],
        ),
        query(
          `SELECT *
           FROM attendance_records
           WHERE employee_id = $1
           ORDER BY work_date DESC
           LIMIT 31`,
          [employee.id],
        ),
        query(
          `SELECT lr.*, lt.name as leave_type_name
           FROM leave_requests lr
           JOIN leave_types lt ON lr.leave_type_id = lt.id
           WHERE lr.employee_id = $1
           ORDER BY lr.created_at DESC`,
          [employee.id],
        ),
        query(
          `SELECT lb.*, lt.name as leave_type_name, lt.code
           FROM leave_balances lb
           JOIN leave_types lt ON lb.leave_type_id = lt.id
           WHERE lb.employee_id = $1 AND lb.year = $2
           ORDER BY lt.name`,
          [employee.id, currentYear],
        ),
        query(
          `SELECT *
           FROM payroll_calculations
           WHERE employee_id = $1
           ORDER BY year DESC, month DESC
           LIMIT 12`,
          [employee.id],
        ),
        query(
          `SELECT *
           FROM employee_documents
           WHERE employee_id = $1 AND company_id = $2
           ORDER BY uploaded_at DESC`,
          [employee.id, req.companyId],
        ),
        query(
          `SELECT *
           FROM employee_assets
           WHERE employee_id = $1
           ORDER BY assigned_date DESC NULLS LAST`,
          [employee.id],
        ),
        query(
          `SELECT es.*, s.name, s.start_time, s.end_time, s.working_days, s.grace_period_minutes
           FROM employee_shifts es
           JOIN shifts s ON es.shift_id = s.id
           WHERE es.employee_id = $1 AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
           ORDER BY es.effective_from DESC
           LIMIT 1`,
          [employee.id],
        ),
        query(
          `SELECT *
           FROM salary_structures
           WHERE employee_id = $1 AND is_active = true
           ORDER BY effective_from DESC
           LIMIT 1`,
          [employee.id],
        ),
      ]);

    return res.json({
      employee,
      attendance: {
        summary: attendanceSummary.rows[0],
        records: attendanceRecords.rows,
      },
      leave: {
        requests: leaveRequests.rows,
        balances: leaveBalances.rows,
      },
      payroll: payroll.rows,
      documents: documents.rows,
      assets: assets.rows,
      shift: shift.rows[0] || null,
      salary: salary.rows[0] || null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const {
    email, password, employee_code, first_name, last_name, date_of_birth, gender,
    phone, emergency_contact, emergency_contact_name, address, city, state, country,
    postal_code, department_id, designation_id, manager_id, joining_date, employment_type,
    aadhar_number, pan_number, bank_account_number, bank_name, bank_ifsc, offer_letter_title, offer_letter_content, documents = [],
  } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await query(
      `INSERT INTO users (company_id, email, password_hash, role, is_active)
       VALUES ($1::int, $2::text, $3::text, 'employee', true)
       RETURNING id`,
      [req.companyId, email.toLowerCase(), passwordHash]
    );

    const userId = userResult.rows[0].id;

    const empResult = await query(
      `INSERT INTO employees (
        user_id, company_id, employee_code, first_name, last_name, date_of_birth, gender,
        phone, emergency_contact, emergency_contact_name, address, city, state, country,
        postal_code, department_id, designation_id, manager_id, joining_date, employment_type,
        aadhar_number, pan_number, bank_account_number, bank_name, bank_ifsc
      ) VALUES ($1::int, $2::int, $3::text, $4::text, $5::text, $6::date, $7::text, $8::text, $9::text, $10::text, $11::text, $12::text, $13::text, $14::text, $15::text, $16::int, $17::int, $18::int, $19::date, $20::text, $21::text, $22::text, $23::text, $24::text, $25::text)
      RETURNING *`,
      [
        userId, req.companyId, employee_code, first_name, last_name, nullable(date_of_birth), nullable(gender),
        nullable(phone), nullable(emergency_contact), nullable(emergency_contact_name), nullable(address), nullable(city), nullable(state), nullable(country),
        nullable(postal_code), nullable(department_id), nullable(designation_id), nullable(manager_id), joining_date, employment_type,
        nullable(aadhar_number), nullable(pan_number), nullable(bank_account_number), nullable(bank_name), nullable(bank_ifsc),
      ]
    );

    const employee = empResult.rows[0];
    const sanitizedDocuments = sanitizeDocuments(documents);

    const leaveTypes = await query('SELECT * FROM leave_types WHERE company_id = $1 AND is_active = true', [req.companyId]);
    const currentYear = new Date().getFullYear();

    for (const leaveType of leaveTypes.rows) {
      await query(
        `INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days)
         VALUES ($1::int, $2::int, $3::int, $4::decimal, $4::decimal)`,
        [employee.id, leaveType.id, currentYear, leaveType.days_per_year]
      );
    }

    for (const document of sanitizedDocuments) {
      await query(
        `INSERT INTO employee_documents (employee_id, company_id, document_type, document_name, file_url, file_size, uploaded_by)
         VALUES ($1::int, $2::int, $3::text, $4::text, $5::text, $6::int, $7::int)`,
        [employee.id, req.companyId, document.document_type, document.document_name, document.file_url, document.file_size, req.user.id],
      );
    }

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'employee',
      entityId: employee.id,
      newValues: employee,
      ipAddress: req.ip,
    });

    try {
      const subject = 'Welcome to Attendify!';
      let text = `Hi ${first_name},\n\nYour employee account is created.\nEmail: ${email}\nPassword: ${password}\nJoining Date: ${joining_date || 'N/A'}\n\nPlease login and complete your profile.\n\nRegards,\nAttendify`;
      if (offer_letter_title || offer_letter_content) {
        text += `\n\n--- Offer Letter ---\nTitle: ${offer_letter_title || 'Offer Letter'}\n${offer_letter_content || ''}`;
      }

      await sendEmail({
        to: email,
        subject,
        text,
      });
    } catch (mailError) {
      console.error('Employee onboarding email failed', mailError);
    }

    res.status(201).json(employee);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/send-onboarding', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { id } = req.params;
  const { subject, message, include_credentials = false } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ message: 'subject and message are required' });
  }

  try {
    const empResult = await query(
      `SELECT e.first_name, e.last_name, e.joining_date, u.email, u.password_hash FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = $1 AND e.company_id = $2`,
      [id, req.companyId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = empResult.rows[0];
    let body = `Hi ${employee.first_name || 'Employee'},\n\n${message}`;
    if (include_credentials) {
      body += `\n\nLogin: ${employee.email}\nPassword: (the password set by admin or user)`;
    }
    body += '\n\nRegards,\nAttendify';

    await sendEmail({
      to: employee.email,
      subject,
      text: body,
    });

    res.json({ message: 'Onboarding email sent to employee.' });
  } catch (error) {
    console.error('Onboarding email failed', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/impersonate', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { id } = req.params;

  try {
    const employeeResult = await query(
      'SELECT e.id, e.user_id, e.company_id, e.first_name, e.last_name, u.email, u.role' +
      ' FROM employees e' +
      ' JOIN users u ON e.user_id = u.id' +
      ' WHERE e.id = $1 AND ($2::int IS NULL OR e.company_id = $2)',
      [id, req.companyId],
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];
    const token = jwt.sign(
      {
        userId: employee.user_id,
        role: employee.role,
        companyId: employee.company_id,
        impersonateBy: req.user.id,
        originalRole: req.user.role,
        originalUserId: req.user.id,
        impersonateUntil: Date.now() + 24 * 60 * 60 * 1000,
      },
      config.jwtSecret,
      { expiresIn: '24h' },
    );

    res.json({
      message: 'Employee impersonation token generated',
      token,
      employee: {
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
      },
    });
  } catch (error) {
    console.error('Employee impersonation error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { id } = req.params;
  const {
    first_name, last_name, date_of_birth, gender, phone, emergency_contact,
    emergency_contact_name, address, city, state, country, postal_code,
    department_id, designation_id, manager_id, employment_type, status,
    aadhar_number, pan_number, bank_account_number, bank_name, bank_ifsc,
  } = req.body;

  try {
    const result = await query(
      `UPDATE employees 
       SET first_name = $1::text, last_name = $2::text, date_of_birth = $3::date, gender = $4::text, phone = $5::text,
           emergency_contact = $6::text, emergency_contact_name = $7::text, address = $8::text, city = $9::text,
           state = $10::text, country = $11::text, postal_code = $12::text, department_id = $13::int,
           designation_id = $14::int, manager_id = $15::int, employment_type = $16::text, status = $17::text,
           aadhar_number = $18::text, pan_number = $19::text, bank_account_number = $20::text, bank_name = $21::text, bank_ifsc = $22::text,
           updated_at = NOW()
       WHERE id = $23::int AND ($24::int IS NULL OR company_id = $24::int)
      RETURNING *`,
      [
        first_name, last_name, nullable(date_of_birth), nullable(gender), nullable(phone), nullable(emergency_contact),
        nullable(emergency_contact_name), nullable(address), nullable(city), nullable(state), nullable(country), nullable(postal_code),
        nullable(department_id), nullable(designation_id), nullable(manager_id), nullable(employment_type), nullable(status) || 'active',
        nullable(aadhar_number), nullable(pan_number), nullable(bank_account_number), nullable(bank_name), nullable(bank_ifsc),
        id, req.companyId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  try {
    const empResult = await query('SELECT user_id FROM employees WHERE id = $1 AND ($2::int IS NULL OR company_id = $2)', [req.params.id, req.companyId]);

    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await query('DELETE FROM employees WHERE id = $1', [req.params.id]);
    await query('DELETE FROM users WHERE id = $1', [empResult.rows[0].user_id]);

    await logAudit({
      companyId: req.companyId,
      userId: req.user.id,
      action: 'DELETE_EMPLOYEE',
      entityType: 'employee',
      entityId: req.params.id,
      ipAddress: req.ip,
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/documents', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM employee_documents WHERE employee_id = $1 AND ($2::int IS NULL OR company_id = $2) ORDER BY uploaded_at DESC',
      [req.params.id, req.companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee documents:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/assets', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM employee_assets WHERE employee_id = $1 AND ($2::int IS NULL OR company_id = $2) ORDER BY assigned_date DESC',
      [req.params.id, req.companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/assets', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { asset_name, asset_type, serial_number, assigned_date, notes } = req.body;

  try {
    const result = await query(
      `INSERT INTO employee_assets (employee_id, company_id, asset_name, asset_type, serial_number, assigned_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, req.companyId, asset_name, asset_type, serial_number, assigned_date, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/password', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const empResult = await query('SELECT user_id, company_id FROM employees WHERE id = $1 AND ($2::int IS NULL OR company_id = $2)', [id, req.companyId]);

    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { user_id: userId, company_id: companyId } = empResult.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const duplicateMapping = await query(
      'SELECT id FROM employees WHERE user_id = $1 AND ($2::int IS NULL OR company_id = $2)',
      [userId, req.companyId],
    );

    if (duplicateMapping.rows.length > 1) {
      return res.status(409).json({
        message: 'Cannot reset password: multiple employees are linked to the same login account. Please repair employee-user mapping first.',
        employee_ids: duplicateMapping.rows.map((row) => row.id),
      });
    }

    await query(
      `UPDATE users u
       SET password_hash = $1, updated_at = NOW()
       FROM employees e
       WHERE e.id = $2
         AND e.user_id = u.id
         AND ($3::int IS NULL OR e.company_id = $3)`,
      [passwordHash, id, req.companyId],
    );

    await logAudit({
      companyId: companyId,
      userId: req.user.id,
      action: 'RESET_PASSWORD',
      entityType: 'employee',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

export default router;

