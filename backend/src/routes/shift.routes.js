import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get all shifts
router.get('/', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM shifts WHERE ($1::int IS NULL OR company_id = $1) AND is_active = true ORDER BY name',
      [req.companyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create shift
router.post('/', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const {
    name, start_time, end_time, working_days, grace_period_minutes,
    late_penalty_per_minute, early_leave_penalty_per_minute
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO shifts (company_id, name, start_time, end_time, working_days, grace_period_minutes, late_penalty_per_minute, early_leave_penalty_per_minute)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.companyId, name, start_time, end_time, JSON.stringify(working_days), grace_period_minutes, late_penalty_per_minute, early_leave_penalty_per_minute]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update shift
router.put('/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { id } = req.params;
  const {
    name, start_time, end_time, working_days, grace_period_minutes,
    late_penalty_per_minute, early_leave_penalty_per_minute, is_active
  } = req.body;

  try {
    const result = await query(
      `UPDATE shifts 
       SET name = $1, start_time = $2, end_time = $3, working_days = $4, grace_period_minutes = $5,
           late_penalty_per_minute = $6, early_leave_penalty_per_minute = $7, is_active = $8
       WHERE id = $9 AND ($10::int IS NULL OR company_id = $10)
       RETURNING *`,
      [name, start_time, end_time, JSON.stringify(working_days), grace_period_minutes, late_penalty_per_minute, early_leave_penalty_per_minute, is_active, id, req.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign shift to employee
router.post('/assign', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { employee_id, shift_id, effective_from, effective_to } = req.body;

  try {
    // End previous shift assignment
    await query(
      'UPDATE employee_shifts SET effective_to = $1 WHERE employee_id = $2 AND effective_to IS NULL',
      [effective_from, employee_id]
    );

    const result = await query(
      `INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [employee_id, shift_id, effective_from, effective_to]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee shift
router.get('/employee/:employeeId', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      `SELECT es.*, s.name, s.start_time, s.end_time, s.working_days, s.grace_period_minutes
       FROM employee_shifts es
       JOIN shifts s ON es.shift_id = s.id
       WHERE es.employee_id = $1 AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
       ORDER BY es.effective_from DESC
       LIMIT 1`,
      [req.params.employeeId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete shift
router.delete('/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM shifts WHERE id = $1 AND ($2::int IS NULL OR company_id = $2) RETURNING id',
      [req.params.id, req.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Shift not found' });
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
