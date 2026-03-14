import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

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

// Get all employees
router.get('/', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, u.email, u.is_active, d.name as department_name, des.title as designation_title
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ($1::int IS NULL OR e.company_id = $1)
      ORDER BY e.created_at DESC
    `, [req.companyId]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee by ID
router.get('/:id', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, u.email, u.is_active, d.name as department_name, des.title as designation_title
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
    res.status(500).json({ message: error.message });
  }
});

// Get employee full profile
router.get('/:id/profile', authenticate, tenantIsolation, async (req, res) => {
  try {
    const employeeResult = await query(
      `SELECT e.*, u.email, u.is_active, d.name as department_name, des.title as designation_title
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
           FROM hr_documents
           WHERE employee_id = $1
           ORDER BY generated_at DESC`,
          [employee.id],
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

// Create employee
router.post('/', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const {
    email, password, employee_code, first_name, last_name, date_of_birth, gender,
    phone, emergency_contact, emergency_contact_name, address, city, state, country,
    postal_code, department_id, designation_id, manager_id, joining_date, employment_type,
    aadhar_number, pan_number, bank_account_number, bank_name, bank_ifsc, documents = [],
  } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await query(
      `INSERT INTO users (company_id, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'employee', true)
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
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

    // Initialize leave balances
    const leaveTypes = await query('SELECT * FROM leave_types WHERE company_id = $1 AND is_active = true', [req.companyId]);
    const currentYear = new Date().getFullYear();

    for (const leaveType of leaveTypes.rows) {
      await query(
        `INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, remaining_days)
         VALUES ($1, $2, $3, $4, $4)`,
        [employee.id, leaveType.id, currentYear, leaveType.days_per_year]
      );
    }

    for (const document of sanitizedDocuments) {
      await query(
        `INSERT INTO employee_documents (employee_id, company_id, document_type, document_name, file_url, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update employee
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
       SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4, phone = $5,
           emergency_contact = $6, emergency_contact_name = $7, address = $8, city = $9,
           state = $10, country = $11, postal_code = $12, department_id = $13,
           designation_id = $14, manager_id = $15, employment_type = $16, status = $17,
           aadhar_number = $18, pan_number = $19, bank_account_number = $20, bank_name = $21, bank_ifsc = $22,
           updated_at = NOW()
       WHERE id = $23 AND ($24::int IS NULL OR company_id = $24)
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
    res.status(500).json({ message: error.message });
  }
});

// Delete employee
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
    res.status(500).json({ message: error.message });
  }
});

// Get employee documents
router.get('/:id/documents', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM employee_documents WHERE employee_id = $1 AND ($2::int IS NULL OR company_id = $2) ORDER BY uploaded_at DESC',
      [req.params.id, req.companyId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee assets
router.get('/:id/assets', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM employee_assets WHERE employee_id = $1 AND ($2::int IS NULL OR company_id = $2) ORDER BY assigned_date DESC',
      [req.params.id, req.companyId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign asset
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
    res.status(500).json({ message: error.message });
  }
});

export default router;
