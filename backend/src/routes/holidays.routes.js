import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();

// Get all holidays for the company
router.get('/', authenticate, tenantIsolation, async (req, res) => {
  try {
    const { year } = req.query;
    let queryText = 'SELECT * FROM holidays WHERE ($1::int IS NULL OR company_id = $1)';
    const params = [req.companyId];
    if (year) {
      queryText += ` AND EXTRACT(YEAR FROM holiday_date) = $2`;
      params.push(year);
    }
    queryText += ' ORDER BY holiday_date ASC';
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create holiday
router.post('/', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { name, holiday_date, description } = req.body;
  try {
    const result = await query(
      `INSERT INTO holidays (company_id, name, holiday_date, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.companyId, name, holiday_date, description]
    );
    const holiday = result.rows[0];
    try {
      const employeeResult = await query(
        `SELECT u.email, e.first_name FROM employees e JOIN users u ON e.user_id = u.id WHERE e.company_id = $1 AND e.status = 'active'`,
        [req.companyId]
      );
      const emails = employeeResult.rows.map((r) => r.email).filter(Boolean);
      const subject = `Holiday Added: ${holiday.name} on ${new Date(holiday.holiday_date).toISOString().split('T')[0]}`;
      const text = `Hello,\n\nA new holiday has been added: ${holiday.name} (${new Date(holiday.holiday_date).toISOString().split('T')[0]}).\n${holiday.description || ''}\n\nEnjoy your day off!\nAttendify`;
      await Promise.allSettled(emails.map((email) => sendEmail({ to: email, subject, text })));
    } catch (emailError) {
      console.error('Holiday notification email failed', emailError);
    }

    res.status(201).json(holiday);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update holiday
router.put('/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { name, holiday_date, description } = req.body;
  try {
    const result = await query(
      `UPDATE holidays SET name = $1, holiday_date = $2, description = $3, updated_at = NOW()
       WHERE id = $4 AND ($5::int IS NULL OR company_id = $5) RETURNING *`,
      [name, holiday_date, description, req.params.id, req.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Holiday not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete holiday
router.delete('/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM holidays WHERE id = $1 AND ($2::int IS NULL OR company_id = $2) RETURNING id',
      [req.params.id, req.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Holiday not found' });
    res.json({ message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
