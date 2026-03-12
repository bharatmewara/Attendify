import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get HR documents
router.get('/', authenticate, tenantIsolation, async (req, res) => {
  const { employee_id, document_type } = req.query;

  try {
    let queryText = `
      SELECT hd.*, e.first_name, e.last_name, e.employee_code, u.email as generated_by_email
      FROM hr_documents hd
      JOIN employees e ON hd.employee_id = e.id
      LEFT JOIN users u ON hd.generated_by = u.id
      WHERE ($1::int IS NULL OR hd.company_id = $1)
    `;
    const params = [req.companyId];

    if (req.user.role === 'employee') {
      const empResult = await query('SELECT id FROM employees WHERE user_id = $1', [req.user.id]);
      if (empResult.rows.length > 0) {
        queryText += ` AND hd.employee_id = $2`;
        params.push(empResult.rows[0].id);
      }
    } else if (employee_id) {
      queryText += ` AND hd.employee_id = $${params.length + 1}`;
      params.push(employee_id);
    }

    if (document_type) {
      queryText += ` AND hd.document_type = $${params.length + 1}`;
      params.push(document_type);
    }

    queryText += ' ORDER BY hd.generated_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate HR document
router.post('/', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { employee_id, document_type, title, content } = req.body;

  try {
    // Get employee details
    const empResult = await query(
      `SELECT e.*, u.email, d.name as department_name, des.title as designation_title
       FROM employees e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       WHERE e.id = $1 AND e.company_id = $2`,
      [employee_id, req.companyId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = empResult.rows[0];

    // Get company details
    const companyResult = await query('SELECT * FROM companies WHERE id = $1', [req.companyId]);
    const company = companyResult.rows[0];

    // Replace placeholders in content
    let finalContent = content
      .replace(/\{employee_name\}/g, `${employee.first_name} ${employee.last_name}`)
      .replace(/\{employee_code\}/g, employee.employee_code)
      .replace(/\{email\}/g, employee.email)
      .replace(/\{designation\}/g, employee.designation_title || '')
      .replace(/\{department\}/g, employee.department_name || '')
      .replace(/\{joining_date\}/g, employee.joining_date || '')
      .replace(/\{company_name\}/g, company.company_name)
      .replace(/\{company_address\}/g, company.address || '')
      .replace(/\{date\}/g, new Date().toLocaleDateString());

    // In real app, generate PDF here
    const documentUrl = `/documents/${document_type}_${employee_id}_${Date.now()}.pdf`;

    const result = await query(
      `INSERT INTO hr_documents (employee_id, company_id, document_type, title, content, document_url, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [employee_id, req.companyId, document_type, title, finalContent, documentUrl, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get document templates
router.get('/templates', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const templates = {
    offer_letter: {
      title: 'Offer Letter',
      content: `Dear {employee_name},

We are pleased to offer you the position of {designation} at {company_name}.

Your employment will commence on {joining_date}. You will be reporting to the {department} department.

We look forward to welcoming you to our team.

Sincerely,
{company_name}
{company_address}
Date: {date}`
    },
    appointment_letter: {
      title: 'Appointment Letter',
      content: `Dear {employee_name},

This is to confirm your appointment as {designation} at {company_name}, effective from {joining_date}.

Employee Code: {employee_code}
Email: {email}
Department: {department}

Please report to the HR department on your joining date.

Best regards,
{company_name}
Date: {date}`
    },
    agreement: {
      title: 'Employment Agreement',
      content: `EMPLOYMENT AGREEMENT

This agreement is made on {date} between {company_name} and {employee_name}.

Position: {designation}
Department: {department}
Employee Code: {employee_code}
Start Date: {joining_date}

Terms and conditions apply as per company policy.

Signed,
{company_name}
{employee_name}`
    }
  };

  res.json(templates);
});

export default router;
